// Utilidades de "semana" compartidas por toda la app. En qué día empieza la
// semana es una preferencia por usuario (Ajustes → Preferencias → Inicio de
// semana, guardada en user_preferences.week_start_day) en vez de estar fijo
// al domingo como antes — antes cada pantalla (Economía, Resumen, el worker
// de Recordatorios...) tenía su propia copia pegada de esta lógica, todas
// asumiendo domingo; ahora hay un único sitio que tocar.
//
// weekStartDay usa el mismo convenio que Date.getDay(): 0 = domingo,
// 1 = lunes, ..., 6 = sábado.

export const DEFAULT_WEEK_START_DAY = 0

// Fecha (a las 00:00 hora local) del primer día de la semana que contiene
// `date`, según weekStartDay.
export function getWeekStart(date: Date, weekStartDay: number): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day - weekStartDay + 7) % 7
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Igual que getWeekStart pero a partir de una fecha yyyy-mm-dd y devolviendo
// también una fecha yyyy-mm-dd (para comparar contra transactions.date sin
// líos de zona horaria) — pensado para el servidor (app/api/automations/evaluate).
export function weekStartISO(dateISO: string, weekStartDay: number): string {
  const d = new Date(dateISO + "T00:00:00")
  const day = d.getDay()
  const diff = (day - weekStartDay + 7) % 7
  d.setDate(d.getDate() - diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

// Dado el día de la semana en que "toca" algo (targetWeekday, mismo convenio
// 0=domingo...6=sábado — por ejemplo el payDay de un recurrente semanal) y
// el día en que empieza la semana, cuántos días hay que sumar a
// getWeekStart()/weekStartISO() para llegar a ese día concreto. Por ejemplo,
// si la semana empieza en lunes (weekStartDay=1) y targetWeekday=0 (domingo),
// el domingo es el ÚLTIMO día de esa semana (offset 6), no el primero — sin
// este ajuste, "recurrente semanal que paga el domingo" se movería al lunes
// en cuanto alguien cambiara su inicio de semana.
export function offsetWithinWeek(targetWeekday: number, weekStartDay: number): number {
  return (targetWeekday - weekStartDay + 7) % 7
}

// Número de semana del año que contiene `dateStr` (yyyy-mm-dd): la semana 1
// empieza en el weekStartDay más cercano (hacia atrás) al 4 de enero. No es
// el estándar ISO-8601 (que siempre usa lunes) — es el criterio propio que
// ya tenía la app antes de esta preferencia, generalizado para admitir
// cualquier día de inicio en vez de asumir domingo siempre.
export function getWeekNumberFromISO(dateStr: string, weekStartDay: number): number {
  const date = new Date(dateStr + "T00:00:00Z")
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const jan4Day = jan4.getUTCDay()
  const offset = (jan4Day - weekStartDay + 7) % 7
  const week1Start = new Date(jan4)
  week1Start.setUTCDate(jan4.getUTCDate() - offset)
  const diffDays = Math.floor((date.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000))
  return 1 + Math.floor(diffDays / 7)
}

// Rango de fechas para el label "Semana N (inicio - fin)" de Economía. Nota:
// igual que antes de esta preferencia, usa un año fijo como ancla (mismo
// comportamiento ya existente, sin tocar) — esto solo cambia qué día de la
// semana es el primero/último.
export function getWeekDateRangeFromNum(weekNum: number, weekStartDay: number): { start: string; end: string } {
  const anchor = new Date(Date.UTC(2026, 0, 4))
  const anchorDay = anchor.getUTCDay()
  const offset = (anchorDay - weekStartDay + 7) % 7
  const firstWeekStart = new Date(anchor)
  firstWeekStart.setUTCDate(anchor.getUTCDate() - offset)
  const startDate = new Date(firstWeekStart)
  startDate.setUTCDate(firstWeekStart.getUTCDate() + (weekNum - 1) * 7)
  const endDate = new Date(startDate)
  endDate.setUTCDate(startDate.getUTCDate() + 6)
  const fmt = (d: Date) => {
    const day = String(d.getUTCDate()).padStart(2, "0")
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]
    return `${day} ${month}`
  }
  return { start: fmt(startDate), end: fmt(endDate) }
}

// Orden de los 7 días para pintar selectores (día de pago de un recurrente
// semanal, día de un recordatorio semanal...) empezando por weekStartDay —
// puramente visual, el valor guardado sigue siendo siempre el día real
// (0=domingo...6=sábado, Date.getDay()), así que cambiar el inicio de semana
// nunca reordena ni rompe nada ya guardado.
export function weekdayDisplayOrder(weekStartDay: number): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartDay + i) % 7)
}
