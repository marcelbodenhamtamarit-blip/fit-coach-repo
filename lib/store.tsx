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
  PantryItem,
  Profile,
  Transaction,
} from "./types"
import { todayISO, uid } from "./types"
import { supabase } from "./supabase"

const STORAGE_KEY = "marcel-fit-coach:v2"
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

function seedData(): Omit<AppData, "transactions"> {
  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    return d.toISOString().slice(0, 10)
  }

  return {
    profile: {
      name: "Marcel",
      calorieGoal: 2400,
      proteinGoal: 170,
      weightGoal: 80,
    },
    meals: [
      {
        id: uid(),
        date: day(0),
        ingredients: [
          {
            id: uid(),
            name: "Arroz blanco",
            quantity: 300,
            caloriesPer100g: 130,
            proteinPer100g: 2.7,
            carbsPer100g: 28,
            fatPer100g: 0.3,
            pricePerKg: 3.5,
          },
        ],
        totalCalories: 390,
        totalProtein: 8.1,
        totalCarbs: 84,
        totalFat: 0.9,
        totalCost: 1.05,
      },
    ],
    metrics: [
      {
        id: uid(),
        date: day(0),
        weight: 83.5,
        bodyFat: 18,
        waist: 90,
      },
      {
        id: uid(),
        date: day(1),
        weight: 83.3,
        bodyFat: 17.8,
        waist: 89.5,
      },
    ],
    pantry: [],
  }
}

// --- Supabase <-> app type mapping for transactions ---

type SupabaseTransactionRow = {
  id: string
  date: string
  description: string
  category: string
  amount: number
  week_number: number | null
  created_at: string
}

function rowToTransaction(row: SupabaseTransactionRow): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category as Transaction["category"],
    amount: Number(row.amount),
  }
}

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
  importTransactions: (txs: Omit<Transaction, "id">[]) => void
  clearTransactions: () => void
  deleteTransaction: (id: string) => void
  addPantryItem: (item: Omit<PantryItem, "id" | "dateAdded">) => void
  removePantryItem: (id: string, quantityUsed: number) => void
  updateProfileGoals: (goals: Partial<Profile>) => void
  markSupermarketSubmitted: (week: number, date: string) => void
  refreshTransactions: () => Promise<void>
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>({ ...seedData(), transactions: [] })
  const [ready, setReady] = useState(false)
  const [weeklySupermarket, setWeeklySupermarket] = useState<WeeklySupermarketState>({
    thisWeekTotal: 0,
    weekNumber: 0,
    lastSubmittedWeek: null,
    lastSubmittedDate: null,
  })
  const submittedWeeksRef = useRef<Set<number>>(new Set())

  // Load non-transaction data from localStorage, and transactions from Supabase, on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      const stored = localStorage.getItem(STORAGE_KEY)
      let baseData: AppData = { ...seedData(), transactions: [] }
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          baseData = { ...baseData, ...parsed }
        } catch {
          // keep defaults
        }
      }

      const transactions = await fetchTransactions()
      if (cancelled) return

      setData({ ...baseData, transactions })

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
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist non-transaction data to localStorage whenever it changes
  // (transactions now live in Supabase, not localStorage)
  useEffect(() => {
    if (ready) {
      const { transactions, ...rest } = data
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
    }
  }, [data.profile, data.meals, data.metrics, data.pantry, ready])

  const refreshTransactions = async () => {
    const transactions = await fetchTransactions()
    setData((d) => ({ ...d, transactions }))
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
          const formattedDate = saturdayDate.split("-").reverse().join("/")
          const formattedAmount = (-total).toFixed(2).replace(".", ",")

          fetch("https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec", {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              week: weekNumber,
              category: "TOTAL SUPERMERCADO",
              amount: formattedAmount,
              date: formattedDate,
            }),
          }).catch(() => {})

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

  const addMeal = (meal: Omit<Meal, "id">) => {
    setData((d) => ({
      ...d,
      meals: [{ ...meal, id: uid() }, ...(d.meals ?? [])],
    }))
  }

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
  }

  // Transactions now read/write directly to Supabase. Local state is updated
  // optimistically and then reconciled with what Supabase actually has.

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

  const importTransactions = (txs: Omit<Transaction, "id">[]) => {
    if (txs.length === 0) return

    // Optimistic local update with client-side de-dup (date+category+amount)
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

    // Push to Supabase. We rely on fetching existing rows first to avoid
    // inserting duplicates of transactions already stored there.
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
      .neq("id", "00000000-0000-0000-0000-000000000000") // delete all rows
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

  const addPantryItem = (item: Omit<PantryItem, "id" | "dateAdded">) => {
    setData((d) => ({
      ...d,
      pantry: [
        { ...item, id: uid(), dateAdded: todayISO() },
        ...(d.pantry ?? []),
      ],
    }))
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
  }

  const updateProfileGoals = (goals: Partial<Profile>) => {
    setData((d) => ({
      ...d,
      profile: { ...d.profile, ...goals },
    }))
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
        importTransactions,
        clearTransactions,
        deleteTransaction,
        addPantryItem,
        removePantryItem,
        updateProfileGoals,
        markSupermarketSubmitted,
        refreshTransactions,
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
