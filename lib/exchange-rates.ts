import type { SupabaseClient } from "@supabase/supabase-js"

// Tipos de cambio con caché diaria en la tabla exchange_rates: una fila por
// (divisa base, día) con todas las tasas de esa base en un jsonb. Se usa
// tanto desde el cliente (al añadir una transacción en otra divisa) como
// desde el servidor (quick-add por token). No hace falta llamar a la API
// externa más de una vez al día por divisa base.
//
// La API devuelve, para una base dada, cuántas unidades de cada otra
// divisa equivalen a 1 unidad de la base. Para convertir un importe:
//   convertido = importeEnBase * rates[divisaDestino]
export async function getExchangeRates(
  base: string,
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  const normalizedBase = base.toUpperCase().trim()
  const date = new Date().toISOString().slice(0, 10)

  const { data: cached } = await supabase
    .from("exchange_rates")
    .select("rates")
    .eq("base_currency", normalizedBase)
    .eq("rate_date", date)
    .maybeSingle()

  if (cached?.rates) {
    return cached.rates as Record<string, number>
  }

  const res = await fetch(`https://open.er-api.com/v6/latest/${normalizedBase}`)
  if (!res.ok) {
    throw new Error("No se pudo obtener el tipo de cambio")
  }
  const json = await res.json()
  const rates = json?.rates
  if (!rates || typeof rates !== "object") {
    throw new Error("Respuesta de tipo de cambio inválida")
  }

  // Best-effort: si el insert falla (carrera con otra petición el mismo
  // día, o problema de permisos) seguimos adelante con la tasa recién
  // obtenida igualmente.
  await supabase
    .from("exchange_rates")
    .upsert({ base_currency: normalizedBase, rate_date: date, rates })

  return rates as Record<string, number>
}

// Convierte un importe (con signo) de `fromCurrency` a `toCurrency` usando
// las tasas del día. Si son la misma divisa, devuelve el importe tal cual
// sin llamar a nada.
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  supabase: SupabaseClient,
): Promise<number> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return amount
  const rates = await getExchangeRates(fromCurrency, supabase)
  const rate = rates[toCurrency.toUpperCase()]
  if (typeof rate !== "number" || !isFinite(rate)) {
    throw new Error(`No hay tipo de cambio de ${fromCurrency} a ${toCurrency}`)
  }
  return amount * rate
}
