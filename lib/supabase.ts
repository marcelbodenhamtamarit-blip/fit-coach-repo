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
  language: string | null
  travel_mode: boolean | null
  travel_currency: string | null
  // 0=domingo...6=sábado (Date.getDay()). Ver lib/week.ts y Ajustes >
  // Preferencias > Inicio de semana.
  week_start_day: number | null
  // Restos de Turnos (quitado el 1 Oct 2026). Las columnas siguen en la
  // tabla y lib/store.tsx las lee; se retiran con el issue #14.
  shift_hourly_rate: number | null
  shift_tax_pct: number | null
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
