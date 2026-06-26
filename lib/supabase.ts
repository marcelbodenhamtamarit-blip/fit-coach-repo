import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Set them in your environment (Vercel project settings).",
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Row shape as stored in the `transactions` table (snake_case, matches Postgres).
export type TransactionRow = {
  id: string
  date: string
  description: string
  category: string
  amount: number
  week_number: number | null
  created_at: string
}
