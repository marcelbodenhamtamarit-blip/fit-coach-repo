"use client"

// Estado de "Inversiones" (PIAS, Revolut, criptomonedas...): va en un
// provider aparte de StoreProvider (lib/store.tsx), igual que
// automations-store.tsx, para no tocar el código de Economía. Se monta al
// lado, en app/page.tsx.
//
// Entrada 100% manual a propósito (ver supabase-migrations/investments.sql):
// no hay conexión automática con ningún bróker, banco ni exchange. Cada
// escritura espera la confirmación del servidor antes de dar el cambio por
// hecho en el estado local — el mismo fallo (guardar en segundo plano sin
// esperar, y que un cambio se "pierda" si la pantalla se recarga antes de
// tiempo) que se corrigió en lib/store.tsx para divisa/idioma/inicio de
// semana no se repite aquí.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Investment, InvestmentContribution, InvestmentType } from "./types"
import { supabase, type InvestmentRow, type InvestmentContributionRow } from "./supabase"
import { useAuth } from "./use-auth"

function rowToInvestment(row: InvestmentRow): Investment {
  return {
    id: row.id,
    name: row.name,
    type: row.type as InvestmentType,
    currency: row.currency,
    currentValue: Number(row.current_value),
    currentValueUpdatedAt: row.updated_at,
    archived: row.archived,
    createdAt: row.created_at,
    symbol: row.symbol,
    quantity: row.quantity === null ? null : Number(row.quantity),
    priceUnit: (row.price_unit as Investment["priceUnit"]) ?? null,
  }
}

function rowToContribution(row: InvestmentContributionRow): InvestmentContribution {
  return {
    id: row.id,
    investmentId: row.investment_id,
    amount: Number(row.amount),
    date: row.contributed_at,
    note: row.note,
    createdAt: row.created_at,
  }
}

async function fetchInvestments(): Promise<Investment[]> {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) {
    console.error("[supabase] fetchInvestments error:", error.message)
    return []
  }
  return (data ?? []).map(rowToInvestment)
}

async function fetchContributions(): Promise<InvestmentContribution[]> {
  const { data, error } = await supabase
    .from("investment_contributions")
    .select("*")
    .order("contributed_at", { ascending: false })
  if (error) {
    console.error("[supabase] fetchContributions error:", error.message)
    return []
  }
  return (data ?? []).map(rowToContribution)
}

type InvestmentsContextType = {
  investments: Investment[]
  contributions: InvestmentContribution[]
  ready: boolean
  // Devuelve la inversión recién creada (con su id ya asignado por
  // Supabase) — hace falta para el import de CSV/PDF "directo" desde la
  // pantalla principal (ver ImportCsvPanel más abajo): crear la inversión
  // y, en el mismo gesto, usar su id para guardar las aportaciones
  // importadas, sin que el usuario tenga que ir a buscarla después.
  addInvestment: (i: {
    name: string
    type: InvestmentType
    currency: string
    currentValue: number
    symbol?: string | null
    quantity?: number | null
    priceUnit?: string | null
  }) => Promise<Investment>
  renameInvestment: (id: string, name: string) => Promise<void>
  // Solo para inversiones de precio en vivo (stocks/gold): cambiar cuántas
  // unidades tiene sin tocar symbol/priceUnit, que se fijan al crearla.
  updateInvestmentQuantity: (id: string, quantity: number) => Promise<void>
  // Actualizar el valor actual es la acción del día a día (no hay precio en
  // vivo): guarda el nuevo valor y sella currentValueUpdatedAt a ahora, para
  // poder distinguir "nunca se ha puesto un valor" de "vale 0 ahora mismo".
  updateInvestmentValue: (id: string, currentValue: number) => Promise<void>
  archiveInvestment: (id: string, archived: boolean) => Promise<void>
  deleteInvestment: (id: string) => Promise<void>
  addContribution: (investmentId: string, amount: number, date: string, note?: string | null) => Promise<void>
  // Para importar varias aportaciones de golpe (p.ej. desde un CSV de
  // Revolut): un único insert en vez de uno por fila.
  addContributionsBulk: (
    investmentId: string,
    rows: { amount: number; date: string; note?: string | null }[],
  ) => Promise<void>
  deleteContribution: (id: string) => Promise<void>
}

const InvestmentsContext = createContext<InvestmentsContextType | undefined>(undefined)

