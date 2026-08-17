"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react"
import type {
  AppData,
  BodyMetric,
  Meal,
  Ingredient,
  PantryItem,
  Profile,
  Transaction,
  RecurringTransaction,
  RecurringFrequency,
} from "./types"
import { todayISO, uid } from "./types"
import {
  supabase,
  type TransactionRow,
  type ProfileRow,
  type PantryItemRow,
  type BodyMetricRow,
  type MealRow,
  type MealIngredientRow,
  type RecurringTransactionRow,
} from "./supabase"

const SUPERMARKET_CATEGORIES = ["Supermercado", "Comida Supermercado", "MENJAR SUPER", "COMIDA SUPER", "Menjar super", "Menjar SUPER"]

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

// Fecha (yyyy-mm-dd) con la que se registra la transacción generada:
// el día 1 del mes para las mensuales, el domingo de esta semana para las
// semanales.
function periodStartDate(frequency: RecurringFrequency): string {
  const today = todayISO()
  if (frequency === "weekly") {
    const start = getWeekStart(new Date(today + "T00:00:00"))
    const y = start.getFullYear()
    const m = String(start.getMonth() + 1).padStart(2, "0")
    const d = String(start.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  return `${today.slice(0, 7)}-01`
}

const EMPTY_DATA: AppData = {
  profile: { name: "Marcel", calorieGoal: 2400, proteinGoal: 170, weightGoal: 80 },
  meals: [],
  metrics: [],
  pantry: [],
  transactions: [],
  recurring: [],
}

// ---------- Supabase <-> app type mapping ----------

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category as Transaction["category"],
    amount: Number(row.amount),
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
    lastCreatedPeriod: row.last_created_month,
  }
}

function rowToProfile(row: ProfileRow): Profile {
  return {
    name: row.name,
    calorieGoal: Number(row.calorie_goal),
    proteinGoal: Number(row.protein_goal),
    weightGoal: Number(row.weight_goal),
  }
}

function rowToPantryItem(row: PantryItemRow): PantryItem {
  return {
    id: row.id,
    name: row.name,
    quantityGrams: Number(row.quantity_grams),
    caloriesPer100g: Number(row.calories_per_100g),
    proteinPer100g: Number(row.protein_per_100g),
    carbsPer100g: Number(row.carbs_per_100g),
    fatPer100g: Number(row.fat_per_100g),
    pricePerKg: Number(row.price_per_kg),
    dateAdded: row.date_added,
    woolworthsUrl: row.woolworths_url ?? undefined,
  }
}

function rowToBodyMetric(row: BodyMetricRow): BodyMetric {
  return {
    id: row.id,
    date: row.date,
    weight: Number(row.weight),
    bodyFat: row.body_fat == null ? 0 : Number(row.body_fat),
    waist: row.waist == null ? 0 : Number(row.waist),
  }
}

function rowToMeal(row: MealRow, ingredientRows: MealIngredientRow[]): Meal {
  const ingredients: Ingredient[] = ingredientRows
    .filter((i) => i.meal_id === row.id)
    .map((i) => ({
      id: i.id,
      name: i.name,
      quantity: Number(i.quantity_grams),
      caloriesPer100g: Number(i.calories_per_100g),
      proteinPer100g: Number(i.protein_per_100g),
      carbsPer100g: Number(i.carbs_per_100g),
      fatPer100g: Number(i.fat_per_100g),
      pricePerKg: Number(i.price_per_kg),
      woolworthsUrl: i.woolworths_url ?? undefined,
    }))

  return {
    id: row.id,
    date: row.date,
    ingredients,
    totalCalories: Number(row.total_calories),
    totalProtein: Number(row.total_protein),
    totalCarbs: Number(row.total_carbs),
    totalFat: Number(row.total_fat),
    totalCost: Number(row.total_cost),
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

async function fetchProfile(): Promise<Profile> {
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("id", 1)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error("[supabase] fetchProfile error:", error.message)
    return EMPTY_DATA.profile
  }
  return rowToProfile(data)
}

async function fetchPantry(): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from("pantry_items")
    .select("*")
    .order("date_added", { ascending: false })

  if (error) {
    console.error("[supabase] fetchPantry error:", error.message)
    return []
  }
  return (data ?? []).map(rowToPantryItem)
}

async function fetchMetrics(): Promise<BodyMetric[]> {
  const { data, error } = await supabase
    .from("body_metrics")
    .select("*")
    .order("date", { ascending: false })

  if (error) {
    console.error("[supabase] fetchMetrics error:", error.message)
    return []
  }
  return (data ?? []).map(rowToBodyMetric)
}

