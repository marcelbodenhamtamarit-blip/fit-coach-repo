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
import {
  supabase,
  type TransactionRow,
  type RecurringTransactionRow,
} from "./supabase"
import { useAuth } from "./use-auth"

// Get calendar week number from date
function getWeekNumber(date: Date): number {
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const dayOfWeek = jan4.getUTCDay()
  const week1Start = new Date(jan4)
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek)
  const diffDays = Math.floor((date.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000))
  return 1 + Math.floor(diffDays / 7)
}

// Get start of current week (Sunday)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

// Clave del periodo actual para una plantilla recurrente: "YYYY-MM" si es
// mensual, "YYYY-Www" si es semanal. Se usa para saber si ya se generó la
// transacción de este periodo y así no duplicarla.
function currentPeriodKey(frequency: RecurringFrequency): string {
  const today = todayISO()
  if (frequency === "weekly") {
    const weekNumber = getWeekNumber(new Date(today + "T00:00:00"))
    return `${today.slice(0, 4)}-W${weekNumber}`
  }
  return today.slice(0, 7)
}

// Fecha (yyyy-mm-dd) con la que se registra la transacción generada, según
// el "día de pago" configurado en la plantilla: para mensuales, ese día del
// mes actual (recortado al último día real si el mes es más corto, p.ej.
// día 31 en febrero); para semanales, ese día de la semana actual
// (0=domingo...6=sábado, empezando la semana el domingo como getWeekStart).
function periodStartDate(frequency: RecurringFrequency, payDay: number): string {
  const today = todayISO()
  if (frequency === "weekly") {
    const start = getWeekStart(new Date(today + "T00:00:00"))
    const target = new Date(start)
    target.setDate(start.getDate() + Math.min(Math.max(payDay, 0), 6))
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
}> {
  const DEFAULTS = { homeCurrency: "AUD", language: "es", travelMode: false, travelCurrency: null }

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return DEFAULTS

  const { data, error } = await supabase
    .from("user_preferences")
    .select("home_currency, language, travel_mode, travel_currency")
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
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("user_preferences")
    .insert({ user_id: userId })
    .select("home_currency, language, travel_mode, travel_currency")
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
  setLanguage: (code: string) => void
  setTravelMode: (active: boolean, currency: string) => void
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
  const runRecurringGeneration = async (recurringList: RecurringTransaction[]): Promise<Transaction[]> => {
    const due = recurringList.filter(
      (r) => r.active && r.lastCreatedPeriod !== currentPeriodKey(r.frequency),
    )
    if (due.length === 0) return []

    const created: Transaction[] = []
    for (const template of due) {
      const periodKey = currentPeriodKey(template.frequency)
      const { data: txRow, error: txError } = await supabase
        .from("transactions")
        .insert({
          date: periodStartDate(template.frequency, template.payDay),
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

      const createdThisPeriod = await runRecurringGeneration(fresh.recurring ?? [])
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
        setLanguage,
        setTravelMode,
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
