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

export type Ingredient = {
  id: string
  name: string
  quantity: number // grams
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  pricePerKg: number // AUD
  woolworthsUrl?: string
}

export type Meal = {
  id: string
  date: string // ISO date (yyyy-mm-dd)
  ingredients: Ingredient[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalCost: number // AUD
}

export type PantryItem = {
  id: string
  name: string
  quantityGrams: number
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  pricePerKg: number
  dateAdded: string
  woolworthsUrl?: string
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
  meals: Meal[]
  metrics: BodyMetric[]
  pantry: PantryItem[]
  transactions: Transaction[]
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export const uid = () => Math.random().toString(36).slice(2, 10)
