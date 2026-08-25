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
  currency: string | null
  original_amount: number | null
  week_number: number | null
  created_at: string
}

export type UserPreferencesRow = {
  user_id: string
  home_currency: string
  updated_at: string
}

export type RecurringTransactionRow = {
  id: string
  description: string
  category: string
  amount: number
  active: boolean
  frequency: string
  pay_day: number | null
  last_created_month: string | null
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

export type AutomationRow = {
  id: string
  name: string
  active: boolean
  trigger_type: string
  schedule_frequency: string | null
  schedule_time: string | null
  schedule_weekday: number | null
  condition_metric: string | null
  condition_operator: string | null
  condition_value: number | null
  condition_category: string | null
  condition_cooldown_hours: number
  action_type: string
  message_title: string
  message_body: string
  last_triggered_at: string | null
  created_at: string
}

export type AutomationEventRow = {
  id: string
  automation_id: string | null
  title: string
  body: string
  action_type: string
  push_sent: boolean
  popup_seen: boolean
  created_at: string
}

export type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
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
