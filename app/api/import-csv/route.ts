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
  //
  // GEMINI_CSV_FALLBACK_MODEL (opcional) es un segundo modelo al que se
  // salta cuando el principal está saturado: el 4 Oct 2026 gemini-3.6-flash
  // devolvió 503 "This model is currently experiencing high demand" varias
  // veces seguidas, y con un solo modelo no había forma de esquivarlo.
  const models = [process.env.GEMINI_CSV_MODEL || "gemini-3.6-flash", process.env.GEMINI_CSV_FALLBACK_MODEL || ""].filter(
    Boolean,
  )

  // Todo el trabajo tiene que caber en maxDuration (180s arriba). Se deja
  // margen para que, si Gemini de verdad no responde, la función devuelva un
  // error legible en vez de que Vercel la mate en seco sin dar respuesta.
  const deadline = Date.now() + 170_000

  const instructions = (kind: string) =>
    `Para cada movimiento, elige la categoría que mejor encaje de esta lista fija (usa exactamente ` +
    `uno de estos nombres, no inventes categorías nuevas):\n${categoryHints}\n\n${skipHint}\n\n${currencyHint}\n\n` +
    `Recuerda: devuelve TODOS los movimientos reales del ${kind}, sin saltarte ninguno.`

  const pdfPrompt =
    `Este es un extracto bancario en PDF (puede tener una o varias páginas, con los movimientos ` +
    `en una tabla, en texto plano, o repartidos entre varias secciones). Puede ser de cualquier ` +
    `banco (CommBank, Revolut, un banco español, etc.) y cada uno maqueta su extracto de forma ` +
    `distinta. Lee el documento entero y devuelve TODOS los movimientos reales que encuentres ` +
    `(ignora cabeceras, pies de página repetidos en cada hoja, el saldo inicial/final, y cualquier ` +
    `fila de resumen o totales que no sea un movimiento individual).\n\n${instructions("documento")}`

  // `preamble` son las líneas del principio del archivo (cabecera de
  // columnas, datos de la cuenta...) que no son movimientos: van en cada
  // fragmento solo para que el modelo entienda las columnas.
  const csvPrompt = (preamble: string, rows: string, part: string) =>
    `Este es un extracto bancario en CSV${part}. Puede ser de cualquier banco (CommBank, Revolut, ` +
    `un banco español, etc.) y cada uno usa sus propias columnas, formato de fecha y forma de ` +
    `indicar el importe (una sola columna con signo, o columnas separadas de cargo/abono, con ` +
    `coma o punto decimal, con o sin símbolo de divisa). Detecta el formato y devuelve TODOS los ` +
    `movimientos de las FILAS, uno por fila (ignora cualquier fila de saldo/resumen que no sea un ` +
    `movimiento real).\n\n${instructions("CSV")}\n\n` +
    (preamble ? `CABECERA DEL ARCHIVO (solo para entender las columnas, no contiene movimientos):\n${preamble}\n\n` : "") +
    `FILAS:\n${rows}`

  type GeminiResult = { ok: true; transactions: unknown[] } | { ok: false; retryable: boolean; error: string }

  // Una llamada a Gemini con un modelo concreto. Nunca lanza: devuelve si
  // fue bien y, si no, si merece la pena reintentar (timeout, 429, 5xx) o
  // es un error "duro" (API key inválida, modelo no encontrado...).
  const callGemini = async (model: string, parts: unknown[], timeoutMs: number): Promise<GeminiResult> => {
    // Los modelos "3.x" de Gemini piensan antes de responder por defecto, y
    // con el nivel "medium" de serie tardan demasiado para una tarea de
    // extracción/clasificación como esta — así que se pide el mínimo: los
    // 3.x usan thinkingLevel ("low" es lo más rápido en la familia Flash) y
    // los 2.5 usan thinkingBudget, que ahí sí se puede poner a 0.
    const thinkingConfig = /^gemini-3/.test(model) ? { thinkingLevel: "low" } : { thinkingBudget: 0 }

    let res: Response
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
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
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      console.error("[import-csv] Gemini fetch error:", model, err)
      const timedOut = err instanceof Error && err.name === "TimeoutError"
      return { ok: false, retryable: true, error: timedOut ? "Gemini tardó demasiado en responder" : "No se pudo contactar con Gemini" }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error("[import-csv] Gemini API error:", model, res.status, errText)
      // Se manda un fragmento del error real de Gemini en vez de un mensaje
      // genérico: así el aviso que se ve en pantalla ya dice por qué (cuota
      // agotada, modelo retirado, clave inválida...) sin mirar los logs.
      return {
        ok: false,
        retryable: res.status === 429 || res.status >= 500,
        error: `Gemini respondió ${res.status}: ${errText.slice(0, 200) || "sin detalle"}`,
      }
    }

    const result = await res.json()
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
      // MAX_TOKENS (respuesta cortada por exceso de movimientos) saldría
      // igual al repetir, así que no se reintenta.
      const reasonHint =
        finishReason === "MAX_TOKENS"
          ? " (el extracto tiene demasiados movimientos para una sola pasada; pruébalo por partes)"
          : finishReason
            ? ` (motivo: ${finishReason})`
            : ""
      return {
        ok: false,
        retryable: finishReason !== "MAX_TOKENS",
        error: `La IA no devolvió los movimientos en el formato esperado${reasonHint}`,
      }
    }
    return { ok: true, transactions }
  }

  // La capa gratuita de Gemini da 429/503 a menudo, y suele resolverse en
  // unos segundos — así que se reintenta con espera creciente, alternando
  // con el modelo de respaldo si hay uno configurado, y sin pasarse nunca
  // del deadline de la función.
  const RETRY_DELAYS = [0, 2_000, 5_000, 10_000]
  const extract = async (parts: unknown[], maxCallMs: number): Promise<GeminiResult> => {
    let last: GeminiResult = { ok: false, retryable: true, error: "Gemini tardó demasiado en responder" }
    for (let i = 0; i < RETRY_DELAYS.length; i++) {
      if (RETRY_DELAYS[i]) await new Promise((r) => setTimeout(r, RETRY_DELAYS[i]))
      const remaining = deadline - Date.now()
      if (remaining < 10_000) break
      last = await callGemini(models[i % models.length], parts, Math.min(maxCallMs, remaining))
      if (last.ok || !last.retryable) return last
    }
    return last
  }

  // Un CSV largo en UNA sola llamada obligaba a Gemini a generar todos los
  // movimientos de golpe, y con el modelo lento eso pasaba de los 165s que
  // había antes ("The operation was aborted due to timeout", 4 Oct 2026).
  // Ahora el CSV se parte en fragmentos de CSV_CHUNK_ROWS filas que se
  // procesan en paralelo: cada llamada tarda segundos, y si una falla se
  // reintenta solo esa. El PDF no se puede partir así (Gemini lo lee
  // entero), así que va en una sola llamada con los mismos reintentos.
  const CSV_CHUNK_ROWS = 80
  const CSV_MAX_CHUNKS = 12
  const CONCURRENCY = 4

  let jobs: { parts: unknown[]; label: string }[]
  if (isPdf) {
    jobs = [{ parts: [{ text: pdfPrompt }, { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }], label: "" }]
  } else {
    // Las filas de movimientos empiezan en la primera línea con algo que
    // parezca una fecha (01/10/2026, 2026-10-01, 1.10.26...). Lo de antes es
    // cabecera/datos de la cuenta (CommBank, por ejemplo, no tiene cabecera
    // y empieza directamente en el primer movimiento).
    const lines = csv.split(/\r?\n/).filter((l) => l.trim())
    const datePattern = /\b\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b/
    const first = lines.slice(0, 20).findIndex((l) => datePattern.test(l))

    if (first < 0) {
      // Formato raro sin fechas reconocibles: se manda entero, como antes.
      jobs = [{ parts: [{ text: csvPrompt("", lines.join("\n"), "") }], label: "" }]
    } else {
      const preamble = lines.slice(0, first).join("\n")
      const rows = lines.slice(first)
      const total = Math.ceil(rows.length / CSV_CHUNK_ROWS)
      if (total > CSV_MAX_CHUNKS) {
        return NextResponse.json(
          {
            error:
              `El CSV tiene demasiados movimientos (${rows.length}) para importarlo de una vez. ` +
              `Pruébalo por partes (por ejemplo, un extracto por trimestre).`,
          },
          { status: 400 },
        )
      }
      jobs = Array.from({ length: total }, (_, i) => {
        const part = total > 1 ? ` (fragmento ${i + 1} de ${total})` : ""
        const chunk = rows.slice(i * CSV_CHUNK_ROWS, (i + 1) * CSV_CHUNK_ROWS).join("\n")
        return { parts: [{ text: csvPrompt(preamble, chunk, part) }], label: total > 1 ? ` (fragmento ${i + 1} de ${total})` : "" }
      })
    }
  }

  try {
    // Fragmentos en paralelo, como mucho CONCURRENCY a la vez para no
    // disparar el límite de peticiones por minuto de la capa gratuita.
    // Cada llamada se corta a los 75s: con 80 filas sobra, y así quedan
    // segundos para reintentar dentro del deadline.
    const maxCallMs = isPdf ? 165_000 : 75_000
    const results: GeminiResult[] = new Array(jobs.length)
    let next = 0
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
        while (next < jobs.length) {
          const i = next++
          results[i] = await extract(jobs[i].parts, maxCallMs)
        }
      }),
    )

    // Si falla un fragmento se devuelve error en vez de una importación a
    // medias: así el usuario reintenta el archivo entero y la detección de
    // duplicados del cliente se encarga de lo que ya estuviera.
    const failed = results.findIndex((r) => !r.ok)
    if (failed >= 0) {
      const r = results[failed] as Extract<GeminiResult, { ok: false }>
      return NextResponse.json(
        { error: `No se pudo leer el ${isPdf ? "PDF" : "CSV"} con la IA${jobs[failed].label}: ${r.error}.` },
        { status: 502 },
      )
    }
    const transactions = results.flatMap((r) => (r.ok ? r.transactions : []))
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
