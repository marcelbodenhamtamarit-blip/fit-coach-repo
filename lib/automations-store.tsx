"use client"

// Estado de "Automatizaciones": reglas creadas por el usuario (guardadas en
// Supabase, RLS-scoped) y los eventos disparados pendientes de ver como
// pop-up. Va en un provider aparte de StoreProvider (lib/store.tsx) para no
// tocar el código de Economía: se monta al lado, en app/page.tsx.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Automation, AutomationEvent } from "./types"
import {
  supabase,
  type AutomationRow,
  type AutomationEventRow,
} from "./supabase"
import { useAuth } from "./use-auth"

function rowToAutomation(row: AutomationRow): Automation {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    triggerType: row.trigger_type as Automation["triggerType"],
    scheduleFrequency: row.schedule_frequency as Automation["scheduleFrequency"],
    scheduleTime: row.schedule_time,
    scheduleWeekday: row.schedule_weekday,
    conditionMetric: row.condition_metric as Automation["conditionMetric"],
    conditionOperator: row.condition_operator as Automation["conditionOperator"],
    conditionValue: row.condition_value !== null ? Number(row.condition_value) : null,
    conditionCategory: row.condition_category as Automation["conditionCategory"],
    conditionCooldownHours: row.condition_cooldown_hours,
    actionType: row.action_type as Automation["actionType"],
    messageTitle: row.message_title,
    messageBody: row.message_body,
    lastTriggeredAt: row.last_triggered_at,
  }
}

function rowToEvent(row: AutomationEventRow): AutomationEvent {
  return {
    id: row.id,
    automationId: row.automation_id,
    title: row.title,
    body: row.body,
    actionType: row.action_type as AutomationEvent["actionType"],
    pushSent: row.push_sent,
    popupSeen: row.popup_seen,
    createdAt: row.created_at,
  }
}

async function fetchAutomations(): Promise<Automation[]> {
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) {
    console.error("[supabase] fetchAutomations error:", error.message)
    return []
  }
  return (data ?? []).map(rowToAutomation)
}

// Eventos disparados con acción popup/both que todavía no se han mostrado.
// Se piden solo los últimos, por si el worker corrió varias veces mientras
// la app estaba cerrada (no queremos apilar 30 pop-ups).
async function fetchPendingPopupEvents(): Promise<AutomationEvent[]> {
  const { data, error } = await supabase
    .from("automation_events")
    .select("*")
    .eq("popup_seen", false)
    .in("action_type", ["popup", "both"])
    .order("created_at", { ascending: false })
    .limit(10)
  if (error) {
    console.error("[supabase] fetchPendingPopupEvents error:", error.message)
    return []
  }
  return (data ?? []).map(rowToEvent)
}

type AutomationsContextType = {
  automations: Automation[]
  ready: boolean
  refreshAutomations: () => Promise<void>
  addAutomation: (a: Omit<Automation, "id" | "lastTriggeredAt">) => Promise<void>
  updateAutomation: (id: string, updates: Partial<Omit<Automation, "id" | "lastTriggeredAt">>) => Promise<void>
  deleteAutomation: (id: string) => void
  toggleAutomation: (id: string, active: boolean) => void
  pendingPopupEvents: AutomationEvent[]
  dismissPopupEvent: (id: string) => void
}

const AutomationsContext = createContext<AutomationsContextType | undefined>(undefined)

export function AutomationsProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [ready, setReady] = useState(false)
  const [pendingPopupEvents, setPendingPopupEvents] = useState<AutomationEvent[]>([])

  useEffect(() => {
    if (mode !== "in") {
      if (mode === "out") {
        setAutomations([])
        setPendingPopupEvents([])
        setReady(false)
      }
      return
    }

    let cancelled = false
    async function load() {
      const [list, pending] = await Promise.all([fetchAutomations(), fetchPendingPopupEvents()])
      if (cancelled) return
      setAutomations(list)
      setPendingPopupEvents(pending)
      setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [mode, user?.id])

  const refreshAutomations = async () => {
    setAutomations(await fetchAutomations())
  }

  const addAutomation = async (a: Omit<Automation, "id" | "lastTriggeredAt">) => {
    const { error } = await supabase.from("automations").insert({
      name: a.name,
      active: a.active,
      trigger_type: a.triggerType,
      schedule_frequency: a.scheduleFrequency,
      schedule_time: a.scheduleTime,
      schedule_weekday: a.scheduleWeekday,
      condition_metric: a.conditionMetric,
      condition_operator: a.conditionOperator,
      condition_value: a.conditionValue,
      condition_category: a.conditionCategory,
      condition_cooldown_hours: a.conditionCooldownHours,
      action_type: a.actionType,
      message_title: a.messageTitle,
      message_body: a.messageBody,
    })
    if (error) console.error("[supabase] addAutomation error:", error.message)
    await refreshAutomations()
  }

  const updateAutomation = async (
    id: string,
    updates: Partial<Omit<Automation, "id" | "lastTriggeredAt">>,
  ) => {
    setAutomations((list) => list.map((a) => (a.id === id ? { ...a, ...updates } : a)))

    const payload: Record<string, unknown> = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.active !== undefined) payload.active = updates.active
    if (updates.triggerType !== undefined) payload.trigger_type = updates.triggerType
    if (updates.scheduleFrequency !== undefined) payload.schedule_frequency = updates.scheduleFrequency
    if (updates.scheduleTime !== undefined) payload.schedule_time = updates.scheduleTime
    if (updates.scheduleWeekday !== undefined) payload.schedule_weekday = updates.scheduleWeekday
    if (updates.conditionMetric !== undefined) payload.condition_metric = updates.conditionMetric
    if (updates.conditionOperator !== undefined) payload.condition_operator = updates.conditionOperator
    if (updates.conditionValue !== undefined) payload.condition_value = updates.conditionValue
    if (updates.conditionCategory !== undefined) payload.condition_category = updates.conditionCategory
    if (updates.conditionCooldownHours !== undefined) payload.condition_cooldown_hours = updates.conditionCooldownHours
    if (updates.actionType !== undefined) payload.action_type = updates.actionType
    if (updates.messageTitle !== undefined) payload.message_title = updates.messageTitle
    if (updates.messageBody !== undefined) payload.message_body = updates.messageBody

    const { error } = await supabase.from("automations").update(payload).eq("id", id)
    if (error) console.error("[supabase] updateAutomation error:", error.message)
    await refreshAutomations()
  }

  const deleteAutomation = (id: string) => {
    setAutomations((list) => list.filter((a) => a.id !== id))
    supabase
      .from("automations")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[supabase] deleteAutomation error:", error.message)
      })
  }

  const toggleAutomation = (id: string, active: boolean) => {
    updateAutomation(id, { active })
  }

  const dismissPopupEvent = (id: string) => {
    setPendingPopupEvents((list) => list.filter((e) => e.id !== id))
    supabase
      .from("automation_events")
      .update({ popup_seen: true })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[supabase] dismissPopupEvent error:", error.message)
      })
  }

  return (
    <AutomationsContext.Provider
      value={{
        automations,
        ready,
        refreshAutomations,
        addAutomation,
        updateAutomation,
        deleteAutomation,
        toggleAutomation,
        pendingPopupEvents,
        dismissPopupEvent,
      }}
    >
      {children}
    </AutomationsContext.Provider>
  )
}

export function useAutomations() {
  const ctx = useContext(AutomationsContext)
  if (!ctx) throw new Error("useAutomations must be used within AutomationsProvider")
  return ctx
}