async function fetchMeals(): Promise<Meal[]> {
  const { data: mealRows, error: mealsError } = await supabase
    .from("meals")
    .select("*")
    .order("date", { ascending: false })

  if (mealsError) {
    console.error("[supabase] fetchMeals error:", mealsError.message)
    return []
  }

  const ids = (mealRows ?? []).map((m) => m.id)
  if (ids.length === 0) return []

  const { data: ingredientRows, error: ingError } = await supabase
    .from("meal_ingredients")
    .select("*")
    .in("meal_id", ids)

  if (ingError) {
    console.error("[supabase] fetchMeals ingredients error:", ingError.message)
  }

  return (mealRows ?? []).map((m) => rowToMeal(m, ingredientRows ?? []))
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

async function fetchAll(): Promise<AppData> {
  const [profile, meals, metrics, pantry, transactions, recurring] = await Promise.all([
    fetchProfile(),
    fetchMeals(),
    fetchMetrics(),
    fetchPantry(),
    fetchTransactions(),
    fetchRecurring(),
  ])
  return { profile, meals, metrics, pantry, transactions, recurring }
}

type WeeklySupermarketState = {
  thisWeekTotal: number
  weekNumber: number
  lastSubmittedWeek: number | null
  lastSubmittedDate: string | null
}

type StoreContextType = {
  data: AppData
  ready: boolean
  weeklySupermarket: WeeklySupermarketState
  addMeal: (meal: Omit<Meal, "id">) => void
  updateMetric: (metric: Omit<BodyMetric, "id">) => void
  addTransaction: (t: Omit<Transaction, "id">) => void
  updateTransaction: (id: string, updates: Partial<Omit<Transaction, "id">>) => void
  importTransactions: (txs: Omit<Transaction, "id">[]) => void
  clearTransactions: () => void
  deleteTransaction: (id: string) => void
  addPantryItem: (item: Omit<PantryItem, "id" | "dateAdded">) => void
  removePantryItem: (id: string, quantityUsed: number) => void
  updateProfileGoals: (goals: Partial<Profile>) => void
  markSupermarketSubmitted: (week: number, date: string) => void
  refreshTransactions: () => Promise<void>
  refreshAll: () => Promise<void>
  addRecurring: (r: Omit<RecurringTransaction, "id" | "lastCreatedPeriod">) => void
  updateRecurring: (id: string, updates: Partial<Omit<RecurringTransaction, "id" | "lastCreatedPeriod">>) => void
  deleteRecurring: (id: string) => void
  pendingReview: Transaction[]
  reviewOpen: boolean
  dismissReview: () => void
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA)
  const [ready, setReady] = useState(false)
  const [weeklySupermarket, setWeeklySupermarket] = useState<WeeklySupermarketState>({
    thisWeekTotal: 0,
    weekNumber: 0,
    lastSubmittedWeek: null,
    lastSubmittedDate: null,
  })
  const submittedWeeksRef = useRef<Set<number>>(new Set())
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
          date: periodStartDate(template.frequency),
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

  // Load everything from Supabase on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      const fresh = await fetchAll()
      if (cancelled) return
      setData(fresh)

      const submittedStored = localStorage.getItem("marcel-supermarket-submitted")
      if (submittedStored) {
        try {
          const parsed = JSON.parse(submittedStored)
          if (Array.isArray(parsed)) {
            submittedWeeksRef.current = new Set(parsed)
          }
        } catch {}
      }

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
  }, [])

  const refreshTransactions = async () => {
    const transactions = await fetchTransactions()
    setData((d) => ({ ...d, transactions }))
  }

  const refreshRecurring = async () => {
    const recurring = await fetchRecurring()
    setData((d) => ({ ...d, recurring }))
  }

  const refreshAll = async () => {
    const fresh = await fetchAll()
    setData(fresh)
  }

  const dismissReview = () => {
    setReviewOpen(false)
    setPendingReview([])
  }

  // Calculate weekly supermarket total and handle Saturday summary
  useEffect(() => {
    if (!ready) return

    const calculateWeeklyTotal = () => {
      const now = new Date()
      const weekStart = getWeekStart(now)
      const weekNumber = getWeekNumber(now)

      const weekTransactions = (data.transactions ?? []).filter((t) => {
        const txDate = new Date(t.date + "T00:00:00")
        return txDate >= weekStart && SUPERMARKET_CATEGORIES.some((cat) =>
          t.category.toLowerCase().includes(cat.toLowerCase()) || cat.toLowerCase().includes(t.category.toLowerCase())
        )
      })

      const total = weekTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)

      setWeeklySupermarket((prev) => ({
        ...prev,
        thisWeekTotal: total,
        weekNumber,
      }))

      return { total, weekNumber }
    }

    calculateWeeklyTotal()

    const interval = setInterval(() => {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const hours = now.getHours()
      const minutes = now.getMinutes()

      if (dayOfWeek === 6 && hours === 23 && minutes >= 45 && minutes <= 59) {
        const { total, weekNumber } = calculateWeeklyTotal()

        if (!submittedWeeksRef.current.has(weekNumber) && total > 0) {
          const saturdayDate = todayISO()
          submittedWeeksRef.current.add(weekNumber)
          localStorage.setItem("marcel-supermarket-submitted", JSON.stringify([...submittedWeeksRef.current]))

          setWeeklySupermarket((prev) => ({
            ...prev,
            lastSubmittedWeek: weekNumber,
            lastSubmittedDate: saturdayDate,
          }))
        }
      }

      if (dayOfWeek === 0 && hours === 0 && minutes === 1) {
        calculateWeeklyTotal()
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [data.transactions, ready])

  // ---------- Meals ----------

  const addMeal = (meal: Omit<Meal, "id">) => {
    const optimisticId = uid()
    setData((d) => ({
      ...d,
      meals: [{ ...meal, id: optimisticId }, ...(d.meals ?? [])],
    }))

    ;(async () => {
      const { data: mealRow, error: mealError } = await supabase
        .from("meals")
        .insert({
          date: meal.date,
          total_calories: meal.totalCalories,
          total_protein: meal.totalProtein,
          total_carbs: meal.totalCarbs,
          total_fat: meal.totalFat,
          total_cost: meal.totalCost,
        })
        .select()
        .single()

      if (mealError || !mealRow) {
        console.error("[supabase] addMeal error:", mealError?.message)
        return
      }

      if (meal.ingredients.length > 0) {
        const ingredientRows = meal.ingredients.map((ing) => ({
          meal_id: mealRow.id,
          name: ing.name,
          quantity_grams: ing.quantity,
          calories_per_100g: ing.caloriesPer100g,
          protein_per_100g: ing.proteinPer100g,
          carbs_per_100g: ing.carbsPer100g,
          fat_per_100g: ing.fatPer100g,
          price_per_kg: ing.pricePerKg,
          woolworths_url: ing.woolworthsUrl ?? null,
        }))

        const { error: ingError } = await supabase.from("meal_ingredients").insert(ingredientRows)
        if (ingError) {
          console.error("[supabase] addMeal ingredients error:", ingError.message)
        }
      }

      const meals = await fetchMeals()
      setData((d) => ({ ...d, meals }))
    })()
  }

  // ---------- Body metrics ----------

  const updateMetric = (metric: Omit<BodyMetric, "id">) => {
    setData((d) => {
      const today = todayISO()
      const existingIndex = (d.metrics ?? []).findIndex((m) => m.date === today)
      let updated: BodyMetric[]
      if (existingIndex >= 0) {
        updated = [...(d.metrics ?? [])]
        updated[existingIndex] = { ...metric, id: d.metrics![existingIndex].id }
      } else {
        updated = [{ ...metric, id: uid() }, ...(d.metrics ?? [])]
      }
      return { ...d, metrics: updated }
    })

    ;(async () => {
      const { error } = await supabase
        .from("body_metrics")
        .upsert(
          {
            date: metric.date,
            weight: metric.weight,
            body_fat: metric.bodyFat,
            waist: metric.waist,
          },
          { onConflict: "date" },
        )

      if (error) {
        console.error("[supabase] updateMetric error:", error.message)
      }

      const metrics = await fetchMetrics()
      setData((d) => ({ ...d, metrics }))
    })()
  }

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
      })
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] addTransaction error:", error.message)
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

          const updatePayload: Record<string, string | number> = {}
    if (updates.date !== undefined) updatePayload.date = updates.date
    if (updates.description !== undefined) updatePayload.description = updates.description
    if (updates.category !== undefined) updatePayload.category = updates.category
    if (updates.amount !== undefined) updatePayload.amount = updates.amount

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

  const importTransactions = (txs: Omit<Transaction, "id">[]) => {
    if (txs.length === 0) return

    setData((d) => {
      const newTransactions = txs.map((t) => ({ ...t, id: uid() }))
      const allTransactions = [...newTransactions, ...(d.transactions ?? [])]
      const seen = new Set<string>()
      const unique: Transaction[] = []
      for (const t of allTransactions) {
        const key = `${t.date}-${t.category}-${t.amount}`
        if (!seen.has(key)) {
          seen.add(key)
          unique.push(t)
        }
      }
      return {
        ...d,
        transactions: unique.sort((a, b) => b.date.localeCompare(a.date)),
      }
    })

    ;(async () => {
      const { data: existingRows, error: fetchError } = await supabase
        .from("transactions")
        .select("date, category, amount")

      if (fetchError) {
        console.error("[supabase] importTransactions fetch error:", fetchError.message)
        return
      }

      const existingKeys = new Set(
        (existingRows ?? []).map((r) => `${r.date}-${r.category}-${Number(r.amount)}`),
      )

      const rowsToInsert = txs
        .filter((t) => !existingKeys.has(`${t.date}-${t.category}-${t.amount}`))
        .map((t) => ({
          date: t.date,
          description: t.description,
          category: t.category,
          amount: t.amount,
        }))

      if (rowsToInsert.length === 0) {
        await refreshTransactions()
        return
      }

      const { error: insertError } = await supabase.from("transactions").insert(rowsToInsert)
      if (insertError) {
        console.error("[supabase] importTransactions insert error:", insertError.message)
      }
      await refreshTransactions()
    })()
  }

  const clearTransactions = () => {
    setData((d) => ({
      ...d,
      transactions: [],
    }))

    supabase
      .from("transactions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] clearTransactions error:", error.message)
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

  // ---------- Pantry ----------

  const addPantryItem = (item: Omit<PantryItem, "id" | "dateAdded">) => {
    const optimisticId = uid()
    const dateAdded = todayISO()
    setData((d) => ({
      ...d,
      pantry: [
        { ...item, id: optimisticId, dateAdded },
        ...(d.pantry ?? []),
      ],
    }))

    supabase
      .from("pantry_items")
      .insert({
        name: item.name,
        quantity_grams: item.quantityGrams,
        calories_per_100g: item.caloriesPer100g,
        protein_per_100g: item.proteinPer100g,
        carbs_per_100g: item.carbsPer100g,
        fat_per_100g: item.fatPer100g,
        price_per_kg: item.pricePerKg,
        woolworths_url: item.woolworthsUrl ?? null,
        date_added: dateAdded,
      })
      .then(async ({ error }) => {
        if (error) {
          console.error("[supabase] addPantryItem error:", error.message)
        }
        const pantry = await fetchPantry()
        setData((d) => ({ ...d, pantry }))
      })
  }

  const removePantryItem = (id: string, quantityUsed: number) => {
    setData((d) => {
      const item = (d.pantry ?? []).find((p) => p.id === id)
      if (!item) return d
      const remaining = item.quantityGrams - quantityUsed
      if (remaining <= 0) {
        return {
          ...d,
          pantry: (d.pantry ?? []).filter((p) => p.id !== id),
        }
      }
      return {
        ...d,
        pantry: (d.pantry ?? []).map((p) =>
          p.id === id ? { ...p, quantityGrams: remaining } : p,
        ),
      }
    })

    ;(async () => {
      const item = (data.pantry ?? []).find((p) => p.id === id)
      const remaining = item ? item.quantityGrams - quantityUsed : 0

      if (!item || remaining <= 0) {
        const { error } = await supabase.from("pantry_items").delete().eq("id", id)
        if (error) console.error("[supabase] removePantryItem delete error:", error.message)
      } else {
        const { error } = await supabase
          .from("pantry_items")
          .update({ quantity_grams: remaining })
          .eq("id", id)
        if (error) console.error("[supabase] removePantryItem update error:", error.message)
      }

      const pantry = await fetchPantry()
      setData((d) => ({ ...d, pantry }))
    })()
  }

  // ---------- Profile ----------

  const updateProfileGoals = (goals: Partial<Profile>) => {
    setData((d) => ({
      ...d,
      profile: { ...d.profile, ...goals },
    }))

    const updatePayload: Record<string, string | number> = {}
    if (goals.name !== undefined) updatePayload.name = goals.name
    if (goals.calorieGoal !== undefined) updatePayload.calorie_goal = goals.calorieGoal
    if (goals.proteinGoal !== undefined) updatePayload.protein_goal = goals.proteinGoal
    if (goals.weightGoal !== undefined) updatePayload.weight_goal = goals.weightGoal

    supabase
      .from("profile")
      .update(updatePayload)
      .eq("id", 1)
      .then(({ error }) => {
        if (error) {
          console.error("[supabase] updateProfileGoals error:", error.message)
        }
      })
  }

  const markSupermarketSubmitted = (week: number, date: string) => {
    submittedWeeksRef.current.add(week)
    localStorage.setItem("marcel-supermarket-submitted", JSON.stringify([...submittedWeeksRef.current]))
    setWeeklySupermarket((prev) => ({
      ...prev,
      lastSubmittedWeek: week,
      lastSubmittedDate: date,
    }))
  }

  return (
    <StoreContext.Provider
      value={{
        data,
        ready,
        weeklySupermarket,
        addMeal,
        updateMetric,
        addTransaction,
        updateTransaction,
        importTransactions,
        clearTransactions,
        deleteTransaction,
        addPantryItem,
        removePantryItem,
        updateProfileGoals,
        markSupermarketSubmitted,
        refreshTransactions,
        refreshAll,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        pendingReview,
        reviewOpen,
        dismissReview,
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