export function InvestmentsProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [contributions, setContributions] = useState<InvestmentContribution[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (mode !== "in") {
      if (mode === "out") {
        setInvestments([])
        setContributions([])
        setReady(false)
      }
      return
    }

    let cancelled = false
    async function load() {
      const [inv, contrib] = await Promise.all([fetchInvestments(), fetchContributions()])
      if (cancelled) return
      setInvestments(inv)
      setContributions(contrib)
      setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [mode, user?.id])

  const refresh = async () => {
    const [inv, contrib] = await Promise.all([fetchInvestments(), fetchContributions()])
    setInvestments(inv)
    setContributions(contrib)
  }

  const addInvestment: InvestmentsContextType["addInvestment"] = async ({
    name,
    type,
    currency,
    currentValue,
    symbol,
    quantity,
    priceUnit,
  }) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error("No hay sesión activa")
    const { data, error } = await supabase
      .from("investments")
      .insert({
        user_id: userId,
        name,
        type,
        currency,
        current_value: currentValue,
        updated_at: new Date().toISOString(),
        symbol: symbol ?? null,
        quantity: quantity ?? null,
        price_unit: priceUnit ?? null,
      })
      .select("*")
      .single()
    if (error || !data) {
      console.error("[supabase] addInvestment error:", error?.message)
      throw new Error(error?.message ?? "No se pudo crear la inversión")
    }
    await refresh()
    return rowToInvestment(data as InvestmentRow)
  }

  const updateInvestmentQuantity = async (id: string, quantity: number) => {
    const { error } = await supabase.from("investments").update({ quantity }).eq("id", id)
    if (error) {
      console.error("[supabase] updateInvestmentQuantity error:", error.message)
      throw new Error(error.message)
    }
    setInvestments((list) => list.map((inv) => (inv.id === id ? { ...inv, quantity } : inv)))
  }

  const renameInvestment = async (id: string, name: string) => {
    const { error } = await supabase.from("investments").update({ name }).eq("id", id)
    if (error) {
      console.error("[supabase] renameInvestment error:", error.message)
      throw new Error(error.message)
    }
    setInvestments((list) => list.map((inv) => (inv.id === id ? { ...inv, name } : inv)))
  }

  const updateInvestmentValue = async (id: string, currentValue: number) => {
    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from("investments")
      .update({ current_value: currentValue, updated_at: updatedAt })
      .eq("id", id)
    if (error) {
      console.error("[supabase] updateInvestmentValue error:", error.message)
      throw new Error(error.message)
    }
    setInvestments((list) =>
      list.map((inv) => (inv.id === id ? { ...inv, currentValue, currentValueUpdatedAt: updatedAt } : inv)),
    )
  }

  const archiveInvestment = async (id: string, archived: boolean) => {
    const { error } = await supabase.from("investments").update({ archived }).eq("id", id)
    if (error) {
      console.error("[supabase] archiveInvestment error:", error.message)
      throw new Error(error.message)
    }
    setInvestments((list) => list.map((inv) => (inv.id === id ? { ...inv, archived } : inv)))
  }

  const deleteInvestment = async (id: string) => {
    const { error } = await supabase.from("investments").delete().eq("id", id)
    if (error) {
      console.error("[supabase] deleteInvestment error:", error.message)
      throw new Error(error.message)
    }
    setInvestments((list) => list.filter((inv) => inv.id !== id))
    // El borrado en cascada (on delete cascade) se lleva también sus
    // aportaciones en Supabase; aquí solo hace falta reflejarlo en local.
    setContributions((list) => list.filter((c) => c.investmentId !== id))
  }

  const addContribution = async (investmentId: string, amount: number, date: string, note?: string | null) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error("No hay sesión activa")
    const { data, error } = await supabase
      .from("investment_contributions")
      .insert({ user_id: userId, investment_id: investmentId, amount, contributed_at: date, note: note ?? null })
      .select("*")
      .single()
    if (error || !data) {
      console.error("[supabase] addContribution error:", error?.message)
      throw new Error(error?.message ?? "No se pudo guardar la aportación")
    }
    setContributions((list) => [rowToContribution(data as InvestmentContributionRow), ...list])
  }

  const addContributionsBulk = async (
    investmentId: string,
    rows: { amount: number; date: string; note?: string | null }[],
  ) => {
    if (rows.length === 0) return
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) throw new Error("No hay sesión activa")
    const { data, error } = await supabase
      .from("investment_contributions")
      .insert(
        rows.map((r) => ({
          user_id: userId,
          investment_id: investmentId,
          amount: r.amount,
          contributed_at: r.date,
          note: r.note ?? null,
        })),
      )
      .select("*")
    if (error || !data) {
      console.error("[supabase] addContributionsBulk error:", error?.message)
      throw new Error(error?.message ?? "No se pudieron importar las aportaciones")
    }
    const inserted = (data as InvestmentContributionRow[]).map(rowToContribution)
    setContributions((list) => [...inserted, ...list])
  }

  const deleteContribution = async (id: string) => {
    const { error } = await supabase.from("investment_contributions").delete().eq("id", id)
    if (error) {
      console.error("[supabase] deleteContribution error:", error.message)
      throw new Error(error.message)
    }
    setContributions((list) => list.filter((c) => c.id !== id))
  }

  return (
    <InvestmentsContext.Provider
      value={{
        investments,
        contributions,
        ready,
        addInvestment,
        renameInvestment,
        updateInvestmentQuantity,
        updateInvestmentValue,
        archiveInvestment,
        deleteInvestment,
        addContribution,
        addContributionsBulk,
        deleteContribution,
      }}
    >
      {children}
    </InvestmentsContext.Provider>
  )
}

export function useInvestments() {
  const ctx = useContext(InvestmentsContext)
  if (!ctx) throw new Error("useInvestments must be used within InvestmentsProvider")
  return ctx
}
