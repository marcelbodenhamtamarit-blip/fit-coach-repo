// Winter Arc: reglas, orden de sesiones y cálculos puros (racha, día del
// arco, sesión que toca, tirada larga objetivo). Sin Supabase ni React, para
// que la lógica se pueda leer y probar de un vistazo. El estado vive en
// lib/winter-arc-store.tsx y la pantalla en
// components/sections/winter-arc-section.tsx.

import type { TranslationKey } from "./i18n"

export type WinterArcRuleId =
  | "entreno"
  | "pasos"
  | "proteina"
  | "agua"
  | "sueno"
  | "alcohol"
  | "lectura"
  | "movil"
  | "gasto"

// Las 9 casillas diarias, en el orden en que se muestran.
export const WINTER_ARC_RULES: { id: WinterArcRuleId; label: TranslationKey }[] = [
  { id: "entreno", label: "wa.rule.entreno" },
  { id: "pasos", label: "wa.rule.pasos" },
  { id: "proteina", label: "wa.rule.proteina" },
  { id: "agua", label: "wa.rule.agua" },
  { id: "sueno", label: "wa.rule.sueno" },
  { id: "alcohol", label: "wa.rule.alcohol" },
  { id: "lectura", label: "wa.rule.lectura" },
  { id: "movil", label: "wa.rule.movil" },
  { id: "gasto", label: "wa.rule.gasto" },
]

// Un día normal está cumplido con 7 de 9. Un "día mínimo" (días malos)
// está cumplido si se hacen estas 4: moverse 20 min, proteína, leer y cero
// alcohol.
export const DAY_TARGET = 7
export const MINIMUM_DAY_RULES: WinterArcRuleId[] = ["entreno", "proteina", "lectura", "alcohol"]

export type WinterArcSession =
  | "fuerza_a"
  | "rodaje"
  | "fuerza_b"
  | "fuerza_c"
  | "larga"
  | "opcional"
  | "descanso"

// Orden fijo, no días fijos: se hace la siguiente de la lista cuando se
// pueda. Si un día se cae, no se recupera — se sigue con la siguiente.
export const SESSION_ORDER: Exclude<WinterArcSession, "descanso">[] = [
  "fuerza_a",
  "rodaje",
  "fuerza_b",
  "fuerza_c",
  "larga",
  "opcional",
]

export const SESSION_LABEL: Record<WinterArcSession, TranslationKey> = {
  fuerza_a: "wa.session.fuerza_a",
  rodaje: "wa.session.rodaje",
  fuerza_b: "wa.session.fuerza_b",
  fuerza_c: "wa.session.fuerza_c",
  larga: "wa.session.larga",
  opcional: "wa.session.opcional",
  descanso: "wa.session.descanso",
}

export const SESSION_DETAIL: Record<Exclude<WinterArcSession, "descanso">, TranslationKey> = {
  fuerza_a: "wa.sessionDetail.fuerza_a",
  rodaje: "wa.sessionDetail.rodaje",
  fuerza_b: "wa.sessionDetail.fuerza_b",
  fuerza_c: "wa.sessionDetail.fuerza_c",
  larga: "wa.sessionDetail.larga",
  opcional: "wa.sessionDetail.opcional",
}

// Tirada larga objetivo por semana del arco (semana 1 = la del día 1).
// Semanas 4 y 8 son de descarga.
export const LONG_RUN_PLAN_MIN = [40, 45, 50, 40, 55, 60, 70, 50, 75, 85]

export type WinterArcDay = {
  id: string
  date: string
  checks: WinterArcRuleId[]
  minimumDay: boolean
  session: WinterArcSession | null
  sessionMinutes: number | null
  sessionNotes: string | null
  pages: number | null
}

export type WinterArcWeek = {
  id: string
  weekStart: string
  weight: number | null
  waist: number | null
  longRunMinutes: number | null
  note: string | null
}

export type WinterArcSettings = {
  startDate: string
  endDate: string
  currentBook: string | null
}

export const DEFAULT_SETTINGS: WinterArcSettings = {
  startDate: "2026-10-26",
  endDate: "2026-12-31",
  currentBook: null,
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00")
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00").getTime()
  const b = new Date(toISO + "T00:00:00").getTime()
  return Math.round((b - a) / 86_400_000)
}

// Lunes de la semana de una fecha (la revisión semanal va de lunes a
// domingo, igual que el plan).
export function mondayOf(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00")
  const offset = (d.getDay() + 6) % 7
  return addDaysISO(dateISO, -offset)
}

export function isDayDone(day: WinterArcDay | undefined): boolean {
  if (!day) return false
  if (day.minimumDay) return MINIMUM_DAY_RULES.every((r) => day.checks.includes(r))
  return day.checks.length >= DAY_TARGET
}

// Días cumplidos seguidos hasta hoy. Si hoy todavía no está cumplido, la
// racha cuenta hasta ayer (el día aún no ha terminado).
export function currentStreak(byDate: Map<string, WinterArcDay>, today: string): number {
  let cursor = isDayDone(byDate.get(today)) ? today : addDaysISO(today, -1)
  let streak = 0
  while (isDayDone(byDate.get(cursor))) {
    streak++
    cursor = addDaysISO(cursor, -1)
  }
  return streak
}

// "Nunca dos días seguidos sin cumplir": true si ayer no se cumplió, para
// avisar de que hoy no se puede fallar.
export function missedYesterday(byDate: Map<string, WinterArcDay>, today: string, startTracking: string): boolean {
  const yesterday = addDaysISO(today, -1)
  if (yesterday < startTracking) return false
  return !isDayDone(byDate.get(yesterday))
}

// La sesión que toca: la siguiente a la última sesión de entreno hecha
// (los descansos no avanzan el orden).
export function nextSession(days: WinterArcDay[], today: string): Exclude<WinterArcSession, "descanso"> {
  const last = [...days]
    .filter((d) => d.date < today && d.session && d.session !== "descanso")
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  if (!last || !last.session || last.session === "descanso") return SESSION_ORDER[0]
  const idx = SESSION_ORDER.indexOf(last.session)
  return SESSION_ORDER[(idx + 1) % SESSION_ORDER.length]
}

export function arcWeekIndex(settings: WinterArcSettings, dateISO: string): number {
  return Math.floor(daysBetween(settings.startDate, dateISO) / 7)
}

export function longRunTarget(settings: WinterArcSettings, dateISO: string): number | null {
  const w = arcWeekIndex(settings, dateISO)
  if (w < 0) return null
  return LONG_RUN_PLAN_MIN[Math.min(w, LONG_RUN_PLAN_MIN.length - 1)]
}
