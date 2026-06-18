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
  Profile,
  Routine,
  SleepEntry,
  Workout,
} from "./types"
import { todayISO, uid } from "./types"

const STORAGE_KEY = "marcel-fit-coach:v1"

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
      sleepGoal: 8,
      weightGoal: 80,
    },
    routines: [
      {
        id: uid(),
        name: "Push Day",
        focus: "Chest, Shoulders, Triceps",
        exercises: [
          { id: uid(), name: "Bench Press", sets: 4, reps: 8 },
          { id: uid(), name: "Overhead Press", sets: 3, reps: 10 },
          { id: uid(), name: "Incline Dumbbell Press", sets: 3, reps: 12 },
          { id: uid(), name: "Tricep Pushdown", sets: 3, reps: 15 },
        ],
      },
      {
        id: uid(),
        name: "Pull Day",
        focus: "Back, Biceps",
        exercises: [
          { id: uid(), name: "Deadlift", sets: 4, reps: 6 },
          { id: uid(), name: "Pull Ups", sets: 4, reps: 10 },
          { id: uid(), name: "Barbell Row", sets: 3, reps: 10 },
          { id: uid(), name: "Bicep Curl", sets: 3, reps: 12 },
        ],
      },
      {
        id: uid(),
        name: "Leg Day",
        focus: "Quads, Hamstrings, Glutes",
        exercises: [
          { id: uid(), name: "Back Squat", sets: 4, reps: 8 },
          { id: uid(), name: "Romanian Deadlift", sets: 3, reps: 10 },
          { id: uid(), name: "Leg Press", sets: 3, reps: 12 },
          { id: uid(), name: "Calf Raise", sets: 4, reps: 15 },
        ],
      },
    ],
    workouts: [
      {
        id: uid(),
        date: day(1),
        name: "Push Day",
        durationMin: 62,
        exercises: [
          {
            id: uid(),
            name: "Bench Press",
            sets: [
              { reps: 8, weight: 80 },
              { reps: 8, weight: 80 },
              { reps: 7, weight: 82.5 },
            ],
          },
        ],
      },
      {
        id: uid(),
        date: day(3),
        name: "Leg Day",
        durationMin: 70,
        exercises: [
          {
            id: uid(),
            name: "Back Squat",
            sets: [
              { reps: 8, weight: 100 },
              { reps: 8, weight: 100 },
            ],
          },
        ],
      },
    ],
    meals: [
      {
        id: uid(),
        date: todayISO(),
        name: "Oatmeal & Eggs",
        mealType: "breakfast",
        calories: 520,
        protein: 32,
        carbs: 55,
        fat: 16,
      },
      {
        id: uid(),
        date: todayISO(),
        name: "Chicken & Rice",
        mealType: "lunch",
        calories: 680,
        protein: 55,
        carbs: 70,
        fat: 14,
      },
    ],
    sleep: [
      { id: uid(), date: day(0), hours: 7.5, quality: 4, bedtime: "23:15", wakeTime: "06:45" },
      { id: uid(), date: day(1), hours: 6.8, quality: 3, bedtime: "23:50", wakeTime: "06:38" },
      { id: uid(), date: day(2), hours: 8.1, quality: 5, bedtime: "22:40", wakeTime: "06:46" },
      { id: uid(), date: day(3), hours: 7.2, quality: 4, bedtime: "23:30", wakeTime: "06:42" },
      { id: uid(), date: day(4), hours: 6.5, quality: 3, bedtime: "00:10", wakeTime: "06:40" },
      { id: uid(), date: day(5), hours: 7.9, quality: 4, bedtime: "22:55", wakeTime: "06:48" },
      { id: uid(), date: day(6), hours: 8.3, quality: 5, bedtime: "22:30", wakeTime: "06:48" },
    ],
    metrics: [
      { id: uid(), date: day(28), weight: 86.4, bodyFat: 19.5, waist: 88 },
      { id: uid(), date: day(21), weight: 85.6, bodyFat: 19, waist: 87 },
      { id: uid(), date: day(14), weight: 84.9, bodyFat: 18.4, waist: 86 },
      { id: uid(), date: day(7), weight: 84.1, bodyFat: 17.9, waist: 85 },
      { id: uid(), date: day(0), weight: 83.5, bodyFat: 17.4, waist: 84.5 },
    ],
  }
}

