export type WorkoutSet = {
  reps: number
  weight: number
}

export type WorkoutExercise = {
  id: string
  name: string
  sets: WorkoutSet[]
}

export type Workout = {
  id: string
  date: string // ISO date
  name: string
  durationMin: number
  durationSec?: number
  durationDisplay?: string
  exercises: WorkoutExercise[]
  distanceKm?: number
  calories?: number
  type?: string
  heartRateAvg?: number
  heartRateMax?: number
  elevation?: number
  trainingLoad?: number
  averagePower?: number
  elapsedTime?: number
}

export type DailyMetric = {
  id: string
  date: string // ISO date
  steps?: number
  restingHeartRate?: number
  temperature?: number
  comment?: string
}

export type RoutineExercise = {
  id: string
  name: string
  sets: number
  reps: number
}

export type Routine = {
  id: string
  name: string
  focus: string
  exercises: RoutineExercise[]
}

export type Meal = {
  id: string
  date: string // ISO date (yyyy-mm-dd)
  name: string
  mealType: "breakfast" | "lunch" | "dinner" | "snack"
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type SleepEntry = {
  id: string
  date: string // ISO date (yyyy-mm-dd)
  hours: number
  quality: number // 1-5
  bedtime: string
  wakeTime: string
}

export type BodyMetric = {
  id: string
  date: string // ISO date (yyyy-mm-dd)
  weight: number // kg
  bodyFat: number // %
  waist: number // cm
}

export type Profile = {
  name: string
  calorieGoal: number
  proteinGoal: number
  sleepGoal: number
  weightGoal: number
}

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

export type Transaction = {
  id: string
  date: string // ISO date yyyy-mm-dd
  description: string
  category: TransactionCategory
  amount: number // negative = expense, positive = income (AUD)
}

export type AppData = {
  profile: Profile
  workouts: Workout[]
  routines: Routine[]
  meals: Meal[]
  sleep: SleepEntry[]
  metrics: BodyMetric[]
  dailyMetrics: DailyMetric[]
  transactions: Transaction[]
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const uid = () => Math.random().toString(36).slice(2, 10)
