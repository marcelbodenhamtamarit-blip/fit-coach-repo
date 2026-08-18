export type WorkoutSet = {
  reps: number
  weight: number
}

export type WorkoutExercise = {
  id: string
  name: string
  sets: WorkoutSet[]
}

export type Workout = {
  id: string
  date: string // ISO date
  name: string
  durationMin: number
  durationSec?: number
  durationDisplay?: string
  exercises: WorkoutExercise[]
  distanceKm?: number
  calories?: number
  type?: string
  heartRateAvg?: number
  heartRateMax?: number
  elevation?: number
  trainingLoad?: number
  averagePower?: number
  elapsedTime?: number
}

export type DailyMetric = {
  id: string
  date: string // ISO date
  steps?: number
  restingHeartRate?: number
  temperature?: number
  comment?: string
}

export type RoutineExercise = {
  id: string
  name: string
  sets: number
  reps: number
}

export type Routine = {
  id: string
  name: string
  focus: string
  exercises: RoutineExercise[]
}

export type Ingredient = {
  id: string
  name: string
  quantity: number // grams
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  pricePerKg: number // AUD
  woolworthsUrl?: string
}

export type Meal = {
  id: string
  date: string // ISO date (yyyy-mm-dd)
  ingredients: Ingredient[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalCost: number // AUD
}

export type PantryItem = {
  id: string
  name: string
  quantityGrams: number
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  pricePerKg: number
  dateAdded: string
  woolworthsUrl?: string
}

export type SleepEntry = {
  id: string
  date: string // ISO date (yyyy-mm-dd)
  hours: number
  quality: number // 1-5
  bedtime: string
  wakeTime: string
}

export type BodyMetric = {
  id: string
  date: string // ISO date (yyyy-mm-dd)
  weight: number // kg
  bodyFat: number // %
  waist: number // cm
}

export type Profile = {
  name: string
  calorieGoal: number
  proteinGoal: number
  weightGoal: number
}

export const TRANSACTION_CATEGORIES = [
  "Alojamiento",
  "Supermercado",
  "Comida fuera",
  "Transporte",
  "Salario",
  "Compras",
  "Necesidades",
  "Ocio",
  "Otros",
] as const

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number]

// Divisas soportadas para registrar transacciones. `amount` en Transaction
// siempre queda en la divisa principal del usuario (home_currency); cuando
// se registra en otra divisa, currency/originalAmount guardan el importe
// tal cual se pagó, para poder mostrarlo junto al convertido.
export const CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "Dólar estadounidense" },
  { code: "AUD", symbol: "$", name: "Dólar australiano" },
  { code: "ARS", symbol: "$", name: "Peso argentino" },
  { code: "GBP", symbol: "£", name: "Libra esterlina" },
  { code: "MXN", symbol: "$", name: "Peso mexicano" },
  { code: "COP", symbol: "$", name: "Peso colombiano" },
  { code: "CLP", symbol: "$", name: "Peso chileno" },
  { code: "PEN", symbol: "S/", name: "Sol peruano" },
  { code: "BRL", symbol: "R$", name: "Real brasileño" },
  { code: "UYU", symbol: "$", name: "Peso uruguayo" },
  { code: "JPY", symbol: "¥", name: "Yen japonés" },
  { code: "CNY", symbol: "¥", name: "Yuan chino" },
  { code: "CHF", symbol: "Fr", name: "Franco suizo" },
  { code: "CAD", symbol: "$", name: "Dólar canadiense" },
  { code: "NZD", symbol: "$", name: "Dólar neozelandés" },
  { code: "THB", symbol: "฿", name: "Baht tailandés" },
  { code: "VND", symbol: "₫", name: "Dong vietnamita" },
  { code: "SGD", symbol: "$", name: "Dólar de Singapur" },
  { code: "IDR", symbol: "Rp", name: "Rupia indonesia" },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]["code"]

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return "$"
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

export type Transaction = {
  id: string
  date: string // ISO date yyyy-mm-dd
  description: string
  category: TransactionCategory
  amount: number // ya convertido a la divisa principal del usuario (home_currency)
  currency?: string | null // divisa en la que se pagó, si es distinta de la principal
  originalAmount?: number | null // importe en `currency`, mismo signo que amount
}

// Plantilla de gasto/ingreso recurrente (alquiler, suscripciones, nómina...).
// Según su frecuencia, se crea automáticamente una transacción real al
// empezar cada mes o cada semana a partir de cada plantilla activa, y se
// guarda en lastCreatedPeriod ("YYYY-MM" o "YYYY-Www") para no duplicar.
export const RECURRING_FREQUENCIES = ["monthly", "weekly"] as const
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number]

export type RecurringTransaction = {
  id: string
  description: string
  category: TransactionCategory
  amount: number // negative = expense, positive = income; ya convertido a home_currency
  active: boolean
  frequency: RecurringFrequency
  // Día en que se genera la transacción dentro de cada periodo. Si
  // frequency=monthly es el día del mes (1-31, recortado al último día real
  // del mes si el mes es más corto). Si frequency=weekly es el día de la
  // semana (0=domingo...6=sábado, igual que Date.getDay()).
  payDay: number
  lastCreatedPeriod: string | null // "YYYY-MM" si frequency=monthly, "YYYY-Www" si weekly
}

export type AppData = {
  profile: Profile
  meals: Meal[]
  metrics: BodyMetric[]
  pantry: PantryItem[]
  transactions: Transaction[]
  recurring: RecurringTransaction[]
  homeCurrency: string
}

// Fecha de hoy en la zona horaria del dispositivo (Brisbane por defecto).
// Evita que a primera hora de la manana en Australia se registre el dia anterior.
export const todayISO = () => {
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Australia/Brisbane"
      : "Australia/Brisbane"
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date())
}

export const uid = () => Math.random().toString(36).slice(2, 10)
