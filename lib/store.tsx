"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type {
  AppData,
  Transaction,
  RecurringTransaction,
  RecurringFrequency,
} from "./types"
import { todayISO, uid } from "./types"
import { translate, type Language, type TranslationKey } from "./i18n"
import { DEFAULT_WEEK_START_DAY, getWeekStart, getWeekNumberFromISO, offsetWithinWeek } from "./week"
import {
  supabase,
  type TransactionRow,
  type RecurringTransactionRow,
} from "./supabase"
import { useAuth } from "./use-auth"
import { getExchangeRates } from "./exchange-rates"

// Clave del periodo actual para una plantilla recurrente: "YYYY-MM" si es
// mensual, "YYYY-Www" si es semanal. Se usa para saber si ya se generó la
// transacción de este periodo y así no duplicarla. El número de semana
// depende de weekStartDay (Ajustes > Preferencias > Inicio de semana) —
// ver lib/week.ts.
function currentPeriodKey(frequency: RecurringFrequency, weekStartDay: number): string {
  const today = todayISO()
  if (frequency === "weekly") {
    const weekNumber = getWeekNumberFromISO(today, weekStartDay)
    return `${today.slice(0, 4)}-W${weekNumber}`
  }
  return today.slice(0, 7)
}

// Fecha (yyyy-mm-dd) con la que se registra la transacción generada, según
// el "día de pago" configurado en la plantilla: para mensuales, ese día del
// mes actual (recortado al último día real si el mes es más corto, p.ej.
// día 31 en febrero); para semanales, ese día de la semana actual
// (0=domingo...6=sábado, dentro de la semana que empieza en weekStartDay).
function periodStartDate(frequency: RecurringFrequency, payDay: number, weekStartDay: number): string {
  const today = todayISO()
  if (frequency === "weekly") {
    const start = getWeekStart(new Date(today + "T00:00:00"), weekStartDay)
    const target = new Date(start)
    const clampedPayDay = Math.min(Math.max(payDay, 0), 6)
    target.setDate(start.getDate() + offsetWithinWeek(clampedPayDay, weekStartDay))
    const y = target.getFullYear()
    const m = String(target.getMonth() + 1).padStart(2, "0")
    const d = String(target.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  const daysInMonth = new Date(y, m, 0).getDate()
  const day = String(Math.min(Math.max(payDay, 1), daysInMonth)).padStart(2, "0")
  return `${today.slice(0, 7)}-${day}`
}

const EMPTY_DATA: AppData = {
  transactions: [],
  recurring: [],
  homeCurrency: "AUD",
  language: "es",
  travelMode: false,
  travelCurrency: null,
  weekStartDay: DEFAULT_WEEK_START_DAY,
  shiftHourlyRate: 34.6,
  shiftTaxPct: 15,
}

// ---------- Supabase <-> app type mapping ----------

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category as Transaction["category"],
    amount: Number(row.amount),
    currency: row.currency ?? null,
    originalAmount: row.original_amount !== null && row.original_amount !== undefined ? Number(row.original_amount) : null,
  }
}

function rowToRecurring(row: RecurringTransactionRow): RecurringTransaction {
  return {
    id: row.id,
    description: row.description,
    category: row.category as RecurringTransaction["category"],
    amount: Number(row.amount),
    active: row.active,
    frequency: (row.frequency as RecurringTransaction["frequency"]) ?? "monthly",
    payDay: row.pay_day ?? (row.frequency === "weekly" ? 0 : 1),
    lastCreatedPeriod: row.last_created_month,
  }
}

// ---------- Fetchers ----------

async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })

  if (error) {
    console.error("[supabase] fetchTransactions error:", error.message)
    return []
  }
  return (data ?? []).map(rowToTransaction)
}

async function fetchRecurring(): Promise<RecurringTransaction[]> {
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[supabase] fetchRecurring error:", error.message)
    return []
  }
  return (data ?? []).map(rowToRecurring)
}

