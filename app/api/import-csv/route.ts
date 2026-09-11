import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

// Vercel corta las funciones serverless a los 10s por defecto (plan
// Hobby); un CSV con muchos movimientos puede tardar más que eso en
// procesarse con la IA, así que se pide el máximo permitido.
export const maxDuration = 60

// Importar extracto bancario en CSV: el usuario sube el archivo tal cual lo
// exportó su banco (CommBank, Revolut, el que sea) desde el botón "Importar
// CSV" en Economía (ver economy-section.tsx). Cada banco usa columnas,
// formatos de fecha y símbolos de divisa distintos, así que en vez de
// escribir un parser a mano por banco, se manda el CSV entero a una IA
// pidiéndole que devuelva los movimientos ya normalizados (fecha ISO,
// importe con signo, categoría de las 9 fijas de la app).
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

  let csv: string
  try {
    const body = await req.json()
    csv = typeof body?.csv === "string" ? body.csv : ""
  } catch {
    return NextResponse.json({ error: "Cuerpo de la petición inválido" }, { status: 400 })
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 })
  }

  // Límite generoso pero no infinito: un extracto de un año de movimientos
  // diarios cabe de sobra en esto. Evita mandar archivos enormes por error
  // (o de forma abusiva) a la API, y quedarse corto del límite de tiempo
  // de la función (maxDuration arriba).
  if (csv.length > 300_000) {
    return NextResponse.json(
      { error: "El archivo es demasiado grande. Pruébalo por partes (por ejemplo, un extracto por trimestre)." },
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

  const model = process.env.GEMINI_CSV_MODEL || "gemini-2.5-flash"

  const prompt =
    `Este es un extracto bancario en CSV. Puede ser de cualquier banco (CommBank, Revolut, ` +
    `un banco español, etc.) y cada uno usa sus propias columnas, formato de fecha y forma de ` +
    `indicar el importe (una sola columna con signo, o columnas separadas de cargo/abono, con ` +
    `coma o punto decimal, con o sin símbolo de divisa). Detecta el formato y devuelve TODOS los ` +
    `movimientos del archivo, uno por fila del CSV (ignora la fila de cabecera y cualquier fila ` +
    `de saldo/resumen que no sea un movimiento real).\n\n` +
    `Para cada movimiento, elige la categoría que mejor encaje de esta lista fija (usa exactamente ` +
    `uno de estos nombres, no inventes categorías nuevas):\n${categoryHints}\n\n` +
    `CSV:\n${csv}`

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
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
                    },
                    required: ["date", "description", "amount", "category"],
                  },
                },
              },
              required: ["transactions"],
            },
          },
        }),
        // maxDuration (arriba) le da margen a la función; este timeout es
        // solo para no dejar la petición colgada si Gemini no responde.
        signal: AbortSignal.timeout(55_000),
      },
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "")
      console.error("[import-csv] Gemini API error:", geminiRes.status, errText)
      return NextResponse.json(
        { error: "No se pudo leer el CSV con la IA. Inténtalo de nuevo en un momento." },
        { status: 502 },
      )
    }

    const result = await geminiRes.json()
    const rawText: string | undefined = result?.candidates?.[0]?.content?.parts?.[0]?.text

    let parsed: unknown
    try {
      parsed = rawText ? JSON.parse(rawText) : null
    } catch {
      parsed = null
    }

    const transactions = (parsed as { transactions?: unknown } | null)?.transactions

    if (!Array.isArray(transactions)) {
      console.error("[import-csv] Respuesta inesperada de Gemini:", JSON.stringify(result).slice(0, 2000))
      return NextResponse.json({ error: "La IA no devolvió los movimientos en el formato esperado." }, { status: 502 })
    }

    // Validación básica de cada fila antes de devolverla — así un movimiento
    // mal formado no tumba la importación entera ni acaba guardado a medias.
    const valid = transactions.filter(
      (t: unknown): t is { date: string; description: string; amount: number; category: string } => {
        if (!t || typeof t !== "object") return false
        const row = t as Record<string, unknown>
        return (
          typeof row.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
          typeof row.description === "string" &&
          row.description.trim().length > 0 &&
          typeof row.amount === "number" &&
          Number.isFinite(row.amount) &&
          typeof row.category === "string" &&
          (TRANSACTION_CATEGORIES as readonly string[]).includes(row.category)
        )
      },
    )

    return NextResponse.json({ transactions: valid, skippedInvalid: transactions.length - valid.length })
  } catch (err) {
    console.error("[import-csv] error:", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error importando el CSV" }, { status: 500 })
  }
}