type StoreContextValue = {
  data: AppData
  ready: boolean
  updateProfile: (p: Partial<Profile>) => void
  addWorkout: (w: Omit<Workout, "id">) => void
  deleteWorkout: (id: string) => void
  addRoutine: (r: Omit<Routine, "id">) => void
  deleteRoutine: (id: string) => void
  addMeal: (m: Omit<Meal, "id">) => void
  deleteMeal: (id: string) => void
  addSleep: (s: Omit<SleepEntry, "id">) => void
  deleteSleep: (id: string) => void
  addMetric: (m: Omit<BodyMetric, "id">) => void
  deleteMetric: (id: string) => void
  importFromIntervals: (payload: IntervalsPayload) => { workouts: number; sleep: number; weights: number }
}

type IntervalsPayload = {
  workouts?: Array<{
    id: string
    date: string
    name: string
    type?: string
    durationMin: number
    calories?: number | null
    distanceKm?: number | null
  }>
  sleep?: Array<{ id: string; date: string; hours: number | null; score?: number | null }>
  weights?: Array<{ id: string; date: string; weightKg: number }>
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(seedData)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setData(JSON.parse(raw))
    } catch {
      // ignore corrupt storage
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // ignore quota errors
    }
  }, [data, ready])

  const value: StoreContextValue = {
    data,
    ready,
    updateProfile: (p) =>
      setData((d) => ({ ...d, profile: { ...d.profile, ...p } })),
    addWorkout: (w) =>
      setData((d) => ({ ...d, workouts: [{ ...w, id: uid() }, ...d.workouts] })),
    deleteWorkout: (id) =>
      setData((d) => ({ ...d, workouts: d.workouts.filter((x) => x.id !== id) })),
    addRoutine: (r) =>
      setData((d) => ({ ...d, routines: [{ ...r, id: uid() }, ...d.routines] })),
    deleteRoutine: (id) =>
      setData((d) => ({ ...d, routines: d.routines.filter((x) => x.id !== id) })),
    addMeal: (m) =>
      setData((d) => ({ ...d, meals: [{ ...m, id: uid() }, ...d.meals] })),
    deleteMeal: (id) =>
      setData((d) => ({ ...d, meals: d.meals.filter((x) => x.id !== id) })),
    addSleep: (s) =>
      setData((d) => ({ ...d, sleep: [{ ...s, id: uid() }, ...d.sleep] })),
    deleteSleep: (id) =>
      setData((d) => ({ ...d, sleep: d.sleep.filter((x) => x.id !== id) })),
    addMetric: (m) =>
      setData((d) => ({ ...d, metrics: [{ ...m, id: uid() }, ...d.metrics] })),
    deleteMetric: (id) =>
      setData((d) => ({ ...d, metrics: d.metrics.filter((x) => x.id !== id) })),
    importFromIntervals: (payload) => {
      const counts = { workouts: 0, sleep: 0, weights: 0 }
      setData((d) => {
        // Workouts: dedupe by id
        const existingWorkoutIds = new Set(d.workouts.map((w) => w.id))
        const newWorkouts: Workout[] = (payload.workouts || [])
          .filter((w) => w.date && !existingWorkoutIds.has(w.id))
          .map((w) => ({
            id: w.id,
            date: w.date,
            name: w.distanceKm ? `${w.name} (${w.distanceKm} km)` : w.name,
            durationMin: w.durationMin || 0,
            exercises: [],
          }))
        counts.workouts = newWorkouts.length

        // Sleep: dedupe by date
        const existingSleepDates = new Set(d.sleep.map((s) => s.date))
        const newSleep: SleepEntry[] = (payload.sleep || [])
          .filter((s) => s.date && s.hours != null && !existingSleepDates.has(s.date))
          .map((s) => ({
            id: s.id,
            date: s.date,
            hours: s.hours as number,
            quality: s.score != null ? Math.max(1, Math.min(5, Math.round((s.score / 100) * 5))) : 3,
            bedtime: "",
            wakeTime: "",
          }))
        counts.sleep = newSleep.length

        // Weights -> metrics: dedupe by date
        const existingMetricDates = new Set(d.metrics.map((m) => m.date))
        const newMetrics: BodyMetric[] = (payload.weights || [])
          .filter((w) => w.date && !existingMetricDates.has(w.date))
          .map((w) => ({
            id: w.id,
            date: w.date,
            weight: w.weightKg,
            bodyFat: 0,
            waist: 0,
          }))
        counts.weights = newMetrics.length

        return {
          ...d,
          workouts: [...newWorkouts, ...d.workouts].sort((a, b) => b.date.localeCompare(a.date)),
          sleep: [...newSleep, ...d.sleep].sort((a, b) => b.date.localeCompare(a.date)),
          metrics: [...newMetrics, ...d.metrics].sort((a, b) => b.date.localeCompare(a.date)),
        }
      })
      return counts
    },
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
