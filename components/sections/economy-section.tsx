"use client"

import { useMemo, useState } from "react"
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import { todayISO, TRANSACTION_CATEGORIES, type Transaction } from "@/lib/types"

const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbzZN7UFMDOaHjPrYe6x4C9Q9EPytiaPq6Wmw5oWx5kAYbI7Z4O_oj-fWK149KCvgqeT/exec"

type TabId = "diario" | "semanal" | "mensual"

// Calculate week number using Sunday-Saturday format (CommBank Australia)
function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z")
  const year = date.getUTCFullYear()
  const firstDay = new Date(Date.UTC(year, 0, 1))
  
  // Find first Sunday of the year
  let firstSunday = new Date(firstDay)
  firstSunday.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay())
  
  // If first day is Sunday, use it; otherwise next Sunday is first Sunday
  if (firstDay.getUTCDay() !== 0) {
    firstSunday.setUTCDate(firstSunday.getUTCDate() + 7)
  }
  
  // If date is before first Sunday, it's week 0 or belongs to previous year
  if (date < firstSunday) {
    return 1
  }
  
  const weeksDiff = Math.floor((date.getTime() - firstSunday.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return weeksDiff + 1
}

// Get Sunday and Saturday of a given week number
function getWeekDateRange(dateStr: string): { sunday: string; saturday: string } {
  const date = new Date(dateStr + "T00:00:00Z")
  const year = date.getUTCFullYear()
  const firstDay = new Date(Date.UTC(year, 0, 1))
  
  let firstSunday = new Date(firstDay)
  firstSunday.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay())
  if (firstDay.getUTCDay() !== 0) {
    firstSunday.setUTCDate(firstSunday.getUTCDate() + 7)
  }
  
  const weekNum = getWeekNumber(dateStr)
  const sundayDate = new Date(firstSunday)
  sundayDate.setUTCDate(firstSunday.getUTCDate() + (weekNum - 1) * 7)
  
  const saturdayDate = new Date(sundayDate)
  saturdayDate.setUTCDate(sundayDate.getUTCDate() + 6)
  
  const fmt = (d: Date) => {
    const day = String(d.getUTCDate()).padStart(2, "0")
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]
    return `${day} ${month}`
  }
  
  return { sunday: fmt(sundayDate), saturday: fmt(saturdayDate) }
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
  const { data, addTransaction, importTransactions, clearTransactions, deleteTransaction } = useStore()
  const transactions: Transaction[] = data.transactions ?? []

  const [tab, setTab] = useState<TabId>("diario")
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<{
    totalIncome: number
    totalExpenses: number
    savings: number
    count: number
  } | null>(null)

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

  // Top summary — all time (shown after import)
  const allIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const allExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const allSavings = allIncome - allExpenses
  const incomeCount = transactions.filter((t) => t.amount > 0).length
  const expenseCount = transactions.filter((t) => t.amount < 0).length

  // Monthly summary
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

  // Import from Google Sheets
  const handleImport = async () => {
    setImporting(true)
    setToastError(null)
    setImportSummary(null)

    try {
      const res = await fetch("/api/sheets")
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to import")
      }
      const data = await res.json()

      // Clear existing and import new transactions
      clearTransactions()
      const importedTx = data.transactions.map((t: any) => ({
        description: t.description || t.category,
        category: t.category,
        amount: t.amount,
        date: t.date,
      }))
      importTransactions(importedTx)

      // Show summary
      setImportSummary({
        totalIncome: data.summary.totalIncome,
        totalExpenses: data.summary.totalExpenses,
        savings: data.summary.savings,
        count: data.summary.transactionCount,
      })

      // Auto-hide summary after 10 seconds
      setTimeout(() => setImportSummary(null), 10000)
    } catch (err: any) {
      setToastError(err.message || "Error al importar")
      setTimeout(() => setToastError(null), 5000)
    } finally {
      setImporting(false)
    }
  }

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

    // Save locally first
    addTransaction(tx)

    // Sync to Google Sheets in background
    try {
      const weekNum = getWeekNumber(date)
      const { sunday, saturday } = getWeekDateRange(date)
      
      // First, check if week header exists by trying to fetch
      const headerCheckRes = await fetch(GOOGLE_SHEETS_WEBHOOK + `?week=${weekNum}`, {
        method: "GET",
      }).catch(() => null)
      
      // If no header exists, create it
      if (!headerCheckRes?.ok) {
        try {
          await fetch(GOOGLE_SHEETS_WEBHOOK, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              week: `WEEK ${weekNum} (${sunday} - ${saturday})`,
              category: "",
              amount: "",
              date: "",
            }),
          })
        } catch {
          // no-cors always throws but request still goes through
        }
      }
      
      // Then send the actual transaction
      await fetch(GOOGLE_SHEETS_WEBHOOK, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: weekNum,
          category: tx.category,
          amount: tx.amount,
          date: tx.date.split("-").reverse().join("/"), // "YYYY-MM-DD" -> "DD/MM/YYYY"
        }),
      })
    } catch {
      // Webhook errors don't prevent local save; show silent error
      setToastError("No se pudo sincronizar con Google Sheets")
      setTimeout(() => setToastError(null), 3000)
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
      {/* Error toast */}
      {toastError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <X className="h-4 w-4 shrink-0" />
          <span>{toastError}</span>
        </div>
      )}

      {/* Import summary */}
      {importSummary && (
        <Card className="border-green-500/50 bg-green-500/10 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-green-600 dark:text-green-400">
                Import successful
              </p>
              <p className="text-sm text-muted-foreground">
                Imported {importSummary.count} transactions
              </p>
            </div>
            <button onClick={() => setImportSummary(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Total Income</p>
              <p className="text-lg font-bold text-emerald-500">${importSummary.totalIncome.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-lg font-bold text-red-400">${importSummary.totalExpenses.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Savings</p>
              <p className={`text-lg font-bold ${importSummary.savings >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                ${importSummary.savings.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Setup instructions when no sheet configured */}
      {transactions.length === 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10 p-4">
          <p className="font-semibold text-amber-600 dark:text-amber-400">
            Google Sheets no configurado
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Para importar todos tus datos, configura <code className="rounded bg-muted px-1 py-0.5">GOOGLE_SHEET_CSV_URL</code> en <code className="rounded bg-muted px-1 py-0.5">.env</code>
          </p>
          <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>1. Abre tu Google Sheet</li>
            <li>2. Archivo → Compartir → Publicar en la web</li>
            <li>3. Selecciona la hoja y formato CSV</li>
            <li>4. Copia la URL y pégala en .env</li>
          </ol>
        </Card>
      )}

      {/* Add transaction button - moved to top */}
      <div className="flex gap-2">
        {!showForm && (
          <>
            <Button
              onClick={() => setShowForm(true)}
              className="flex-1"
              style={{ backgroundColor: "#7c6fff" }}
            >
              <Plus className="mr-2 size-4" />
              Añadir gasto
            </Button>
            <Button
              onClick={handleImport}
              variant="outline"
              disabled={importing}
              className="flex-1"
            >
              <Download className="mr-2 size-4" />
              {importing ? "Importing..." : "Import from Sheets"}
            </Button>
          </>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Ingresos (mes)"
          value={`$${ingresos.toFixed(2)}`}
          sub={now.toLocaleString("es-ES", { month: "long" })}
          accent="green"
        />
        <StatCard
          icon={TrendingDown}
          label="Gastos (mes)"
          value={`$${gastos.toFixed(2)}`}
          sub={now.toLocaleString("es-ES", { month: "long" })}
          accent="red"
        />
        <StatCard
          icon={PiggyBank}
          label="Ahorro (mes)"
          value={`$${Math.abs(ahorro).toFixed(2)}`}
          sub={ahorro >= 0 ? "Positivo" : "Déficit"}
          accent={ahorro >= 0 ? "green" : "red"}
        />
      </div>

      {/* All-time summary - show when data exists */}
      {transactions.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Resumen total (histórico)</p>
            <p className="text-xs text-muted-foreground">{transactions.length} transacciones</p>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Ingresos ({incomeCount})</p>
              <p className="text-xl font-bold text-emerald-500">${allIncome.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gastos ({expenseCount})</p>
              <p className="text-xl font-bold text-red-400">${allExpenses.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ahorros</p>
              <p className={`text-xl font-bold ${allSavings >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                ${allSavings.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      )}

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

      {/* Add transaction form */}
      {showForm && (
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
