"use client"

// Estado de "Turnos": turnos de trabajo guardados en Supabase (RLS-scoped,
// mismo patrón que lib/automations-store.tsx) más las dos acciones que no
// son un simple CRUD — marcar un turno como cobrado (crea la transacción de
// ingreso en Economía y la enlaza) y desmarcarlo (la borra). Por eso este
// provider vive DENTRO de StoreProvider (ver app/page.tsx): necesita poder
// llamar a refreshTransactions() para que Economía se entere al instante de
// la transacción creada/borrada, en vez de esperar a la siguiente recarga.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import type { Shift } from "./types"
import { supabase, type ShiftRow } from "./supabase"
import { useAuth } from "./use-auth"
import { useStore } from "./store"

function rowToShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    hours: Number(row.hours),
    shiftType: row.shift_type as Shift["shiftType"],
    status: row.status as Shift["status"],
    notes: row.notes,
    transactionId: row.transaction_id,
  }
}

async function fetchShifts(): Promise<Shift[]> {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .order("date", { ascending: true })
  if (error) {
    console.error("[supabase] fetchShifts error:", error.message)
    return []
  }
  return (data ?? []).map(rowToShift)
}

type ShiftsContextType = {
  shifts: Shift[]
  ready: boolean
  refreshShifts: () => Promise<void>
  addShift: (s: Omit<Shift, "id" | "status" | "transactionId">) => Promise<void>
  updateShift: (id: string, updates: Partial<Omit<Shift, "id" | "status" | "transactionId">>) => Promise<void>
  deleteShift: (shift: Shift) => Promise<void>
  markShiftPaid: (shift: Shift, netAmount: number) => Promise<void>
  markShiftUnpaid: (shift: Shift) => Promise<void>
}

const ShiftsContext = createContext<ShiftsContextType | undefined>(undefined)

export function ShiftsProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const { refreshTransactions } = useStore()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (mode !== "in") {
      if (mode === "out") {
        setShifts([])
        setReady(false)
      }
      return
    }

    let cancelled = false
    async function load() {
      const list = await fetchShifts()
      if (cancelled) return
      setShifts(list)
      setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [mode, user?.id])

  const refreshShifts = async () => {
    setShifts(await fetchShifts())
  }

  const addShift = async (s: Omit<Shift, "id" | "status" | "transactionId">) => {
    const { error } = await supabase.from("shifts").insert({
      date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
      hours: s.hours,
      shift_type: s.shiftType,
      notes: s.notes,
    })
    if (error) console.error("[supabase] addShift error:", error.message)
    await refreshShifts()
  }

  const updateShift = async (
    id: string,
    updates: Partial<Omit<Shift, "id" | "status" | "transactionId">>,
  ) => {
    setShifts((list) => list.map((sh) => (sh.id === id ? { ...sh, ...updates } : sh)))

    const payload: Record<string, unknown> = {}
    if (updates.date !== undefined) payload.date = updates.date
    if (updates.startTime !== undefined) payload.start_time = updates.startTime
    if (updates.endTime !== undefined) payload.end_time = updates.endTime
    if (updates.hours !== undefined) payload.hours = updates.hours
    if (updates.shiftType !== undefined) payload.shift_type = updates.shiftType
    if (updates.notes !== undefined) payload.notes = updates.notes

    const { error } = await supabase.from("shifts").update(payload).eq("id", id)
    if (error) console.error("[supabase] updateShift error:", error.message)
    await refreshShifts()
  }

  // Al eliminar un turno ya cobrado, se borra también la transacción de
  // ingreso que generó — si no, quedaría un ingreso suelto en Economía sin
  // ningún turno detrás que lo explique.
  const deleteShift = async (shift: Shift) => {
    if (shift.transactionId) {
      const { error } = await supabase.from("transactions").delete().eq("id", shift.transactionId)
      if (error) console.error("[supabase] deleteShift (transaction) error:", error.message)
    }

    setShifts((list) => list.filter((sh) => sh.id !== shift.id))
    const { error } = await supabase.from("shifts").delete().eq("id", shift.id)
    if (error) console.error("[supabase] deleteShift error:", error.message)
    await refreshTransactions()
  }

  // Marca el turno como cobrado y crea su transacción de ingreso en
  // Economía (categoría "Salario") por netAmount. netAmount llega ya
  // calculado desde fuera (TurnosSection) en vez de recalcularse aquí,
  // porque el diálogo de confirmación deja editarlo a mano antes de
  // guardar, por si el importe real que llegó al banco no coincide
  // exactamente con la estimación.
  const markShiftPaid = async (shift: Shift, netAmount: number) => {
    const { data: txRow, error: txError } = await supabase
      .from("transactions")
      .insert({
        date: shift.date,
        description: `Turno ${shift.date}`,
        category: "Salario",
        amount: netAmount,
      })
      .select()
      .single()

    if (txError || !txRow) {
      console.error("[supabase] markShiftPaid (transaction) error:", txError?.message)
      return
    }

    const { error: updateError } = await supabase
      .from("shifts")
      .update({ status: "cobrado", transaction_id: txRow.id })
      .eq("id", shift.id)

    if (updateError) {
      console.error("[supabase] markShiftPaid (shift) error:", updateError.message)
    }

    await refreshShifts()
    await refreshTransactions()
  }

  // Desmarcar como cobrado borra la transacción que se había creado: vuelve
  // a ser un plan, no un ingreso real, así que no debe seguir contando en
  // Economía.
  const markShiftUnpaid = async (shift: Shift) => {
    if (shift.transactionId) {
      const { error } = await supabase.from("transactions").delete().eq("id", shift.transactionId)
      if (error) console.error("[supabase] markShiftUnpaid (transaction) error:", error.message)
    }

    const { error: updateError } = await supabase
      .from("shifts")
      .update({ status: "planificado", transaction_id: null })
      .eq("id", shift.id)

    if (updateError) {
      console.error("[supabase] markShiftUnpaid (shift) error:", updateError.message)
    }

    await refreshShifts()
    await refreshTransactions()
  }

  return (
    <ShiftsContext.Provider
      value={{
        shifts,
        ready,
        refreshShifts,
        addShift,
        updateShift,
        deleteShift,
        markShiftPaid,
        markShiftUnpaid,
      }}
    >
      {children}
    </ShiftsContext.Provider>
  )
}

export function useShifts() {
  const ctx = useContext(ShiftsContext)
  if (!ctx) throw new Error("useShifts must be used within ShiftsProvider")
  return ctx
}
