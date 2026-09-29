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
  { code: "RON", symbol: "lei", name: "Leu rumano" },
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
  // Día en que empieza la semana para esta persona (0=domingo...6=sábado,
  // igual que Date.getDay()) — afecta a "Semana N" en Economía, al ahorro
  // semanal de Resumen, al recordatorio de "ahorro semanal" y a qué día cae
  // un recurrente semanal. Por defecto domingo, para no cambiar el
  // comportamiento de nadie que no toque este ajuste (ver lib/week.ts).
  weekStartDay: number
  // Tarifa por hora del turno normal y % de impuestos a estimar al marcar
  // un turno como cobrado (ver Ajustes > Turnos y lib/shifts-store.tsx). La
  // tarifa de sábado/domingo no se guarda aparte: se calcula multiplicando
  // esta misma por SHIFT_RATE_MULTIPLIER.
  shiftHourlyRate: number
  shiftTaxPct: number
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

// ---------- Turnos (calendario de turnos estilo Homebase) ----------
// Cada turno guarda cuántas horas se trabajaron un día y a qué tarifa le
// corresponden (normal/sábado/domingo — ver SHIFT_RATE_MULTIPLIER).
// Mientras no se ha cobrado vive solo como plan; al marcarlo como
// "cobrado" se genera una transacción de ingreso real en Economía (ver
// lib/shifts-store.tsx) y transactionId queda enlazado con ella, para
// poder borrarla si el turno se desmarca o se elimina.

export const SHIFT_TYPES = ["normal", "sabado", "domingo"] as const
export type ShiftType = (typeof SHIFT_TYPES)[number]

export const SHIFT_STATUSES = ["planificado", "cobrado"] as const
export type ShiftStatus = (typeof SHIFT_STATUSES)[number]

// Recargo sobre shiftHourlyRate según el tipo de turno (convenio habitual:
// sábado x1.5, domingo x2). Si algún día la tarifa real no encaja
// exactamente con esto, se ajusta shiftHourlyRate en Ajustes > Turnos en
// vez de tocar estos multiplicadores.
export const SHIFT_RATE_MULTIPLIER: Record<ShiftType, number> = {
  normal: 1,
  sabado: 1.5,
  domingo: 2,
}

export type Shift = {
  id: string
  date: string // ISO date yyyy-mm-dd
  startTime: string | null // "HH:MM", opcional (solo para mostrar el horario)
  endTime: string | null // "HH:MM", opcional
  hours: number
  shiftType: ShiftType
  status: ShiftStatus
  notes: string | null
  transactionId: string | null // fila de `transactions` creada al marcar como cobrado
}

// Tipo de turno sugerido a partir del día de la semana de `dateISO`
// (0=domingo...6=sábado, igual que Date.getDay()): domingo y sábado usan
// recargo, el resto es turno normal. Es solo el valor de partida al crear
// un turno nuevo — shiftType queda editable por si algún festivo entre
// semana paga distinto.
export function shiftTypeForDate(dateISO: string): ShiftType {
  const day = new Date(dateISO + "T00:00:00").getDay()
  if (day === 0) return "domingo"
  if (day === 6) return "sabado"
  return "normal"
}

export function shiftGrossPay(hours: number, shiftType: ShiftType, hourlyRate: number): number {
  return hours * hourlyRate * SHIFT_RATE_MULTIPLIER[shiftType]
}

// Estimación de neto aplicando shiftTaxPct al bruto del turno. Solo es una
// estimación (no hay un % de impuestos exacto único para todo el mundo —
// ver el aviso en Ajustes > Turnos), por eso al marcar un turno como
// cobrado este número aparece pre-rellenado pero editable, no se guarda a
// ciegas.
export function shiftNetPay(hours: number, shiftType: ShiftType, hourlyRate: number, taxPct: number): number {
  return shiftGrossPay(hours, shiftType, hourlyRate) * (1 - taxPct / 100)
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
