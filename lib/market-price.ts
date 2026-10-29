import type { SupabaseClient } from "@supabase/supabase-js"
import type { PriceUnit } from "./types"

export type LivePriceResult = {
  price: number
  priceDate: string
  previousPrice: number | null
  previousDate: string | null
}

// Llama a /api/market-price (ver ese archivo para el porqué de pasar por
// el servidor: la clave de API Ninjas no puede viajar al navegador). Lee
// además el precio cacheado del día anterior más reciente directamente
// desde Supabase (lectura abierta, no hace falta la ruta del servidor
// para eso) para poder mostrar si ha subido o bajado hoy.
export async function fetchLivePrice(
  symbol: string,
  kind: "stock" | "gold",
  supabase: SupabaseClient,
): Promise<LivePriceResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error("No hay sesión activa")

  const res = await fetch(`/api/market-price?symbol=${encodeURIComponent(symbol)}&kind=${kind}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "No se pudo obtener el precio")

  const price = Number(json.price)
  const priceDate = String(json.date)

  const { data: prevRows } = await supabase
    .from("market_prices")
    .select("price, price_date")
    .eq("symbol", symbol.trim().toUpperCase())
    .lt("price_date", priceDate)
    .order("price_date", { ascending: false })
    .limit(1)

  const prev = prevRows?.[0] as { price: number; price_date: string } | undefined
  return {
    price,
    priceDate,
    previousPrice: prev ? Number(prev.price) : null,
    previousDate: prev ? prev.price_date : null,
  }
}

// API Ninjas da el precio del oro por onza troy. Si la cantidad guardada
// está en gramos, hay que convertir antes de multiplicar.
const GRAMS_PER_TROY_OZ = 31.1034768

export function valueFromLivePrice(price: number, quantity: number, priceUnit: PriceUnit): number {
  if (priceUnit === "gram") return (price / GRAMS_PER_TROY_OZ) * quantity
  return price * quantity
}
