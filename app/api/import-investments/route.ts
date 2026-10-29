import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Importar aportaciones de una inversión desde un extracto en CSV o PDF
// (botón "Importar CSV o PDF" en Inversiones, ver investments-section.tsx).
// Mismo patrón que app/api/import-csv/route.ts (el de Economía): se manda
// el archivo entero a Gemini (ya configurado en Vercel — GEMINI_API_KEY,
// la misma clave que usan /api/import-csv y /api/timmy) en vez de escribir
// un parser a mano por banco/bróker/exchange. Cada sitio (Revolut Invest,
// Revolut Crypto, un PIAS, un exchange cualquiera) maqueta su extracto de
// forma distinta, y Gemini 2.5+/3.x lee PDFs de forma nativa (tablas
// incluidas), así que esto cubre tanto un extracto con texto seleccionable
// como uno escaneado, sin tener que mantener un formato por proveedor.
//
// A diferencia de /api/import-csv (que clasifica gastos por categoría),
// aquí solo hacen falta movimientos de dinero DENTRO/FUERA de la
// inversión (aportaciones y retiradas) — no cada operación de compra/venta
// interna ni la revalorización del precio día a día, que es justo lo que
// el campo "valor actual" de la inversión ya representa por separado.
export const maxDuration = 180

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

  // Igual que /api/import-csv: el cliente manda `csv` (texto plano) o
  // `pdfBase64` (sin el prefijo "data:application/pdf;base64,"), nunca los
  // dos a la vez.
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
  if (!isPdf && csv.length > 300_000) {
    return NextResponse.json(
      { error: "El archivo es demasiado grande. Pruébalo por partes." },
      { status: 400 },
    )
  }
  if (isPdf && pdfBase64.length > 20_000_000) {
    return NextResponse.json({ error: "El PDF es demasiado grande. Pruébalo por partes." }, { status: 400 })
  }

  // Un extracto de bróker multi-activo (Revolut Invest y similares) suele
  // traer una tabla de "Portfolio breakdown"/"Holdings" con una fila por
  // símbolo (ticker, cantidad, precio) — eso es justo lo que necesita el
  // tipo de inversión "stocks" con precio en vivo (ver lib/types.ts,
  // isLivePriceType): symbol + quantity, sin meter el valor a mano. Antes
  // esto no se extraía en absoluto — solo se leían los "Cash top-up" de la
  // tabla de transacciones, que es ruido para este caso (son el lado en
  // dinero de cada compra, no la posición resultante) y dejaba al usuario
  // sin ver qué había comprado realmente.
  const positionHint =
    `Si el extracto incluye una tabla de cartera/posiciones actuales (encabezados como "Portfolio ` +
    `breakdown", "Holdings", "Positions" — una fila por cada activo que se posee AHORA MISMO, con su ` +
    `símbolo/ticker y la cantidad que se tiene), extrae esa tabla completa en "positions": un símbolo ` +
    `corto tipo ticker bursátil (p.ej. "AAPL", "VUSA" — en mayúsculas, SIN el ISIN ni el nombre completo ` +
    `de la empresa) y la cantidad de unidades/acciones que se poseen. Si el extracto tiene varias de estas ` +
    `tablas (p.ej. una por divisa, como "USD Portfolio breakdown" y "EUR Portfolio breakdown"), extrae TODAS ` +
    `las filas de TODAS ellas en el mismo array "positions" — no te quedes solo con la primera. Si no hay ` +
    `ninguna tabla de este tipo (p.ej. un extracto que solo lista ingresos/retiradas de dinero, como un PIAS ` +
    `o una cuenta de ahorro), deja "positions" como array vacío.`

  const contributionHint =
    `Aparte de las posiciones de arriba, interesan también los movimientos de dinero QUE ENTRA o SALE de ` +
    `esta inversión/cuenta — aportaciones (ingresos, transferencias de dinero hacia dentro, "top up", ` +
    `"deposit") y retiradas ("withdrawal", ventas que sacan el dinero fuera de la cuenta por completo, no ` +
    `una compra de otro activo con ese dinero). Estos dos campos son complementarios: "positions" es la foto ` +
    `fija de qué se posee ahora, "contributions" es el historial de dinero entrando/saliendo de la cuenta en ` +
    `general — en un extracto de bróker normalmente aparecen los dos (las posiciones arriba, y los "cash ` +
    `top-up" aquí). NO incluyas en "contributions" cada operación individual de compra/venta de un activo ` +
    `concreto (eso ya queda reflejado en "positions"), ni dividendos reinvertidos automáticamente, ni ` +
    `comisiones sueltas — solo el movimiento neto de dinero entrando/saliendo de la cuenta en su conjunto. ` +
    `Si una fila es ambigua, mejor incluirla (el usuario revisa la lista antes de guardar nada) que omitirla.`

  const balanceHint =
    `Si el extracto indica en algún sitio el saldo o valor final en EFECTIVO de la cuenta (p.ej. "Cash ` +
    `value", "Balance", el dinero sin invertir), devuélvelo en "currentBalance" — esto es aparte de las ` +
    `posiciones, que ya llevan su propio valor. Si no aparece ningún saldo en efectivo claro, deja ` +
    `"currentBalance" en null — no lo calcules ni lo inventes sumando los movimientos.`

  const model = process.env.GEMINI_CSV_MODEL || "gemini-3.6-flash"

  const prompt = isPdf
    ? `Este es un extracto en PDF de una inversión, cuenta de bróker o exchange de criptomonedas (puede ser ` +
      `de cualquier proveedor: Revolut Invest, Revolut Crypto, un plan de ahorro, un bróker, etc., y cada uno ` +
      `maqueta su extracto de forma distinta — en tabla, texto plano, o varias secciones). Lee el documento ` +
      `entero, todas las páginas.\n\n${positionHint}\n\n${contributionHint}\n\n${balanceHint}`
    : `Este es un extracto en CSV de una inversión, cuenta de bróker o exchange de criptomonedas (puede ser ` +
      `de cualquier proveedor y cada uno usa sus propias columnas, formato de fecha e importe). Detecta el ` +
      `formato tú mismo.\n\n${positionHint}\n\n${contributionHint}\n\n${balanceHint}\n\nCSV:\n${csv}`

  const contentParts = isPdf
    ? [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: pdfBase64 } }]
    : [{ text: prompt }]

  const thinkingConfig = /^gemini-3/.test(model) ? { thinkingLevel: "low" } : { thinkingBudget: 0 }

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
              positions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    symbol: {
                      type: "STRING",
                      description: "Símbolo/ticker bursátil en mayúsculas (p.ej. AAPL), nunca el ISIN ni el nombre completo.",
                    },
                    company: {
                      type: "STRING",
                      description: "Nombre de la empresa/fondo tal cual aparece en el extracto (p.ej. \"Apple\", \"Vanguard S&P 500 Dist ETF\").",
                    },
                    quantity: {
                      type: "NUMBER",
                      description: "Cantidad de unidades/acciones que se poseen de este activo ahora mismo.",
                    },
                  },
                  required: ["symbol", "quantity"],
                },
              },
              contributions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    date: { type: "STRING", description: "Fecha del movimiento en formato ISO yyyy-mm-dd" },
                    note: {
                      type: "STRING",
                      description: "Descripción breve del movimiento, tal cual aparece en el extracto.",
                    },
                    amount: {
                      type: "NUMBER",
                      description: "Importe con signo: positivo si es dinero que entra (aportación), negativo si sale (retirada).",
                    },
                  },
                  required: ["date", "amount"],
                },
              },
              currentBalance: {
                type: "NUMBER",
                nullable: true,
                description: "Saldo en efectivo sin invertir de la cuenta, si el extracto lo indica, null si no.",
              },
            },
            required: ["positions", "contributions"],
          },
        },
      }),
      signal: AbortSignal.timeout(165_000),
    })

  try {
    let geminiRes = await callGemini()
    if (!geminiRes.ok && (geminiRes.status === 429 || geminiRes.status >= 500)) {
      await new Promise((r) => setTimeout(r, 2000))
      geminiRes = await callGemini()
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "")
      console.error("[import-investments] Gemini API error:", geminiRes.status, errText)
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

    const obj = parsed as { positions?: unknown; contributions?: unknown; currentBalance?: unknown } | null
    const rawPositions = Array.isArray(obj?.positions) ? obj!.positions : null
    const rawContributions = Array.isArray(obj?.contributions) ? obj!.contributions : null

    // "positions" es el campo nuevo — una respuesta vieja (modelo distinto,
    // o un reintento con un esquema desfasado) sin él no debería tratarse
    // como un fallo total mientras al menos "contributions" esté bien
    // formado, así que solo se exige esto último.
    if (!rawContributions) {
      console.error("[import-investments] respuesta inesperada de Gemini:", finishReason, rawText?.slice(0, 500))
      return NextResponse.json(
        { error: "La IA no ha devuelto un resultado válido. Prueba de nuevo en un momento." },
        { status: 502 },
      )
    }

    const positions = ((rawPositions ?? []) as unknown[])
      .map((r) => {
        const row = r as { symbol?: unknown; company?: unknown; quantity?: unknown }
        const symbolRaw = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : ""
        // Un ticker real nunca lleva espacios ni es larguísimo — esto
        // descarta que Gemini se haya colado metiendo el ISIN o el nombre
        // completo de la empresa en vez del símbolo corto que pide el
        // esquema, en lugar de dejar pasar algo que luego romperá al
        // llamar a /api/market-price.
        const symbol = /^[A-Z0-9.]{1,10}$/.test(symbolRaw) ? symbolRaw : null
        const quantity = typeof row.quantity === "number" && isFinite(row.quantity) && row.quantity > 0 ? row.quantity : null
        const company = typeof row.company === "string" ? row.company.trim().slice(0, 120) : ""
        return { symbol, quantity, company }
      })
      .filter((r): r is { symbol: string; quantity: number; company: string } => !!r.symbol && r.quantity !== null)

    const contributions = (rawContributions as unknown[])
      .map((r) => {
        const row = r as { date?: unknown; note?: unknown; amount?: unknown }
        const date = typeof row.date === "string" ? row.date.slice(0, 10) : null
        const amount = typeof row.amount === "number" && isFinite(row.amount) ? row.amount : null
        const note = typeof row.note === "string" ? row.note.trim().slice(0, 300) : ""
        return { date, amount, note }
      })
      .filter((r): r is { date: string; amount: number; note: string } => !!r.date && r.amount !== null && r.amount !== 0)

    const currentBalance =
      typeof obj?.currentBalance === "number" && isFinite(obj.currentBalance) ? obj.currentBalance : null

    return NextResponse.json({ positions, contributions, currentBalance })
  } catch (err) {
    console.error("[import-investments]", err)
    return NextResponse.json(
      { error: "No se pudo importar el archivo. Prueba de nuevo en un momento." },
      { status: 502 },
    )
  }
}
