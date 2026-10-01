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

// ---------- Motivación ----------
// Frases propias (no citas de nadie), una por día: cambia sola cada día y
// es la misma todo el día, para que no parezca una ruleta.
export const MOTIVATION = [
  "Nadie va a hacerlo por ti. Por eso cuenta.",
  "No necesitas ganas. Necesitas empezar 5 minutos.",
  "El tú de enero te está mirando. Dale motivos.",
  "Un día cumplido no se nota. Sesenta, sí.",
  "La disciplina es cumplir cuando nadie te está mirando.",
  "Hoy no hace falta un día perfecto. Hace falta un día cumplido.",
  "Lo difícil primero. Lo demás, cuesta abajo.",
  "Cada promesa que te cumples te hace más fuerte que la anterior.",
  "No pienses tanto. Ejecuta.",
  "El frío no se negocia. Las ganas tampoco.",
  "Fallar un día es normal. Fallar dos es elegir.",
  "Tu cuerpo hace lo que le pides. Pídele más.",
  "No compites con nadie. Compites con el que eras ayer.",
  "Lo que haces hoy es lo que vas a ver en el espejo en diciembre.",
  "La motivación va y viene. El plan se queda.",
  "Pequeño, pero todos los días.",
  "Cuando dudes, haz el día mínimo. Nunca cero.",
  "No es un sprint. Es un arco. Y estás dentro.",
  "Hoy toca construir. Mañana lo agradeces.",
  "Si fuera fácil, todo el mundo tendría su Winter Arc.",
]

export function motivationFor(dateISO: string): string {
  const n = Math.floor(new Date(dateISO + "T00:00:00").getTime() / 86_400_000)
  return MOTIVATION[((n % MOTIVATION.length) + MOTIVATION.length) % MOTIVATION.length]
}

export const DONE_MESSAGES = [
  "Día cumplido. Así se construye.",
  "Otro ladrillo puesto. Mañana, el siguiente.",
  "Hecho. Eso es cumplirte a ti mismo.",
  "Día ganado. Disfrútalo y descansa.",
]

export function doneMessageFor(dateISO: string): string {
  return DONE_MESSAGES[Number(dateISO.slice(8, 10)) % DONE_MESSAGES.length]
}

// ---------- Recordatorios dentro de la app ----------
// Lo que toca según la hora del móvil y lo que aún no está marcado hoy.
// Funciona siempre (no depende del cron ni de las notificaciones push).
export type InAppReminder = { id: string; text: string }

export function inAppReminders(opts: {
  day: WinterArcDay | undefined
  hour: number
  isSunday: boolean
  weekReviewed: boolean
  sessionUp: string
}): InAppReminder[] {
  const checks = opts.day?.checks ?? []
  const has = (r: WinterArcRuleId) => checks.includes(r)
  const out: InAppReminder[] = []
  const h = opts.hour

  if (h < 11) {
    if (!has("movil")) out.push({ id: "movil-am", text: "Primera hora sin redes. Empieza el día tú, no el móvil." })
    if (!has("agua")) out.push({ id: "agua-am", text: "Primer vaso de agua, ya." })
    if (!has("sueno")) out.push({ id: "sueno", text: "¿Has dormido 7,5–8 h? Márcalo y fija la hora de levantarte." })
  } else if (h < 16) {
    if (!has("proteina")) out.push({ id: "proteina", text: "Mete proteína en la comida: huevos, pollo, atún, legumbres…" })
    if (!has("pasos")) out.push({ id: "pasos-md", text: "¿Cómo van los pasos? Una vuelta de 15 minutos." })
    if (!has("agua")) out.push({ id: "agua-md", text: "Rellena la botella. Llevas medio día." })
  } else if (h < 21) {
    if (!opts.day?.session) out.push({ id: "entreno", text: `Hoy toca ${opts.sessionUp}. Ropa puesta y 5 minutos; luego decides.` })
    if (!has("pasos")) out.push({ id: "pasos-pm", text: "Te faltan pasos. Sal a caminar antes de cenar." })
    if (!has("alcohol")) out.push({ id: "alcohol", text: "Plan de cena o de salir: agua con gas o cerveza sin alcohol." })
  } else {
    if (!has("lectura")) out.push({ id: "lectura", text: "10 páginas antes de dormir." })
    if (!has("movil")) out.push({ id: "movil-pm", text: "A las 22:00, fuera pantallas." })
    if (checks.length < DAY_TARGET) out.push({ id: "cierre", text: "Cierra el día: marca todo lo que has cumplido." })
  }

  if (opts.isSunday && !opts.weekReviewed && h >= 12) {
    out.unshift({ id: "domingo", text: "Revisión del domingo: peso, cintura y tirada larga. 15 minutos." })
  }
  return out.slice(0, 3)
}

// ---------- Recordatorios push (con el sistema de Recordatorios) ----------
// Se crean como automatizaciones normales de tipo "schedule", con este
// prefijo en el nombre para poder encontrarlas, apagarlas o encenderlas
// todas a la vez desde la sección Winter Arc.
export const PUSH_REMINDER_PREFIX = "Winter Arc · "

export const WINTER_ARC_PUSH_REMINDERS: {
  name: string
  frequency: "daily" | "weekly"
  weekday: number | null
  time: string
  title: string
  body: string
}[] = [
  { name: "Mañana", frequency: "daily", weekday: null, time: "08:00", title: "Winter Arc: buenos días", body: "Agua, proteína y nada de redes la primera hora. Hoy se cumple." },
  { name: "Mediodía", frequency: "daily", weekday: null, time: "13:00", title: "Winter Arc: mitad del día", body: "¿Pasos y proteína? Una vuelta de 15 minutos y comida con proteína." },
  { name: "Entreno", frequency: "daily", weekday: null, time: "18:00", title: "Winter Arc: hora de entrenar", body: "Mira en ZentOS qué sesión toca. Empieza 5 minutos y sigue." },
  { name: "Cierre", frequency: "daily", weekday: null, time: "21:30", title: "Winter Arc: cierra el día", body: "10 páginas, fuera pantallas a las 22:00 y marca tu día en ZentOS." },
  { name: "Domingo", frequency: "weekly", weekday: 0, time: "19:00", title: "Winter Arc: revisión del domingo", body: "Peso, cintura y tirada larga. 15 minutos para ajustar la semana." },
]
