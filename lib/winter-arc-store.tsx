"use client"

// Estado del Winter Arc: días, revisiones semanales y ajustes, guardados en
// Supabase (RLS: solo tu usuario ve sus filas — ver
// supabase-migrations/winter_arc.sql). Mismo patrón que
// lib/shifts-store.tsx, pero independiente de StoreProvider: no toca
// Economía para nada.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { supabase } from "./supabase"
import { useAuth } from "./use-auth"
import {
  DEFAULT_SETTINGS,
  type WinterArcDay,
  type WinterArcRuleId,
  type WinterArcSession,
  type WinterArcSettings,
  type WinterArcWeek,
} from "./winter-arc"

type DayRow = {
  id: string
  date: string
  checks: string[] | null
  minimum_day: boolean
  session: string | null
  session_minutes: number | null
  session_notes: string | null
  pages: number | null
}

type WeekRow = {
  id: string
  week_start: string
  weight: number | string | null
  waist: number | string | null
  long_run_minutes: number | null
  note: string | null
}

type SettingsRow = {
  start_date: string
  end_date: string
  current_book: string | null
}

const num = (v: number | string | null) => (v === null || v === undefined ? null : Number(v))

function rowToDay(r: DayRow): WinterArcDay {
  return {
    id: r.id,
    date: r.date,
    checks: (r.checks ?? []) as WinterArcRuleId[],
    minimumDay: r.minimum_day,
    session: (r.session as WinterArcSession | null) ?? null,
    sessionMinutes: r.session_minutes,
    sessionNotes: r.session_notes,
    pages: r.pages,
  }
}

function rowToWeek(r: WeekRow): WinterArcWeek {
  return {
    id: r.id,
    weekStart: r.week_start,
    weight: num(r.weight),
    waist: num(r.waist),
    longRunMinutes: r.long_run_minutes,
    note: r.note,
  }
}

export type DayPatch = Partial<Omit<WinterArcDay, "id" | "date">>
export type WeekPatch = Partial<Omit<WinterArcWeek, "id" | "weekStart">>

type WinterArcContextType = {
  ready: boolean
  // false si las tablas aún no existen (falta ejecutar la migración).
  available: boolean
  days: WinterArcDay[]
  weeks: WinterArcWeek[]
  settings: WinterArcSettings
  saveDay: (date: string, patch: DayPatch) => Promise<void>
  saveWeek: (weekStart: string, patch: WeekPatch) => Promise<void>
  saveSettings: (patch: Partial<WinterArcSettings>) => Promise<void>
}

const WinterArcContext = createContext<WinterArcContextType | undefined>(undefined)

