"use client"

import { useMemo, useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Loader2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import { todayISO, TRANSACTION_CATEGORIES, type Transaction } from "@/lib/types"
import { GOOGLE_SHEETS_WEBHOOK, fetchWebhookData, postWebhookData } from "@/lib/webhook"

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
  const { data, addTransaction, deleteTransaction } = useStore()
  const transactions: Transaction[] = data.transactions ?? []

  const [tab, setTab] = useState<TabId>("diario")
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)

  // form state
  const [desc, setDesc] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshToast, setRefreshToast] = useState(false)

  // Helper to parse date from string
  const parseDate = (dateStr: string | undefined): string | null => {
    if (!dateStr || typeof dateStr !== "string" || dateStr.trim() === "") return null
    
    if (dateStr.includes("/")) {
      const dateParts = dateStr.split("/")
      if (dateParts.length === 3) {
        const [day, month, year] = dateParts
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      }
    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr
    }
    return null
  }

  // Auto-load transactions on mount
  useEffect(() => {
    const autoLoad = async () => {
      const data = await fetchWebhookData()
      
      if (data && Array.isArray(data)) {
        const existingKeys = new Set(
          transactions.map((t) => `${t.date}-${t.category}-${t.amount}`),
        )

        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          let category, amount, dateStr, week
          
          // Handle array format [week, category, amount, date]
          if (Array.isArray(row)) {
            week = row[0]
            category = (row[1] || "").trim()
            amount = row[2]
            dateStr = row[3]
          } else {
            week = row.columnA
            category = (row.columnB || "").trim()
            amount = row.columnC
            dateStr = row.columnD
          }

          // Skip headers
          if (!category || category === "Category" || category === "Week" || category.includes("WEEK") || category.includes("TOTAL")) {
            continue
          }

          const amountNum = typeof amount === "number" ? amount : parseFloat(amount)
          if (typeof category !== "string" || isNaN(amountNum)) {
            continue
          }

          // Parse date
          let isoDate = parseDate(dateStr)

          // If no date, try to find date from nearby rows in same week
          if (!isoDate && typeof week === "number") {
            for (let j = Math.max(0, i - 10); j < Math.min(data.length, i + 10); j++) {
              const checkRow = Array.isArray(data[j]) ? data[j] : null
              if (checkRow && checkRow[0] === week) {
                const foundDate = parseDate(checkRow[3])
                if (foundDate) {
                  isoDate = foundDate
                  break
                }
              }
            }
          }

          // Skip if no date found
          if (!isoDate) continue

          const key = `${isoDate}-${category}-${amountNum}`

          if (!existingKeys.has(key)) {
            addTransaction({
              description: category,
              amount: amountNum,
              category: category as Transaction["category"],
              date: isoDate,
            })
          }
        }
      }
    }

    autoLoad()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await fetchWebhookData()
      
      if (data && Array.isArray(data)) {
        const existingKeys = new Set(
          transactions.map((t) => `${t.date}-${t.category}-${t.amount}`),
        )

        for (let i = 0; i < data.length; i++) {
          const row = data[i]
          let category, amount, dateStr, week
          
          // Handle array format [week, category, amount, date]
          if (Array.isArray(row)) {
            week = row[0]
            category = (row[1] || "").trim()
            amount = row[2]
            dateStr = row[3]
          } else {
            week = row.columnA
            category = (row.columnB || "").trim()
            amount = row.columnC
            dateStr = row.columnD
          }

          // Skip headers
          if (!category || category === "Category" || category === "Week" || category.includes("WEEK") || category.includes("TOTAL")) {
            continue
          }

          const amountNum = typeof amount === "number" ? amount : parseFloat(amount)
          if (typeof category !== "string" || isNaN(amountNum)) {
            continue
          }

          // Parse date
          let isoDate = parseDate(dateStr)

          // If no date, try to find date from nearby rows in same week
          if (!isoDate && typeof week === "number") {
            for (let j = Math.max(0, i - 10); j < Math.min(data.length, i + 10); j++) {
              const checkRow = Array.isArray(data[j]) ? data[j] : null
              if (checkRow && checkRow[0] === week) {
                const foundDate = parseDate(checkRow[3])
                if (foundDate) {
                  isoDate = foundDate
                  break
                }
              }
            }
          }

          // Skip if no date found
          if (!isoDate) continue

          const key = `${isoDate}-${category}-${amountNum}`

          if (!existingKeys.has(key)) {
            addTransaction({
              description: category,
              amount: amountNum,
              category: category as Transaction["category"],
              date: isoDate,
            })
          }
        }
      }
    } finally {
      setRefreshing(false)
      setRefreshToast(true)
      setTimeout(() => setRefreshToast(false), 2000)
    }
  }

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

    // Save locally first
    addTransaction(tx)

    // Sync to Google Sheets in background (fire and forget)
    ;(async () => {
      try {
        const weekNum = getWeekNumber(date)
        const { sunday, saturday } = getWeekDateRange(date)
        
        // First, send header row to ensure week exists
        await postWebhookData({
          week: `WEEK ${weekNum} (${sunday} - ${saturday})`,
          category: "",
          amount: "",
          date: "",
        })

        // Small delay to ensure header is written first
        await new Promise((resolve) => setTimeout(resolve, 100))
        
        // Then send the actual transaction
        await postWebhookData({
          week: weekNum,
          category: tx.category,
          amount: tx.amount,
          date: tx.date.split("-").reverse().join("/"), // "YYYY-MM-DD" -> "DD/MM/YYYY"
        })
      } catch (err) {
        // Webhook errors don't prevent local save
        console.log("[v0] Google Sheets sync error (transaction saved locally):", err)
        setToastError("No se pudo sincronizar con Google Sheets")
        setTimeout(() => setToastError(null), 3000)
      }
    })()

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
      {/* Refresh toast */}
      {refreshToast && (
        <div className="flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Actualizado
        </div>
      )}

      {/* Error toast */}
      {toastError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <X className="h-4 w-4 shrink-0" />
          <span>{toastError}</span>
        </div>
      )}

      {/* Add transaction button - moved to top */}
      <div className="flex gap-2">
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="flex-1">
            <Plus className="mr-2 size-4" />
            Añadir gasto
          </Button>
        )}
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="icon"
          title="Sincronizar con Google Sheets"
        >
          <RotateCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
