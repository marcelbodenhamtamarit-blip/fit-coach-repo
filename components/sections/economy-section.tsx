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
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart, Tooltip } from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import { todayISO, TRANSACTION_CATEGORIES, type Transaction } from "@/lib/types"
import { ShoppingCart } from "lucide-react"

const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

type TabId = "diario" | "semanal" | "mensual"

// Get month name in Spanish
function getMonthName(monthNum: number): string {
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
  return months[monthNum - 1] || ""
}

// Marcel's week calendar: weeks 15-27, starting April 5, 2026
// Get calendar week number from date
function getWeekNumberFromISO(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z")
  // Use ISO week number (calendar week)
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const dayOfWeek = jan4.getUTCDay()
  const week1Start = new Date(jan4)
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek)

  const diffDays = Math.floor((date.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000))
  return 1 + Math.floor(diffDays / 7)
}

function getWeekDateRangeFromNum(weekNum: number): { sunday: string; saturday: string } {
  // Week 15 starts on Easter Sunday April 5, 2026
  // First Sunday of 2026 is Jan 4, so week 15 = Jan 4 + 14 weeks = April 5
  const firstSunday = new Date(Date.UTC(2026, 0, 4))
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

function getWeekNumber(dateStr: string): number {
  return getWeekNumberFromISO(dateStr)
}

function getWeekDateRange(dateStr: string): { sunday: string; saturday: string } {
  const weekNum = getWeekNumberFromISO(dateStr)
  return getWeekDateRangeFromNum(weekNum)
}

function fmt(amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount >= 0 ? `+$${abs}` : `-$${abs}`
}

interface GroupedData {
  key: string
  label: string
  transactions: Transaction[]
  totalIncome: number
  totalExpenses: number
  savings: number
}

export function EconomySection() {
  const { data, addTransaction, importTransactions, clearTransactions, deleteTransaction, weeklySupermarket } = useStore()
  const transactions: Transaction[] = data.transactions ?? []

  const [tab, setTab] = useState<TabId>("mensual")
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

  const [desc, setDesc] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const today = todayISO()
  const now = new Date()
  const currentMonth = today.slice(0, 7)

  // All-time totals
  const allIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const allExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const allSavings = allIncome - allExpenses
  const incomeCount = transactions.filter((t) => t.amount > 0).length
  const expenseCount = transactions.filter((t) => t.amount < 0).length

  // Current month totals for summary cards
  const monthTx = transactions.filter((t) => t.date.startsWith(currentMonth))
  const ingresos = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const gastos = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const ahorro = ingresos - gastos

  // Weekly savings chart data
  const weeklySavingsData = useMemo(() => {
    const groups = new Map<number, { income: number; expenses: number }>()
    transactions.forEach((t) => {
      const weekNum = getWeekNumberFromISO(t.date)
      if (!groups.has(weekNum)) groups.set(weekNum, { income: 0, expenses: 0 })
      const week = groups.get(weekNum)!
      if (t.amount > 0) week.income += t.amount
      else week.expenses += Math.abs(t.amount)
    })
    // Build data for weeks 1-13
    const data = []
    for (let w = 1; w <= 13; w++) {
      const week = groups.get(w) || { income: 0, expenses: 0 }
      data.push({
        week: w,
        label: `W${w}`,
        savings: week.income - week.expenses,
        income: week.income,
        expenses: week.expenses,
      })
    }
    return data
  }, [transactions])

  const bestWeek = weeklySavingsData.reduce((best, w) => w.savings > best.savings ? w : best, weeklySavingsData[0])
  const worstWeek = weeklySavingsData.reduce((worst, w) => w.savings < worst.savings ? w : worst, weeklySavingsData[0])
  const avgWeeklySavings = weeklySavingsData.reduce((sum, w) => sum + w.savings, 0) / weeklySavingsData.filter(w => w.income > 0 || w.expenses > 0).length || 0

  // Group transactions by tab
  const groupedData = useMemo((): GroupedData[] => {
    if (tab === "diario") {
      // Group by date
      const groups = new Map<string, Transaction[]>()
      transactions.forEach((t) => {
        const key = t.date
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(t)
      })
      return Array.from(groups.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, txs]) => {
          const totalIncome = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
          const totalExpenses = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
          const d = new Date(date + "T00:00:00")
          const label = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
          return { key: date, label, transactions: txs, totalIncome, totalExpenses, savings: totalIncome - totalExpenses }
        })
    }

    if (tab === "semanal") {
      // Group by week number
      const groups = new Map<number, Transaction[]>()
      transactions.forEach((t) => {
        const weekNum = getWeekNumberFromISO(t.date)
        if (!groups.has(weekNum)) groups.set(weekNum, [])
        groups.get(weekNum)!.push(t)
      })
      return Array.from(groups.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([weekNum, txs]) => {
          const totalIncome = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
          const totalExpenses = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
          const { sunday, saturday } = getWeekDateRangeFromNum(weekNum)
          const label = `Semana ${weekNum} (${sunday} - ${saturday})`
          return { key: `week-${weekNum}`, label, transactions: txs, totalIncome, totalExpenses, savings: totalIncome - totalExpenses }
        })
    }

    // Mensual - group by month
    const groups = new Map<string, Transaction[]>()
    transactions.forEach((t) => {
      const monthKey = t.date.slice(0, 7) // "YYYY-MM"
      if (!groups.has(monthKey)) groups.set(monthKey, [])
      groups.get(monthKey)!.push(t)
    })
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, txs]) => {
        const totalIncome = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
        const totalExpenses = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
        const [year, month] = monthKey.split("-")
        const label = `${getMonthName(parseInt(month))} ${year}`
        return { key: monthKey, label, transactions: txs, totalIncome, totalExpenses, savings: totalIncome - totalExpenses }
      })
  }, [transactions, tab])

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

      clearTransactions()
      const importedTx = data.transactions.map((t: any) => ({
        description: t.description || t.category,
        category: t.category,
        amount: t.amount,
        date: t.date,
      }))
      importTransactions(importedTx)

      setImportSummary({
        totalIncome: data.summary.totalIncome,
        totalExpenses: data.summary.totalExpenses,
        savings: data.summary.savings,
        count: data.summary.transactionCount,
      })
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

    addTransaction(tx)

    try {
      const weekNum = getWeekNumber(date)
      // Format amount with comma as decimal separator for Google Sheets
      const formattedAmount = tx.amount.toFixed(2).replace(".", ",")
      await fetch(GOOGLE_SHEETS_WEBHOOK, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: weekNum,
          category: tx.category,
          amount: formattedAmount,
          date: tx.date.split("-").reverse().join("/"),
        }),
      })
    } catch {
      setToastError("No se pudo sincronizar con Google Sheets")
      setTimeout(() => setToastError(null), 3000)
    }

    setDesc("")
    setAmount("")
    setCategory(TRANSACTION_CATEGORIES[0])
    setDate(todayISO())
    setShowForm(false)
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      {toastError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <X className="h-4 w-4 shrink-0" />
          <span>{toastError}</span>
        </div>
      )}

      {importSummary && (
        <Card className="border-green-500/50 bg-green-500/10 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-green-600 dark:text-green-400">Import successful</p>
              <p className="text-sm text-muted-foreground">Imported {importSummary.count} transactions</p>
            </div>
            <button onClick={() => setImportSummary(null)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Ingresos</p>
              <p className="text-lg font-bold text-emerald-500">${importSummary.totalIncome.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gastos</p>
              <p className="text-lg font-bold text-red-400">${importSummary.totalExpenses.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ahorros</p>
              <p className={`text-lg font-bold ${importSummary.savings >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                ${importSummary.savings.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {transactions.length === 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10 p-4">
          <p className="font-semibold text-amber-600 dark:text-amber-400">Sin transacciones</p>
          <p className="mt-1 text-sm text-muted-foreground">
                          Añade tu primer gasto o ingreso con el botón de abajo
          </p>
        </Card>
      )}

      {/* Add expense form at top with slide animation */}
      {showForm && (
        <Card
          className="p-5 animate-in slide-in-from-top-4 duration-300"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Nueva transacción</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tx-desc">Descripción</Label>
              <Input id="tx-desc" placeholder="Ej: Compra semanal" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Cantidad en AUD</Label>
              <Input id="tx-amount" type="number" placeholder="Negativo = gasto, positivo = ingreso" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">Ej: -45.50 para un gasto, +2500 para un ingreso</p>
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
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">Fecha</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button onClick={handleSave} disabled={saving || !desc.trim() || !amount} className="w-full">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </Card>
      )}

      {/* Weekly Supermarket Total Card */}
      <Card className="p-4 bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="size-6 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Supermercado esta semana (W{weeklySupermarket.weekNumber})</p>
              <p className="text-xl font-bold">${weeklySupermarket.thisWeekTotal.toFixed(2)}</p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {weeklySupermarket.lastSubmittedWeek === weeklySupermarket.weekNumber ? (
              <span className="text-emerald-500">Enviado</span>
            ) : (
              <span>Sábado 23:59 resumen</span>
            )}
          </div>
        </div>
      </Card>

          <div className="flex gap-2">
            {!showForm && (
              <Button onClick={() => setShowForm(true)} className="w-full" style={{ backgroundColor: "#7c6fff" }}>
                <Plus className="mr-2 size-4" />
                Añadir gasto
              </Button>
            )}
          </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={TrendingUp} label="Ingresos (mes)" value={`$${ingresos.toFixed(2)}`} sub={now.toLocaleString("es-ES", { month: "long" })} accent="green" />
        <StatCard icon={TrendingDown} label="Gastos (mes)" value={`$${gastos.toFixed(2)}`} sub={now.toLocaleString("es-ES", { month: "long" })} accent="red" />
        <StatCard icon={PiggyBank} label="Ahorro (mes)" value={`$${Math.abs(ahorro).toFixed(2)}`} sub={ahorro >= 0 ? "Positivo" : "Déficit"} accent={ahorro >= 0 ? "green" : "red"} />
      </div>

      {transactions.length > 0 && (
        <>
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

          {/* Weekly Savings Chart */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Ahorro semanal</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklySavingsData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#888", fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#888", fontSize: 10 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1d",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#888" }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Ahorro"]}
                    labelFormatter={(label) => `Semana ${label.replace("W", "")}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="savings"
                    stroke="#7c6fff"
                    strokeWidth={2}
                    fill="#7c6fff"
                    fillOpacity={0.2}
                    dot={{ fill: "#7c6fff", strokeWidth: 0, r: 3 }}
                    activeDot={{ fill: "#7c6fff", strokeWidth: 0, r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-muted-foreground">Mejor semana</p>
                <p className="mt-1 font-medium text-emerald-500">
                  WEEK {bestWeek.week} — ${bestWeek.savings.toFixed(2)} AUD
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Peor semana</p>
                <p className="mt-1 font-medium text-red-400">
                  WEEK {worstWeek.week} — ${worstWeek.savings.toFixed(2)} AUD
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Promedio semanal</p>
                <p className={`mt-1 font-medium ${avgWeeklySavings >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                  ${avgWeeklySavings.toFixed(2)} AUD
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {[{ id: "diario", label: "Diario" }, { id: "semanal", label: "Semanal" }, { id: "mensual", label: "Mensual" }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as TabId)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {groupedData.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Sin transacciones</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedData.map((group) => (
            <Card key={group.key} className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">{group.label}</p>
                <div className="flex gap-3 text-xs tabular-nums">
                  <span className="text-emerald-500">+${group.totalIncome.toFixed(2)}</span>
                  <span className="text-red-400">-${group.totalExpenses.toFixed(2)}</span>
                  <span className={group.savings >= 0 ? "text-emerald-500 font-medium" : "text-red-400 font-medium"}>
                    ${group.savings.toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {group.transactions.map((tx) => (
                  <div key={tx.id}>
                    <button
                      onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{tx.category}</p>
                        <p className="truncate text-xs text-muted-foreground">{tx.date}</p>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${tx.amount >= 0 ? "text-emerald-500" : "text-red-400"}`}>
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
                          <span className="font-medium text-foreground">Descripción:</span> {tx.description}
                        </p>
                        <div className="mt-3 flex justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500" onClick={() => deleteTransaction(tx.id)}>
                            <X className="mr-1 size-3" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