export function WinterArcProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const [ready, setReady] = useState(false)
  const [available, setAvailable] = useState(true)
  const [days, setDays] = useState<WinterArcDay[]>([])
  const [weeks, setWeeks] = useState<WinterArcWeek[]>([])
  const [settings, setSettings] = useState<WinterArcSettings>(DEFAULT_SETTINGS)

  // Copia siempre al día de los días, para que dos toques rápidos seguidos
  // (marcar dos casillas) partan cada uno del estado que dejó el anterior.
  const daysRef = useRef<WinterArcDay[]>([])
  // Cola de guardados: los upserts se envían de uno en uno y en orden, así
  // una respuesta lenta nunca deja en la base de datos un estado más viejo
  // que el último toque.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = (job: () => PromiseLike<unknown>) => {
    queueRef.current = queueRef.current.then(job, job)
    return queueRef.current
  }
  const setDaysSync = (next: WinterArcDay[]) => {
    daysRef.current = next
    setDays(next)
  }

  useEffect(() => {
    if (mode !== "in") {
      if (mode === "out") {
        setDaysSync([])
        setWeeks([])
        setSettings(DEFAULT_SETTINGS)
        setReady(false)
      }
      return
    }
    let cancelled = false
    async function load() {
      const [d, w, s] = await Promise.all([
        supabase.from("winter_arc_days").select("*").order("date", { ascending: true }),
        supabase.from("winter_arc_weekly").select("*").order("week_start", { ascending: true }),
        supabase.from("winter_arc_settings").select("*").maybeSingle(),
      ])
      if (cancelled) return
      if (d.error) {
        console.error("[supabase] winter_arc_days error:", d.error.message)
        setAvailable(false)
      } else {
        setAvailable(true)
      }
      setDaysSync(((d.data ?? []) as DayRow[]).map(rowToDay))
      setWeeks(((w.data ?? []) as WeekRow[]).map(rowToWeek))
      const sr = s.data as SettingsRow | null
      if (sr) {
        setSettings({ startDate: sr.start_date, endDate: sr.end_date, currentBook: sr.current_book })
      }
      setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [mode, user?.id])

  // Marcar una casilla tiene que sentirse instantáneo: se actualiza la
  // pantalla primero y luego se guarda (upsert por usuario+fecha).
  const saveDay = async (date: string, patch: DayPatch) => {
    const existing = daysRef.current.find((d) => d.date === date)
    const merged: WinterArcDay = {
      id: existing?.id ?? `tmp-${date}`,
      date,
      checks: existing?.checks ?? [],
      minimumDay: existing?.minimumDay ?? false,
      session: existing?.session ?? null,
      sessionMinutes: existing?.sessionMinutes ?? null,
      sessionNotes: existing?.sessionNotes ?? null,
      pages: existing?.pages ?? null,
      ...patch,
    }
    setDaysSync(
      [...daysRef.current.filter((d) => d.date !== date), merged].sort((a, b) => (a.date < b.date ? -1 : 1)),
    )

    await enqueue(async () => {
      const { error } = await supabase.from("winter_arc_days").upsert(
        {
          user_id: user?.id,
          date,
          checks: merged.checks,
          minimum_day: merged.minimumDay,
          session: merged.session,
          session_minutes: merged.sessionMinutes,
          session_notes: merged.sessionNotes,
          pages: merged.pages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date" },
      )
      if (error) console.error("[supabase] saveDay error:", error.message)
    })
  }

  const saveWeek = async (weekStart: string, patch: WeekPatch) => {
    const existing = weeks.find((w) => w.weekStart === weekStart)
    const merged: WinterArcWeek = {
      id: existing?.id ?? `tmp-${weekStart}`,
      weekStart,
      weight: existing?.weight ?? null,
      waist: existing?.waist ?? null,
      longRunMinutes: existing?.longRunMinutes ?? null,
      note: existing?.note ?? null,
      ...patch,
    }
    setWeeks((list) => {
      const others = list.filter((w) => w.weekStart !== weekStart)
      return [...others, merged].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))
    })
    const { error } = (await enqueue(() => supabase.from("winter_arc_weekly").upsert(
      {
        user_id: user?.id,
        week_start: weekStart,
        weight: merged.weight,
        waist: merged.waist,
        long_run_minutes: merged.longRunMinutes,
        note: merged.note,
      },
      { onConflict: "user_id,week_start" },
    ))) as { error: { message: string } | null }
    if (error) console.error("[supabase] saveWeek error:", error.message)
  }

  const saveSettings = async (patch: Partial<WinterArcSettings>) => {
    const merged = { ...settings, ...patch }
    setSettings(merged)
    const { error } = (await enqueue(() => supabase.from("winter_arc_settings").upsert(
      {
        user_id: user?.id,
        start_date: merged.startDate,
        end_date: merged.endDate,
        current_book: merged.currentBook,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    ))) as { error: { message: string } | null }
    if (error) console.error("[supabase] saveSettings error:", error.message)
  }

  return (
    <WinterArcContext.Provider
      value={{ ready, available, days, weeks, settings, saveDay, saveWeek, saveSettings }}
    >
      {children}
    </WinterArcContext.Provider>
  )
}

export function useWinterArc() {
  const ctx = useContext(WinterArcContext)
  if (!ctx) throw new Error("useWinterArc must be used within WinterArcProvider")
  return ctx
}
