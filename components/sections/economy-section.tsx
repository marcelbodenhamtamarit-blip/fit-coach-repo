"use client"

import { useMemo, useState } from "react"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import { todayISO, TRANSACTION_CATEGORIES, type Transaction } from "@/lib/types"

const GOOGLE_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbzZN7UFMDOaHjPrYe6x4C9Q9EPytiaPq6Wmw5oWx5kAYbI7Z4O_oj-fWK149KCvgqeT/exec"

type TabId = "diario" | "semanal" | "mensual"

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  const oneJan = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
}

function startOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const mon = new Date(d.setDate(diff))
  return mon.toISOString().slice(0, 10)
}

function fmt(amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount >= 0 ? `+$${abs}` : `-$${abs}`
}

export function EconomySection() {
  const { data, addTransaction, deleteTransaction } = useStore()
  const transactions: Transaction[] = data.transactions ?? []

  const [tab, setTab] = useState<TabId>("diario")
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // form state
  const [desc, setDesc] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const today = todayISO()
  const now = new Date()
  const currentMonth = today.slice(0, 7) // "yyyy-mm"
  const weekStart = startOfWeekISO()

  // Top summary — current month
  const monthTx = transactions.filter((t) => t.date.startsWith(currentMonth))
  const ingresos = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const gastos = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const ahorro = ingresos - gastos

  // Filtered list by tab
  const filtered = useMemo(() => {
    if (tab === "diario") return transactions.filter((t) => t.date === today)
    if (tab === "semanal") return transactions.filter((t) => t.date >= weekStart)
    // mensual
    return transactions.filter((t) => t.date.startsWith(currentMonth))
  }, [transactions, tab, today, weekStart, currentMonth])

  const handleSave = async () => {
    const num = parseFloat(amount)
    if (!desc.trim() || isNaN(num)) return

    setSaving(true)
    const tx: Omit<Transaction, "id"> = {
      description: desc.trim(),
      amount: num,
      category: category as Transaction["category"],
      date,
    }

    addTransaction(tx)

    // Fire-and-forget to Google Sheets
    try {
      await fetch(GOOGLE_SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: getWeekNumber(date),
          category: tx.category,
          amount: tx.amount,
          date: tx.date,
        }),
      })
    } catch {
      // no-cors mode will always throw a network error; the request still goes through
    }

    // reset form
    setDesc("")
    setAmount("")
    setCategory(TRANSACTION_CATEGORIES[0])
    setDate(todayISO())
    setShowForm(false)
    setSaving(false)
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "diario", label: "Diario" },
    { id: "semanal", label: "Semanal" },
    { id: "mensual", label: "Mensual" },
  ]

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Ingresos"
          value={`$${ingresos.toFixed(2)}`}
          sub={now.toLocaleString("es-ES", { month: "long" })}
          accent="green"
        />
        <StatCard
          icon={TrendingDown}
          label="Gastos"
          value={`$${gastos.toFixed(2)}`}
          sub={now.toLocaleString("es-ES", { month: "long" })}
          accent="red"
        />
        <StatCard
          icon={PiggyBank}
          label="Ahorro"
          value={`$${Math.abs(ahorro).toFixed(2)}`}
          sub={ahorro >= 0 ? "Positivo" : "Déficit"}
          accent={ahorro >= 0 ? "green" : "red"}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <Card className="divide-y divide-border overflow-hidden p-0">
        {filtered.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            Sin transacciones en este período
          </p>
        ) : (
          filtered.map((tx) => (
            <div key={tx.id}>
              <button
                onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tx.category}</p>
                  <p className="truncate text-xs text-muted-foreground">{tx.date}</p>
                </div>
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    tx.amount >= 0 ? "text-emerald-500" : "text-red-400"
                  }`}
                >
                  {fmt(tx.amount)} AUD
                </span>
                {expandedId === tx.id ? (
                  <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>

              {expandedId === tx.id && (
                <div className="border-t border-border bg-muted/20 px-4 py-3 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Descripción:</span>{" "}
                    {tx.description}
                  </p>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500"
                      onClick={() => deleteTransaction(tx.id)}
                    >
                      <X className="mr-1 size-3" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </Card>

      {/* Add transaction button / form */}
      {!showForm ? (
        <Button
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          <Plus className="mr-2 size-4" />
          Añadir gasto
        </Button>
      ) : (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Nueva transacción</h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-desc">Descripción</Label>
              <Input
                id="tx-desc"
                placeholder="Ej: Compra semanal"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Cantidad en AUD</Label>
              <Input
                id="tx-amount"
                type="number"
                placeholder="Negativo = gasto, positivo = ingreso"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Ej: -45.50 para un gasto, +2500 para un ingreso
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-category">Categoría</Label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TRANSACTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Fecha</Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !desc.trim() || !amount}
              className="w-full"
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
