import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Precio en vivo para inversiones "stocks" (acciones/ETFs) y "gold"
// (oro) — ver lib/types.ts (isLivePriceType) y supabase-migrations/
// market-prices.sql. Usa API Ninjas (API_NINJAS_KEY en Vercel), que cubre
// tanto acciones como materias primas con una sola clave gratuita.
//
// Cacheado por (símbolo, día) en la tabla market_prices: una vez al día es
// de sobra para una app de seguimiento personal, y evita gastar cuota de
// la API en cada carga de pantalla. El histórico guardado (no solo "el
// precio de hoy") es también lo que permite al cliente calcular si ha
// subido o bajado respecto al día anterior, comparando contra la fila más
// reciente anterior — sin que la API externa tenga que darnos ese dato.
export const maxDuration = 30

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// La respuesta de API Ninjas no siempre usa el mismo nombre de campo según
// el endpoint (stockprice vs commodityprice) — se prueban los más
// probables en orden en vez de asumir uno solo.
function extractPrice(json: unknown): number | null {
  if (!json || typeof json !== "object") return null
  const obj = json as Record<string, unknown>
  for (const key of ["price", "last", "value", "close"]) {
    const v = obj[key]
    if (typeof v === "number" && isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "" && isFinite(Number(v))) return Number(v)
  }
  return null
}

async function fetchFromApiNinjas(symbol: string, kind: "stock" | "gold", apiKey: string): Promise<number> {
  const url =
    kind === "gold"
      ? "https://api.api-ninjas.com/v1/commodityprice?name=gold"
      : `https://api.api-ninjas.com/v1/stockprice?ticker=${encodeURIComponent(symbol)}`

  const res = await fetch(url, { headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`API Ninjas ${res.status}: ${text.slice(0, 200) || "sin detalle"}`)
  }
  const json = await res.json()
  const price = extractPrice(json)
  if (price === null) {
    throw new Error("API Ninjas no ha devuelto un precio reconocible")
  }
  return price
}

export async function GET(req: NextRequest) {
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

  const apiKey = process.env.API_NINJAS_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta configurar API_NINJAS_KEY en las variables de entorno de Vercel." },
      { status: 500 },
    )
  }

  const { searchParams } = new URL(req.url)
  const kindParam = searchParams.get("kind")
  const kind: "stock" | "gold" = kindParam === "gold" ? "gold" : "stock"
  const symbolParam = (searchParams.get("symbol") || (kind === "gold" ? "XAU" : "")).trim().toUpperCase()
  if (!symbolParam) {
    return NextResponse.json({ error: "Falta el símbolo" }, { status: 400 })
  }

  // Cliente autenticado como el propio usuario (su JWT reenviado), para
  // que el insert en market_prices cumpla la política RLS "authenticated
  // can insert" — igual de público que exchange_rates, no hace falta la
  // service role key solo para esto.
  const authedClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const date = todayISO()

  const { data: cached } = await authedClient
    .from("market_prices")
    .select("price")
    .eq("symbol", symbolParam)
    .eq("price_date", date)
    .maybeSingle()

  if (cached?.price !== undefined && cached.price !== null) {
    return NextResponse.json({ price: Number(cached.price), date, cached: true })
  }

  try {
    const price = await fetchFromApiNinjas(symbolParam, kind, apiKey)
    // Best-effort: si el insert falla (carrera con otra petición el mismo
    // día) seguimos adelante con el precio recién obtenido igualmente.
    await authedClient.from("market_prices").upsert({ symbol: symbolParam, price_date: date, price })
    return NextResponse.json({ price, date, cached: false })
  } catch (err) {
    console.error("[market-price]", err)
    const message = err instanceof Error ? err.message : "Error desconocido"
    return NextResponse.json({ error: `No se pudo obtener el precio de ${symbolParam}: ${message}` }, { status: 502 })
  }
}
