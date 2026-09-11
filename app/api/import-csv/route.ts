import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

// Con Fluid Compute (activado por defecto en Vercel, incluso en el plan
// gratuito) el límite real llega hasta 300s — antes esto se dejaba en 60
// pensando que era el máximo del plan Hobby, y ese límite artificial fue
// justo lo que provocó "The operation was aborted due to timeout" con un
// extracto real: aunque se bajó el nivel de "pensamiento" del modelo (ver
// thinkingConfig más abajo), Gemini a veces tarda más de 60s con un extracto
// grande y esto lo cortaba antes de tiempo. 180s da mucho más margen sin
// acercarse al límite real de la plataforma.
export const maxDuration = 180

// Importar extracto bancario en CSV o PDF: el usuario sube el archivo tal
// cual lo exportó su banco (CommBank, Revolut, el que sea) desde el botón
// "Importar CSV o PDF" en Economía (ver economy-section.tsx). Cada banco usa
// columnas, formatos de fecha y símbolos de divisa distintos en sus CSV, y
// cada uno maqueta sus PDF de forma distinta (tablas, texto plano,
// cabeceras/pies en cada página...) — así que en vez de escribir un parser a
// mano por banco y por formato, se manda el archivo entero a una IA
// pidiéndole que devuelva los movimientos ya normalizados (fecha ISO,
// importe con signo, categoría de las 9 fijas de la app). El PDF se manda
// como documento nativo a Gemini (no se extrae el texto a mano en el
// servidor) — los modelos 2.5 de Gemini leen PDFs directamente, tablas
// incluidas, así que esto cubre igual de bien un extracto con texto
// seleccionable que uno escaneado/con imágenes.
//
// Usa Gemini (GEMINI_API_KEY), la misma clave que ya usa
// /api/quick-transaction para inferir categorías por IA — así no hace
// falta dar de alta una cuenta ni una clave nueva para probar esto.
//
// Nota de privacidad (ver README "Bank expense import" / "Privacy note"):
// a diferencia del resto de la app, aquí el contenido real del extracto
// (fechas, importes, descripciones) SÍ viaja a la API de Gemini en cada
// importación, para poder soportar "cualquier banco" sin configurar cada
// formato a mano. Es una decisión consciente tomada con el usuario — si se
// prefiere evitarlo, la alternativa es un parser local por patrones (sin
// mandar nada fuera) a costa de no cubrir bancos con formatos muy raros.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    return NextResponse.json({ error: "Falta la sesión (Authorization: Bearer <token>)" }, { status: 401 })
  }

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: userData, error: userError } = await anonClient.auth.getUser(token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sesión no válida" }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel." },
      { status: 500 },
    )
  }

  // El cliente manda uno de los dos: `csv` (texto plano, tal cual lo lee
  // file.text() en el navegador) o `pdfBase64` (el PDF entero codificado en
  // base64, sin el prefijo "data:application/pdf;base64,"). Nunca los dos a
  // la vez — economy-section.tsx elige uno según la extensión del archivo.
  let csv: string
  let pdfBase64: string
  try {
    const body = await req.json()
    csv = typeof body?.csv === "string" ? body.csv : ""
    pdfBase64 = typeof body?.pdfBase64 === "string" ? body.pdfBase64 : ""
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 })
  }

  const isPdf = !!pdfBase64.trim()

  if (!csv.trim() && !pdfBase64.trim()) {
    return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 })
  }

  // Límite generoso pero no infinito. Para el CSV, un extracto de un año de
  // movimientos diarios cabe de sobra en 300.000 caracteres. Para el PDF, el
  // límite es sobre el base64 (que pesa ~33% más que el archivo original) —
  // 20MB de base64 son ~15MB de PDF real, de sobra para un extracto de
  // varias páginas. En ambos casos, evita mandar archivos enormes por error
  // (o de forma abusiva) a la API, y quedarse corto del límite de tiempo de
  // la función (maxDuration arriba).
  if (!isPdf && csv.length > 300_000) {
    return NextResponse.json(
      { error: "El archivo es demasiado grande. Pruébalo por partes (por ejemplo, un extracto por trimestre)." },
      { status: 400 },
    )
  }
  if (isPdf && pdfBase64.length > 20_000_000) {
    return NextResponse.json(
      { error: "El PDF es demasiado grande. Pruébalo por partes (por ejemplo, un extracto por trimestre)." },
      { status: 400 },
    )
  }

  const categoryHints = [
    "Alojamiento: alquiler, hipoteca, comunidad, suministros de casa (luz, agua, gas)",
    "Supermercado: compra de comida para casa",
    "Comida fuera: restaurantes, bares, cafeterías, comida a domicilio",
    "Transporte: gasolina, transporte público, taxi/Uber, parking, peajes",
    "Salario: nómina o cualquier ingreso de trabajo",
    "Compras: ropa, electrónica, tiendas en general",
    "Necesidades: farmacia, seguros, móvil/internet, salud",
    "Ocio: entretenimiento, suscripciones, hobbies, viajes",
    "Otros: cualquier cosa que no encaje en las anteriores",
  ].join("\n")

  // Muchos bancos (Revolut sobre todo, con sus "bolsillos" por divisa) meten
  // en el mismo extracto filas que NO son un gasto o ingreso real: cambios de
  // divisa internos, transferencias entre cuentas del propio usuario, o
  // recargas de saldo. Sin esta aclaración, Gemini las cuela como
  // transacciones normales (p.ej. una "Conversión a VND" de varios millones
  // aparecería como un ingreso enorme) — así que se pide explícitamente que
  // las salte.
  const skipHint =
    `Algunas filas NO son un gasto ni un ingreso real, sino movimiento interno de dinero — ` +
    `sáltalas y no las incluyas en el resultado: cambios/conversión de divisa entre "bolsillos" ` +
    `de la propia cuenta (p.ej. "Cambio", "Conversión a...", "Currency exchange"), transferencias ` +
    `entre cuentas o tarjetas del mismo usuario, y recargas de saldo desde otra cuenta propia. Si ` +
    `el extracto tiene movimientos en varias divisas distintas, respeta el importe tal cual aparece ` +
    `en cada fila — no los conviertas ni los mezcles (la conversión a la divisa principal del ` +
    `usuario se hace después, fuera de aquí, con el código de divisa que devuelvas para cada fila).`

  // Extractos de una sola divisa (la mayoría de bancos) no necesitan nada
  // especial: category+amount ya identifican el movimiento. Pero un extracto
  // como el de Revolut mezcla varias divisas en el mismo archivo (una
  // columna "Divisa", o el símbolo cambia de fila a fila) — si no se captura
  // qué divisa tenía CADA fila, esos importes se guardarían tal cual en la
  // divisa principal del usuario sin convertir, descuadrando el balance por
  // completo (p.ej. -210000 VND tratado como si fueran -210000 EUR). Por eso
  // se pide el código de divisa de cada movimiento cuando el extracto lo
  // distingue.
  const currencyHint =
    `Si el extracto indica la divisa de cada movimiento (una columna tipo "Divisa"/"Currency", o un ` +
    `símbolo/código distinto por fila), incluye el código ISO 4217 de 3 letras de ESE movimiento en ` +
    `el campo "currency" (p.ej. "EUR", "AUD", "VND") — uno por fila, pueden ser todos distintos. Si ` +
    `el extracto entero está en una sola divisa implícita (sin columna ni símbolo que cambie), deja ` +
    `"currency" vacío en todas las filas.`

  // gemini-2.5-flash dejó de estar disponible de un día para otro (Google lo
  // retira sin avisar demasiado — ver el 404 real que devolvió al intentar
  // importar el extracto de Revolut). gemini-3.6-flash es el reemplazo que
  // el propio error de Google recomendaba. Como esto puede volver a pasar,
  // sigue siendo configurable por variable de entorno sin tocar código.
  const model = process.env.GEMINI_CSV_MODEL || "gemini-3.6-flash"

  const prompt = isPdf
    ? `Este es un extracto bancario en PDF (puede tener una o varias páginas, con los movimientos ` +
      `en una tabla, en texto plano, o repartidos entre varias secciones). Puede ser de cualquier ` +
      `banco (CommBank, Revolut, un banco español, etc.) y cada uno maqueta su extracto de forma ` +
      `distinta. Lee el documento entero y devuelve TODOS los movimientos reales que encuentres ` +
      `(ignora cabeceras, pies de página repetidos en cada hoja, el saldo inicial/final, y cualquier ` +
      `fila de resumen o totales que no sea un movimiento individual).\n\n${skipHint}\n\n${currencyHint}\n\n` +
      `Para cada movimiento, elige la categoría que mejor encaje de esta lista fija (usa exactamente ` +
      `uno de estos nombres, no inventes categorías nuevas):\n${categoryHints}`
    : `Este es un extracto bancario en CSV. Puede ser de cualquier banco (CommBank, Revolut, ` +
      `un banco español, etc.) y cada uno usa sus propias columnas, formato de fecha y forma de ` +
      `indicar el importe (una sola columna con signo, o columnas separadas de cargo/abono, con ` +
      `coma o punto decimal, con o sin símbolo de divisa). Detecta el formato y devuelve TODOS los ` +
      `movimientos del archivo, uno por fila del CSV (ignora la fila de cabecera y cualquier fila ` +
      `de saldo/resumen que no sea un movimiento real).\n\n${skipHint}\n\n${currencyHint}\n\n` +
      `Para cada movimiento, elige la categoría que mejor encaje de esta lista fija (usa exactamente ` +
      `uno de estos nombres, no inventes categorías nuevas):\n${categoryHints}\n\n` +
      `CSV:\n${csv}`

  // Para el PDF, el documento se manda como una parte "inlineData" separada
  // (Gemini lo lee de forma nativa, página a página, tablas incluidas) en
  // vez de intentar extraer el texto a mano en el servidor — así funciona
  // igual de bien con un extracto con texto seleccionable que con uno
  // escaneado. Para el CSV, el contenido ya va embebido en el propio prompt
  // de texto (arriba), así que aquí solo hace falta esa única parte.
  const contentParts = isPdf
    ? [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }]
    : [{ text: prompt }]

  // Los modelos "3.x" de Gemini (a diferencia de los 2.5) piensan antes de
  // responder por defecto — y con nivel "medium" de serie, tardan de sobra
  // más de los 55s que se le dan más abajo antes de abortar, sobre todo con
  // un extracto de decenas de movimientos (esto es justo lo que provocó
  // "The operation was aborted due to timeout" al probar con el extracto de
  // Revolut real, justo después de migrar a gemini-3.6-flash por el 404 de
  // gemini-2.5-flash). Para una tarea de extracción/clasificación como esta
  // no hace falta razonamiento profundo, así que se pide el nivel mínimo de
  // "pensamiento": los modelos 3.x usan thinkingLevel (no se puede desactivar
  // del todo en la familia Flash, pero "low" es lo más rápido disponible);
  // los 2.5 (por si se vuelve a ese modelo vía GEMINI_CSV_MODEL) usan
  // thinkingBudget, y ahí sí se puede poner a 0 para desactivarlo entero.
  const thinkingConfig = /^gemini-3/.test(model) ? { thinkingLevel: "low" } : { thinkingBudget: 0 }

  // Llama a Gemini una vez. Se separa en su propia función para poder
  // reintentar (ver más abajo) sin duplicar el fetch entero.
  const callGemini = () =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: contentParts }],
        generationConfig: {
          temperature: 0,
          thinkingConfig,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              transactions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    date: { type: "STRING", description: "Fecha del movimiento en formato ISO yyyy-mm-dd" },
                    description: {
                      type: "STRING",
                      description: "Descripción o concepto del movimiento, tal cual aparece en el extracto (sin traducir ni inventar).",
                    },
                    amount: {
                      type: "NUMBER",
                      description: "Importe con signo: negativo si es un gasto/cargo, positivo si es un ingreso/abono.",
                    },
                    category: { type: "STRING", enum: [...TRANSACTION_CATEGORIES] },
                    currency: {
                      type: "STRING",
                      description:
                        "Código ISO 4217 de 3 letras de la divisa de ESTE movimiento (p.ej. EUR, AUD, VND), " +
                        "solo si el extracto la distingue por fila. Vacío si todo el extracto está en una " +
                        "sola divisa implícita.",
                    },
                  },
                  required: ["date", "description", "amount", "category"],
                },
              },
            },
            required: ["transactions"],
          },
        },
      }),
      // Deja margen por debajo de maxDuration (180s arriba) para que, si
      // Gemini de verdad no responde, la función pueda devolver un error
      // legible en vez de que Vercel la mate en seco sin dar ninguna
      // respuesta al cliente.
      signal: AbortSignal.timeout(165_000),
    })

  try {
    let geminiRes = await callGemini()

    // Un fallo puntual de cuota/carga (429 o 5xx) es habitual en la capa
    // gratuita de Gemini y suele resolverse solo unos segundos después — así
    // que antes de darlo por perdido se reintenta una vez. Un error "duro"
    // (API key inválida, modelo no encontrado, etc. → 4xx que no sea 429) no
    // se beneficia de reintentar, así que va directo al mensaje de error.
    if (!geminiRes.ok && (geminiRes.status === 429 || geminiRes.status >= 500)) {
      await new Promise((r) => setTimeout(r, 2000))
      geminiRes = await callGemini()
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "")
      console.error("[import-csv] Gemini API error:", geminiRes.status, errText)
      // Se manda un fragmento del error real de Gemini en vez de un mensaje
      // genérico: así, si vuelve a fallar, el aviso que se ve en pantalla ya
      // dice por qué (cuota agotada, modelo retirado, clave inválida...) sin
      // tener que ir a mirar los logs de Vercel.
      return NextResponse.json(
        {
          error:
            `No se pudo leer el ${isPdf ? "PDF" : "CSV"} con la IA ` +
            `(Gemini respondió ${geminiRes.status}: ${errText.slice(0, 200) || "sin detalle"}).`,
        },
        { status: 502 },
      )
    }

    const result = await geminiRes.json()
    const rawText: string | undefined = result?.candidates?.[0]?.content?.parts?.[0]?.text
    const finishReason: string | undefined = result?.candidates?.[0]?.finishReason

    let parsed: unknown
    try {
      parsed = rawText ? JSON.parse(rawText) : null
    } catch {
      parsed = null
    }

    const transactions = (parsed as { transactions?: unknown } | null)?.transactions

    if (!Array.isArray(transactions)) {
      console.error("[import-csv] Respuesta inesperada de Gemini:", JSON.stringify(result).slice(0, 2000))
      // finishReason distingue el caso más probable en un extracto real: el
      // modelo cortó la respuesta a medias por exceder el límite de salida
      // (MAX_TOKENS, extractos muy largos) frente a cualquier otra causa.
      const reasonHint =
        finishReason === "MAX_TOKENS"
          ? " (el extracto tiene demasiados movimientos para una sola pasada; pruébalo por partes)"
          : finishReason
            ? ` (motivo: ${finishReason})`
            : ""
      return NextResponse.json(
        { error: `La IA no devolvió los movimientos en el formato esperado${reasonHint}.` },
        { status: 502 },
      )
    }

    // Validación básica de cada fila antes de devolverla — así un movimiento
    // mal formado no tumba la importación entera ni acaba guardado a medias.
    type ValidRow = { date: string; description: string; amount: number; category: string; currency?: string }
    const valid: ValidRow[] = []
    for (const t of transactions) {
      if (!t || typeof t !== "object") continue
      const row = t as Record<string, unknown>
      const ok =
        typeof row.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
        typeof row.description === "string" &&
        row.description.trim().length > 0 &&
        typeof row.amount === "number" &&
        Number.isFinite(row.amount) &&
        typeof row.category === "string" &&
        (TRANSACTION_CATEGORIES as readonly string[]).includes(row.category)
      if (!ok) continue

      // "currency" es opcional y solo vale si de verdad parece un código
      // ISO 4217 (3 letras) — cualquier otra cosa (vacío, "N/A", un símbolo
      // suelto...) se descarta en vez de colarse como si fuera una divisa
      // real, para que el cliente sepa con seguridad cuándo puede convertir.
      const currencyRaw = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : ""
      const currency = /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : undefined

      valid.push({
        date: row.date as string,
        description: row.description as string,
        amount: row.amount as number,
        category: row.category as string,
        ...(currency ? { currency } : {}),
      })
    }

    return NextResponse.json({ transactions: valid, skippedInvalid: transactions.length - valid.length })
  } catch (err) {
    console.error("[import-csv] error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : `Error importando el ${isPdf ? "PDF" : "CSV"}` },
      { status: 500 },
    )
  }
}
