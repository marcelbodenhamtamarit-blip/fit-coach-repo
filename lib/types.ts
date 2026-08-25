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
  transactions: Transaction[]
  recurring: RecurringTransaction[]
  homeCurrency: string
  language: string
  // Modo viaje: mientras está activo, los formularios de nueva transacción
  // (normal y recurrente) usan travelCurrency como divisa por defecto en
  // vez de homeCurrency, para no tener que cambiarla a mano cada vez que
  // se registra un gasto fuera de casa. travelCurrency guarda la última
  // elegida aunque el modo esté desactivado, para no perderla al reactivar.
  travelMode: boolean
  travelCurrency: string | null
}

// ---------- Automatizaciones ----------
// Reglas estilo "Atajos de Apple": un disparador + una acción. Ver
// supabase-migrations/automations.sql para el detalle de cada campo.

export const AUTOMATION_TRIGGER_TYPES = ["schedule", "condition"] as const
export type AutomationTriggerType = (typeof AUTOMATION_TRIGGER_TYPES)[number]

export const AUTOMATION_ACTION_TYPES = ["push", "popup", "both"] as const
export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number]

export const SCHEDULE_FREQUENCIES = ["daily", "weekly"] as const
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number]

// weekly_savings: ingresos - gastos de la semana en curso.
// monthly_expenses: suma de gastos del mes en curso (todas las categorías).
// category_monthly_expenses: igual, pero solo de conditionCategory.
export const CONDITION_METRICS = ["weekly_savings", "monthly_expenses", "category_monthly_expenses"] as const
export type ConditionMetric = (typeof CONDITION_METRICS)[number]

export const CONDITION_OPERATORS = ["lt", "lte", "gt", "gte"] as const
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]

export type Automation = {
  id: string
  name: string
  active: boolean
  triggerType: AutomationTriggerType

  scheduleFrequency: ScheduleFrequency | null
  scheduleTime: string | null // "HH:MM"
  scheduleWeekday: number | null // 0=domingo..6=sábado, solo si weekly

  conditionMetric: ConditionMetric | null
  conditionOperator: ConditionOperator | null
  conditionValue: number | null
  conditionCategory: TransactionCategory | null
  conditionCooldownHours: number

  actionType: AutomationActionType
  messageTitle: string
  messageBody: string

  lastTriggeredAt: string | null
}

export type AutomationEvent = {
  id: string
  automationId: string | null
  title: string
  body: string
  actionType: AutomationActionType
  pushSent: boolean
  popupSeen: boolean
  createdAt: string
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
