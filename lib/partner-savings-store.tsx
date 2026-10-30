"use client"

// Estado del apartado de ahorro de la pareja ("avisar a papi") -- va en un
// provider aparte, igual que investments-store.tsx/winter-arc-store.tsx,
// para no mezclarlo con el resto. Ver supabase-migrations/partner-savings.sql
// para el esquema.
//
// Igual que investments-store.tsx: entrada 100% manual (ella decide su
// objetivo y hace su check-in a mano, no hay nada automático salvo el
// propio botón de avisar), y cada escritura espera la confirmación del
// servidor antes de darla por hecha en el estado local.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { SavingsCheckin, SavingsFrequency, SavingsGoal } from "./types"
import { supabase, type SavingsCheckinRow, type SavingsGoalRow } from "./supabase"
import { useAuth } from "./use-auth"

function rowToGoal(row: SavingsGoalRow): SavingsGoal {
  return {
    targetAmount: Number(row.target_amount),
    frequency: row.frequency as SavingsFrequency,
    currency: row.currency,
    updatedAt: row.updated_at,
  }
}

function rowToCheckin(row: SavingsCheckinRow): SavingsCheckin {
  return {
    id: row.id,
    periodKey: row.period_key,
    savedAmount: Number(row.saved_amount),
    metGoal: row.met_goal,
    reported: row.reported,
    reportedAt: row.reported_at,
    createdAt: row.created_at,
  }
}

async function fetchGoal(): Promise<SavingsGoal | null> {
  const { data, error } = await supabase.from("savings_goals").select("*").maybeSingle()
  if (error) {
    console.error("[supabase] fetchGoal error:", error.message)
    return null
  }
  return data ? rowToGoal(data as SavingsGoalRow) : null
}

async function fetchCheckins(): Promise<SavingsCheckin[]> {
  const { data, error } = await supabase
    .from("savings_checkins")
    .select("*")
    .order("period_key", { ascending: false })
  if (error) {
    console.error("[supabase] fetchCheckins error:", error.message)
    return []
  }
  return (data ?? []).map(rowToCheckin)
}

type PartnerSavingsContextType = {
  goal: SavingsGoal | null
  checkins: SavingsCheckin[]
  ready: boolean
  setGoal: (targetAmount: number, frequency: SavingsFrequency, currency: string) => Promise<void>
  // Devuelve el check-in recién creado/actualizado -- hace falta su id para
  // poder llamar a /api/partner/report justo después, en el mismo gesto.
  saveCheckin: (periodKey: string, savedAmount: number, metGoal: boolean) => Promise<SavingsCheckin>
  markReported: (checkinId: string) => void
}

const PartnerSavingsContext = createContext<PartnerSavingsContextType | undefined>(undefined)

export function PartnerSavingsProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const [goal, setGoalState] = useState<SavingsGoal | null>(null)
  const [checkins, setCheckins] = useState<SavingsCheckin[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (mode !== "in") {
      if (mode === "out") {
        setGoalState(null)
        setCheckins([])
        setReady(false)
      }
      return
    }

    let cancelled = false
    async function load() {
      const [g, c] = await Promise.all([fetchGoal(), fetchCheckins()])
      if (cancelled) return
      setGoalState(g)
      setCheckins(c)
      setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [mode, user?.id])

  const setGoal = async (targetAmount: number, frequency: SavingsFrequency, currency: string) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error("No hay sesión activa")
    const updatedAt = new Date().toISOString()
    const { data, error } = await supabase
      .from("savings_goals")
      .upsert({ user_id: userId, target_amount: targetAmount, frequency, currency, updated_at: updatedAt })
      .select("*")
      .single()
    if (error || !data) {
      console.error("[supabase] setGoal error:", error?.message)
      throw new Error(error?.message ?? "No se pudo guardar el objetivo")
    }
    setGoalState(rowToGoal(data as SavingsGoalRow))
  }

  const saveCheckin = async (periodKey: string, savedAmount: number, metGoal: boolean): Promise<SavingsCheckin> => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error("No hay sesión activa")
    // upsert por (user_id, period_key): si ya existía un check-in de este
    // periodo (p.ej. corrigiendo un dato mal puesto), se actualiza en vez de
    // duplicar -- pero sin tocar reported/reported_at si ya se había
    // avisado, para no "desavisar" por accidente al corregir la cifra.
    const { data, error } = await supabase
      .from("savings_checkins")
      .upsert(
        { user_id: userId, period_key: periodKey, saved_amount: savedAmount, met_goal: metGoal },
        { onConflict: "user_id,period_key", ignoreDuplicates: false },
      )
      .select("*")
      .single()
    if (error || !data) {
      console.error("[supabase] saveCheckin error:", error?.message)
      throw new Error(error?.message ?? "No se pudo guardar el check-in")
    }
    const checkin = rowToCheckin(data as SavingsCheckinRow)
    setCheckins((list) => [checkin, ...list.filter((c) => c.periodKey !== periodKey)])
    return checkin
  }

  // Tras un POST a /api/partner/report que ha ido bien: refleja en local
  // que este check-in ya se avisó, sin esperar a recargar la página.
  const markReported = (checkinId: string) => {
    setCheckins((list) =>
      list.map((c) => (c.id === checkinId ? { ...c, reported: true, reportedAt: new Date().toISOString() } : c)),
    )
  }

  return (
    <PartnerSavingsContext.Provider value={{ goal, checkins, ready, setGoal, saveCheckin, markReported }}>
      {children}
    </PartnerSavingsContext.Provider>
  )
}

export function usePartnerSavings() {
  const ctx = useContext(PartnerSavingsContext)
  if (!ctx) throw new Error("usePartnerSavings must be used within PartnerSavingsProvider")
  return ctx
}