// Preferencias del usuario: divisa principal (para sumar/mostrar todos los
// totales), idioma de la interfaz, y modo viaje (divisa temporal para
// nuevas transacciones mientras está fuera de casa). Todas viven en la
// misma fila de user_preferences y se traen juntas en una sola consulta.
// Si el usuario todavía no tiene fila (primera vez), se crea con los
// valores por defecto que ya tiene la tabla (AUD / es / viaje desactivado).
async function fetchUserPreferences(): Promise<{
  homeCurrency: string
  language: string
  travelMode: boolean
  travelCurrency: string | null
  weekStartDay: number
  shiftHourlyRate: number
  shiftTaxPct: number
}> {
  const DEFAULTS = {
    homeCurrency: "AUD",
    language: "es",
    travelMode: false,
    travelCurrency: null,
    weekStartDay: DEFAULT_WEEK_START_DAY,
    shiftHourlyRate: 34.6,
    shiftTaxPct: 15,
  }

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return DEFAULTS

  const { data, error } = await supabase
    .from("user_preferences")
    .select("home_currency, language, travel_mode, travel_currency, week_start_day, shift_hourly_rate, shift_tax_pct")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[supabase] fetchUserPreferences error:", error.message)
    return DEFAULTS
  }
  if (data?.home_currency) {
    return {
      homeCurrency: data.home_currency,
      language: data.language ?? DEFAULTS.language,
      travelMode: data.travel_mode ?? DEFAULTS.travelMode,
      travelCurrency: data.travel_currency ?? DEFAULTS.travelCurrency,
      weekStartDay: data.week_start_day ?? DEFAULTS.weekStartDay,
      shiftHourlyRate: data.shift_hourly_rate ?? DEFAULTS.shiftHourlyRate,
      shiftTaxPct: data.shift_tax_pct ?? DEFAULTS.shiftTaxPct,
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("user_preferences")
    .insert({ user_id: userId })
    .select("home_currency, language, travel_mode, travel_currency, week_start_day, shift_hourly_rate, shift_tax_pct")
    .single()

  if (insertError) {
    console.error("[supabase] fetchUserPreferences insert error:", insertError.message)
    return DEFAULTS
  }
  return {
    homeCurrency: inserted?.home_currency ?? DEFAULTS.homeCurrency,
    language: inserted?.language ?? DEFAULTS.language,
    travelMode: inserted?.travel_mode ?? DEFAULTS.travelMode,
    travelCurrency: inserted?.travel_currency ?? DEFAULTS.travelCurrency,
    weekStartDay: inserted?.week_start_day ?? DEFAULTS.weekStartDay,
    shiftHourlyRate: inserted?.shift_hourly_rate ?? DEFAULTS.shiftHourlyRate,
    shiftTaxPct: inserted?.shift_tax_pct ?? DEFAULTS.shiftTaxPct,
  }
}

async function fetchAll(): Promise<AppData> {
  const [transactions, recurring, preferences] = await Promise.all([
    fetchTransactions(),
    fetchRecurring(),
    fetchUserPreferences(),
  ])
  return {
    transactions,
    recurring,
    homeCurrency: preferences.homeCurrency,
    language: preferences.language,
    travelMode: preferences.travelMode,
    travelCurrency: preferences.travelCurrency,
    weekStartDay: preferences.weekStartDay,
    shiftHourlyRate: preferences.shiftHourlyRate,
    shiftTaxPct: preferences.shiftTaxPct,
  }
}

type StoreContextType = {
  data: AppData
  ready: boolean
  addTransaction: (t: Omit<Transaction, "id">) => void
  addTransactions: (items: Omit<Transaction, "id">[]) => void
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, "id">>) => void
  deleteTransaction: (id: string) => void
  refreshTransactions: () => Promise<void>
  addRecurring: (r: Omit<RecurringTransaction, "id" | "lastCreatedPeriod">) => void
  updateRecurring: (id: string, updates: Partial<Omit<RecurringTransaction, "id" | "lastCreatedPeriod">>) => void
  deleteRecurring: (id: string) => void
  pendingReview: Transaction[]
  reviewOpen: boolean
  dismissReview: () => void
  setHomeCurrency: (code: string) => void
  // A diferencia de setHomeCurrency (que solo cambia la etiqueta a partir
  // de ahora), esto reconvierte de verdad todo lo ya guardado — cada
  // transacción y cada plantilla recurrente — de `fromCode` a `toCode`,
  // usando el tipo de cambio de hoy. Devuelve cuántas filas se
  // convirtieron y cuántas fallaron; solo actualiza la divisa principal si
  // no hubo ningún fallo.
  convertHomeCurrency: (
    fromCode: string,
    toCode: string,
  ) => Promise<{ transactionsConverted: number; recurringConverted: number; failed: number }>
  setLanguage: (code: string) => void
  setTravelMode: (active: boolean, currency: string) => void
  setWeekStartDay: (day: number) => void
  setShiftHourlyRate: (rate: number) => void
  setShiftTaxPct: (pct: number) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const [data, setData] = useState<AppData>(EMPTY_DATA)
  const [ready, setReady] = useState(false)
  const [pendingReview, setPendingReview] = useState<Transaction[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)

  // Revisa las plantillas de gastos/ingresos recurrentes activas y, para las
  // que no tengan ya creada su transacción de este periodo (mes o semana,
  // según su frecuencia), la crea y marca la plantilla como generada.
  // Devuelve las transacciones nuevas para poder mostrarlas en un popup de
  // revisión.
  const runRecurringGeneration = async (
    recurringList: RecurringTransaction[],
    weekStartDay: number,
  ): Promise<Transaction[]> => {
    const due = recurringList.filter(
      (r) => r.active && r.lastCreatedPeriod !== currentPeriodKey(r.frequency, weekStartDay),
    )
    if (due.length === 0) return []

    const created: Transaction[] = []
    for (const template of due) {
      const periodKey = currentPeriodKey(template.frequency, weekStartDay)
      const { data: txRow, error: txError } = await supabase
        .from("transactions")
        .insert({
          date: periodStartDate(template.frequency, template.payDay, weekStartDay),
          description: template.description,
          category: template.category,
          amount: template.amount,
        })
        .select()
        .single()

      if (txError || !txRow) {
        console.error("[supabase] runRecurringGeneration insert transaction error:", txError?.message)
        continue
      }

      const { error: updateError } = await supabase
        .from("recurring_transactions")
        .update({ last_created_month: periodKey })
        .eq("id", template.id)

      if (updateError) {
        console.error("[supabase] runRecurringGeneration update template error:", updateError.message)
      }

      created.push(rowToTransaction(txRow))
    }

    return created
  }

  // Load everything from Supabase una vez que useAuth() confirma la sesión
  // (mode === "in"). Antes esto se disparaba nada más montar el
  // componente, sin esperar a que se restaurase la sesión guardada — al
  // recargar la página, Supabase tarda un poco en recuperarla de forma
  // asíncrona, así que esta carga a veces se adelantaba y llamaba a
  // fetchUserPreferences() (y al resto de fetch*) sin usuario todavía
  // disponible, devolviendo los valores por defecto (AUD, es...) en vez de
  // los guardados — y como el efecto solo se ejecutaba una vez al montar,
  // nunca se reintentaba, así que la app se quedaba con esos valores por
  // defecto hasta el siguiente recargado (donde podía volver a pasar lo
  // mismo). Ahora se espera a que useAuth() confirme sesión antes de pedir
  // nada, y se vuelve a cargar si cambia de usuario (login/logout).
  useEffect(() => {
    if (mode !== "in") {
      if (mode === "out") {
        setData(EMPTY_DATA)
        setReady(false)
      }
      return
    }

    let cancelled = false

    async function load() {
      const fresh = await fetchAll()
      if (cancelled) return
      setData(fresh)
      setReady(true)

      const createdThisPeriod = await runRecurringGeneration(fresh.recurring ?? [], fresh.weekStartDay)
      if (cancelled) return
      if (createdThisPeriod.length > 0) {
        const [transactions, recurring] = await Promise.all([fetchTransactions(), fetchRecurring()])
        if (cancelled) return
        setData((d) => ({ ...d, transactions, recurring }))
        setPendingReview(createdThisPeriod)
        setReviewOpen(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [mode, user?.id])

  const refreshTransactions = async () => {
    const transactions = await fetchTransactions()
    setData((d) => ({ ...d, transactions }))
  }

  const refreshRecurring = async () => {
    const recurring = await fetchRecurring()
    setData((d) => ({ ...d, recurring }))
  }

  const dismissReview = () => {
    setReviewOpen(false)
    setPendingReview([])
  }

  const setHomeCurrency = (code: string) => {
    setData((d) => ({ ...d, homeCurrency: code }))

    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, home_currency: code })
      if (error) {
        console.error("[supabase] setHomeCurrency error:", error.message)
      }
    })()
  }

  // Reconversión real de todo lo guardado al cambiar de divisa principal
  // "para siempre" (distinto de modo viaje, que es temporal y nunca toca
  // datos ya guardados — ver setTravelMode). `amount` de cada transacción
  // y cada plantilla recurrente queda siempre en home_currency, así que
  // cambiar la divisa sin recalcular esos números dejaría el mismo número
  // con un símbolo distinto (p.ej. $100 pasaría a mostrarse como "€100" en
  // vez de convertirse a ~€61). Esto recalcula cada número con el tipo de
  // cambio de hoy antes de guardar la nueva divisa principal.
  //
  // Para las transacciones que ya se registraron en otra divisa distinta
  // de la principal (currency/originalAmount presentes — p.ej. un gasto en
  // EUR hecho en modo viaje), se reconvierte directamente desde esa divisa
  // original a la nueva, que es más preciso que pasar por la divisa
  // principal antigua. Para el resto, se convierte de la antigua divisa
  // principal a la nueva.
  //
  // Limitación conocida: lib/exchange-rates.ts no guarda tipos de cambio
  // históricos por fecha, solo el de "hoy" — así que esto usa el tipo de
  // cambio actual para todo el historial, no el que había el día de cada
  // transacción. Es una aproximación, pero muchísimo más correcta que solo
  // cambiar el símbolo.
  const convertHomeCurrency = async (
    fromCode: string,
    toCode: string,
  ): Promise<{ transactionsConverted: number; recurringConverted: number; failed: number }> => {
    const to = toCode.toUpperCase()

    // BUG CORREGIDO (20 oct 2026): antes `from` se tomaba tal cual del
    // estado local (`data.homeCurrency`), que puede estar desfasado —por
    // ejemplo si la pantalla se recargó a mitad de una conversión anterior
    // antes de que terminara de guardar, o si se pulsó "Confirmar" dos
    // veces porque la primera vez pareció no haberse guardado—. Como cada
    // transacción sin `currency` propio se reconvertía a partir de su
    // `amount` actual (ya mutado por la conversión anterior, no de un
    // importe original estable), repetir la llamada con un `from` que ya
    // no era real volvía a aplicar el cambio sobre números que ya estaban
    // convertidos, encogiéndolos de nuevo. Para que esto sea imposible,
    // ahora se relee la divisa principal real desde Supabase (nunca el
    // estado local) justo antes de convertir, y si ya coincide con `to` no
    // se toca ni un importe: se trata como éxito inmediato (ya estaba
    // hecho) en vez de volver a correr la conversión.
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      throw new Error("No hay sesión activa")
    }
    const { data: prefsRow, error: prefsError } = await supabase
      .from("user_preferences")
      .select("home_currency")
      .eq("user_id", userId)
      .maybeSingle()
    if (prefsError) {
      throw new Error(`No se pudo confirmar la divisa actual: ${prefsError.message}`)
    }
    const actualFrom = (prefsRow?.home_currency ?? fromCode).toUpperCase()

    if (actualFrom === to) {
      // Ya está en la divisa pedida de verdad (servidor), aunque la
      // pantalla todavía mostrara la antigua: solo sincroniza el estado
      // local, sin recalcular ni un importe.
      setHomeCurrency(toCode)
      return { transactionsConverted: 0, recurringConverted: 0, failed: 0 }
    }

    const from = actualFrom

    // Tasas necesarias: la divisa principal antigua, y cada divisa distinta
    // en la que haya alguna transacción guardada con su importe original.
    const neededBases = new Set<string>([from])
    for (const tx of data.transactions) {
      if (tx.currency) neededBases.add(tx.currency.toUpperCase())
    }

    const ratesByBase: Record<string, Record<string, number>> = {}
    for (const base of neededBases) {
      if (base === to) continue
      ratesByBase[base] = await getExchangeRates(base, supabase)
    }

    function rateFrom(base: string): number {
      const b = base.toUpperCase()
      if (b === to) return 1
      const rate = ratesByBase[b]?.[to]
      if (typeof rate !== "number" || !isFinite(rate)) {
        throw new Error(`No hay tipo de cambio de ${b} a ${to}`)
      }
      return rate
    }

    const txUpdates = data.transactions.map((tx) => {
      const base = tx.currency ?? from
      const sourceAmount = tx.currency && tx.originalAmount != null ? tx.originalAmount : tx.amount
      return { id: tx.id, newAmount: sourceAmount * rateFrom(base) }
    })
    const recUpdates = data.recurring.map((r) => ({ id: r.id, newAmount: r.amount * rateFrom(from) }))

    const CHUNK_SIZE = 25
    async function applyUpdates(
      table: "transactions" | "recurring_transactions",
      updates: { id: string; newAmount: number }[],
    ): Promise<number> {
      let failed = 0
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE)
        const results = await Promise.all(
          chunk.map(({ id, newAmount }) => supabase.from(table).update({ amount: newAmount }).eq("id", id)),
        )
        for (const r of results) {
          if (r.error) {
            console.error(`[supabase] convertHomeCurrency ${table} update error:`, r.error.message)
            failed++
          }
        }
      }
      return failed
    }

    const txFailed = await applyUpdates("transactions", txUpdates)
    const recFailed = await applyUpdates("recurring_transactions", recUpdates)

    // Solo se actualiza la divisa principal si no hubo ningún fallo, para
    // no dejar la app mostrando una divisa nueva con números a medio
    // convertir.
    //
    // BUG CORREGIDO (25 oct 2026): esto llamaba antes a `setHomeCurrency`,
    // que guarda en Supabase en segundo plano sin esperar el resultado (ver
    // su propia definición) — por eso el guard de arriba, aunque relee la
    // divisa real de la base de datos, podía seguir leyendo la antigua si
    // ese guardado en segundo plano no había terminado (o había fallado en
    // silencio) cuando se disparó una segunda conversión. Eso fue justo lo
    // que volvió a duplicar la conversión AUD→EUR de todo el historial
    // entre el 20 y el 22 de oct 2026: los importes ya convertidos se
    // reconvirtieron porque `home_currency` seguía leyendo "AUD" en el
    // servidor. Aquí se guarda de forma síncrona (con `await`) y solo se
    // da la conversión por buena si ese guardado se confirma; si falla, se
    // lanza en vez de devolver éxito, para que la pantalla avise en vez de
    // dejar la puerta abierta a que se repita esto una tercera vez.
    if (txFailed === 0 && recFailed === 0) {
      const { error: prefsUpdateError } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, home_currency: toCode })
      if (prefsUpdateError) {
        console.error("[supabase] convertHomeCurrency home_currency update error:", prefsUpdateError.message)
        throw new Error(
          "Los importes ya se convirtieron, pero no se pudo guardar la nueva divisa principal. Vuelve a intentarlo antes de seguir usando la app, o los números y la divisa mostrada quedarán desincronizados.",
        )
      }
      setData((d) => ({ ...d, homeCurrency: toCode }))
    }

    setData((d) => ({
      ...d,
      transactions: d.transactions.map((tx) => {
        const match = txUpdates.find((u) => u.id === tx.id)
        return match ? { ...tx, amount: match.newAmount } : tx
      }),
      recurring: d.recurring.map((r) => {
        const match = recUpdates.find((u) => u.id === r.id)
        return match ? { ...r, amount: match.newAmount } : r
      }),
    }))

    return {
      transactionsConverted: txUpdates.length - txFailed,
      recurringConverted: recUpdates.length - recFailed,
      failed: txFailed + recFailed,
    }
  }

  const setLanguage = (code: string) => {
    setData((d) => ({ ...d, language: code }))

    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, language: code })
      if (error) {
        console.error("[supabase] setLanguage error:", error.message)
      }
    })()
  }

  // Modo viaje: al activarlo, los formularios de nueva transacción (normal
  // y recurrente) empiezan a usar `currency` como divisa por defecto en vez
  // de homeCurrency. Se guarda travelCurrency incluso al desactivarlo, para
  // que la próxima vez que se active recuerde la última divisa usada.
  const setTravelMode = (active: boolean, currency: string) => {
    setData((d) => ({ ...d, travelMode: active, travelCurrency: currency }))

    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, travel_mode: active, travel_currency: currency })
      if (error) {
        console.error("[supabase] setTravelMode error:", error.message)
      }
    })()
  }

  // Inicio de semana (Ajustes > Preferencias): 0=domingo...6=sábado. Afecta
  // a "Semana N" en Economía/Resumen, al ahorro semanal y al recordatorio
  // de "ahorro semanal" (ver lib/week.ts) — no reordena ni reescribe
  // transacciones ya guardadas, solo cambia dónde se cortan las semanas a
  // partir de ahora.
  const setWeekStartDay = (day: number) => {
    setData((d) => ({ ...d, weekStartDay: day }))

    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, week_start_day: day })
      if (error) {
        console.error("[supabase] setWeekStartDay error:", error.message)
      }
    })()
  }

  // Tarifa por hora del turno normal (Ajustes > Turnos). Sábado y domingo
  // no se guardan aparte: se calculan multiplicando esta misma tarifa por
  // SHIFT_RATE_MULTIPLIER (ver lib/types.ts).
  const setShiftHourlyRate = (rate: number) => {
    setData((d) => ({ ...d, shiftHourlyRate: rate }))

    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, shift_hourly_rate: rate })
      if (error) {
        console.error("[supabase] setShiftHourlyRate error:", error.message)
      }
    })()
  }

  // % de impuestos a estimar al marcar un turno como cobrado (Ajustes >
  // Turnos). No hay un número exacto único válido para todo el mundo (ver
  // el aviso de esa tarjeta), así que esto es siempre un valor editable a
  // mano, nunca calculado en automático por tipo de visa.
  const setShiftTaxPct = (pct: number) => {
    setData((d) => ({ ...d, shiftTaxPct: pct }))

    ;(async () => {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, shift_tax_pct: pct })
      if (error) {
        console.error("[supabase] setShiftTaxPct error:", error.message)
      }
    })()
  }

  // Traduce una clave del diccionario (ver lib/i18n.ts) al idioma actual
  // del usuario. Envuelto aquí para que todos los componentes lo saquen
  // del mismo sitio que el resto del estado (useStore()), sin tener que
  // leer data.language y llamar a translate() por su cuenta cada vez.
  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(key, (data.language as Language) ?? "es", params)

  // ---------- Transactions ----------

  const addTransaction = (t: Omit<Transaction, "id">) => {
    const optimisticId = uid()
    setData((d) => ({
      ...d,
      transactions: [{ ...t, id: optimisticId }, ...(d.transactions ?? [])].sort(
        (a, b) => b.date.localeCompare(a.date),
      ),
    }))

    supabase
      .from("transactions")
      .insert({
        date: t.date,
        description: t.description,
        category: t.category,
        amount: t.amount,
        currency: t.currency ?? null,
        original_amount: t.originalAmount ?? null,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] addTransaction error:", error.message)
        }
        refreshTransactions()
      })
  }

  // Alta en lote: mismo patrón que addTransaction (optimista + insert +
  // refresh), pero insertando todas las filas en una sola llamada a
  // Supabase en vez de una por transacción — pensado para cuando vuelves
  // de un viaje y tienes muchos movimientos sueltos que registrar de
  // golpe (ver components/batch-add-dialog.tsx).
  const addTransactions = (items: Omit<Transaction, "id">[]) => {
    if (items.length === 0) return
    const optimistic = items.map((t) => ({ ...t, id: uid() }))
    setData((d) => ({
      ...d,
      transactions: [...optimistic, ...(d.transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    }))

    supabase
      .from("transactions")
      .insert(
        items.map((t) => ({
          date: t.date,
          description: t.description,
          category: t.category,
          amount: t.amount,
          currency: t.currency ?? null,
          original_amount: t.originalAmount ?? null,
        })),
      )
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] addTransactions error:", error.message)
        }
        refreshTransactions()
      })
  }

  const updateTransaction = (id: string, updates: Partial<Omit<Transaction, "id">>) => {
    setData((d) => ({
      ...d,
      transactions: (d.transactions ?? [])
        .map((t) => (t.id === id ? { ...t, ...updates } : t))
        .sort((a, b) => b.date.localeCompare(a.date)),
    }))

          const updatePayload: Record<string, string | number | null> = {}
    if (updates.date !== undefined) updatePayload.date = updates.date
    if (updates.description !== undefined) updatePayload.description = updates.description
    if (updates.category !== undefined) updatePayload.category = updates.category
    if (updates.amount !== undefined) updatePayload.amount = updates.amount
    if (updates.currency !== undefined) updatePayload.currency = updates.currency
    if (updates.originalAmount !== undefined) updatePayload.original_amount = updates.originalAmount

    supabase
    .from("transactions")
    .update(updatePayload)
    .eq("id", id)
    .then(({ error }) => {
      if (error) {
        console.error("[supabase] updateTransaction error:", error.message)
      }
      refreshTransactions()
    })
  }

  const deleteTransaction = (id: string) => {
    setData((d) => ({
      ...d,
      transactions: (d.transactions ?? []).filter((x) => x.id !== id),
    }))

    supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] deleteTransaction error:", error.message)
        }
        refreshTransactions()
      })
  }

  // ---------- Gastos/ingresos recurrentes ----------

  const addRecurring = (r: Omit<RecurringTransaction, "id" | "lastCreatedPeriod">) => {
    const optimisticId = uid()
    setData((d) => ({
      ...d,
      recurring: [{ ...r, id: optimisticId, lastCreatedPeriod: null }, ...(d.recurring ?? [])],
    }))

    supabase
      .from("recurring_transactions")
      .insert({
        description: r.description,
        category: r.category,
        amount: r.amount,
        active: r.active,
        frequency: r.frequency,
        pay_day: r.payDay,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] addRecurring error:", error.message)
        }
        refreshRecurring()
      })
  }

  const updateRecurring = (
    id: string,
    updates: Partial<Omit<RecurringTransaction, "id" | "lastCreatedPeriod">>,
  ) => {
    setData((d) => ({
      ...d,
      recurring: (d.recurring ?? []).map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }))

    const updatePayload: Record<string, string | number | boolean> = {}
    if (updates.description !== undefined) updatePayload.description = updates.description
    if (updates.category !== undefined) updatePayload.category = updates.category
    if (updates.amount !== undefined) updatePayload.amount = updates.amount
    if (updates.active !== undefined) updatePayload.active = updates.active
    if (updates.frequency !== undefined) updatePayload.frequency = updates.frequency
    if (updates.payDay !== undefined) updatePayload.pay_day = updates.payDay

    supabase
      .from("recurring_transactions")
      .update(updatePayload)
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] updateRecurring error:", error.message)
        }
        refreshRecurring()
      })
  }

  const deleteRecurring = (id: string) => {
    setData((d) => ({
      ...d,
      recurring: (d.recurring ?? []).filter((r) => r.id !== id),
    }))

    supabase
      .from("recurring_transactions")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] deleteRecurring error:", error.message)
        }
        refreshRecurring()
      })
  }

  return (
    <StoreContext.Provider
      value={{
        data,
        ready,
        addTransaction,
        addTransactions,
        updateTransaction,
        deleteTransaction,
        refreshTransactions,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        pendingReview,
        reviewOpen,
        dismissReview,
        setHomeCurrency,
        convertHomeCurrency,
        setLanguage,
        setTravelMode,
        setWeekStartDay,
        setShiftHourlyRate,
        setShiftTaxPct,
        t,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
