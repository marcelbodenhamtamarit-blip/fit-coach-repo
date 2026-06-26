import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Set them in your environment (Vercel project settings).",
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- Row shapes as stored in Postgres (snake_case) ---

export type TransactionRow = {
  id: string
  date: string
  description: string
  category: string
  amount: number
  week_number: number | null
  created_at: string
}

export type ProfileRow = {
  id: number
  name: string
  calorie_goal: number
  protein_goal: number
  weight_goal: number
  updated_at: string
}

export type PantryItemRow = {
  id: string
  name: string
  quantity_grams: number
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  price_per_kg: number
  woolworths_url: string | null
  date_added: string
  created_at: string
}

export type BodyMetricRow = {
  id: string
  date: string
  weight: number
  body_fat: number | null
  waist: number | null
  created_at: string
}

export type MealRow = {
  id: string
  date: string
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  total_cost: number
  created_at: string
}

export type MealIngredientRow = {
  id: string
  meal_id: string
  name: string
  quantity_grams: number
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  price_per_kg: number
  woolworths_url: string | null
}
