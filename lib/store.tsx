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
  BodyMetric,
  Meal,
  PantryItem,
  Profile,
  Transaction,
} from "./types"
import { todayISO, uid } from "./types"

const STORAGE_KEY = "marcel-fit-coach:v2"

function seedData(): AppData {
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
    transactions: [
      {
        id: uid(),
        date: day(0),
        description: "Compra semanal Woolworths",
        category: "Supermercado",
        amount: -250,
      },
    ],
  }
}

type StoreContextType = {
  data: AppData
  ready: boolean
  addMeal: (meal: Omit<Meal, "id">) => void
  updateMetric: (metric: Omit<BodyMetric, "id">) => void
  addTransaction: (t: Omit<Transaction, "id">) => void
  deleteTransaction: (id: string) => void
  addPantryItem: (item: Omit<PantryItem, "id" | "dateAdded">) => void
  removePantryItem: (id: string, quantityUsed: number) => void
  updateProfileGoals: (goals: Partial<Profile>) => void
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(seedData())
  const [ready, setReady] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setData(JSON.parse(stored))
      } catch {
        setData(seedData())
      }
    }
    setReady(true)
  }, [])

  // Persist to localStorage whenever data changes
  useEffect(() => {
    if (ready) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  }, [data, ready])

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

  const addTransaction = (t: Omit<Transaction, "id">) => {
    setData((d) => ({
      ...d,
      transactions: [{ ...t, id: uid() }, ...(d.transactions ?? [])].sort(
        (a, b) => b.date.localeCompare(a.date),
      ),
    }))
  }

  const deleteTransaction = (id: string) => {
    setData((d) => ({
      ...d,
      transactions: (d.transactions ?? []).filter((x) => x.id !== id),
    }))
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

  return (
    <StoreContext.Provider
      value={{
        data,
        ready,
        addMeal,
        updateMetric,
        addTransaction,
        deleteTransaction,
        addPantryItem,
        removePantryItem,
        updateProfileGoals,
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
