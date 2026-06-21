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
import { GOOGLE_SHEETS_WEBHOOK, fetchWebhookData, postWebhookData, mapCategory } from "@/lib/webhook"

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
  const [refreshing, setRefreshing] = useState(false)
  const [refreshToast, setRefreshToast] = useState(false)
  const [loadingCount, setLoadingCount] = useState(0)

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
      let loadedCount = 0
      
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

          // Map category to canonical Spanish name
          const mappedCategory = mapCategory(category)
          if (!mappedCategory) {
            continue
          }

          // Parse date
          let isoDate = parseDate(dateStr)

          // If no date and week number exists, calculate Sunday of that week
          if (!isoDate && typeof week === "number" && week > 0) {
            try {
              const year = 2026
              const firstDay = new Date(Date.UTC(year, 0, 1))
              let firstSunday = new Date(firstDay)
              firstSunday.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay())
              if (firstDay.getUTCDay() !== 0) {
                firstSunday.setUTCDate(firstSunday.getUTCDate() + 7)
              }
              
              const sundayOfWeek = new Date(firstSunday)
              sundayOfWeek.setUTCDate(firstSunday.getUTCDate() + (week - 1) * 7)
              
              const day = String(sundayOfWeek.getUTCDate()).padStart(2, "0")
              const month = String(sundayOfWeek.getUTCMonth() + 1).padStart(2, "0")
              const y = sundayOfWeek.getUTCFullYear()
              isoDate = `${y}-${month}-${day}`
            } catch (err) {
              // Silent fail
            }
          }

          // Skip if no date found
          if (!isoDate) {
            continue
          }

          const key = `${isoDate}-${mappedCategory}-${amountNum}`

          if (!existingKeys.has(key)) {
            addTransaction({
              description: mappedCategory,
              amount: amountNum,
              category: mappedCategory as Transaction["category"],
              date: isoDate,
            })
            loadedCount++
          }
        }
        
        if (loadedCount > 0) {
          setLoadingCount(loadedCount)
          setTimeout(() => setLoadingCount(0), 3000)
        }
      }
    }

    autoLoad()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    let loadedCount = 0
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

          // Map category to canonical Spanish name
          const mappedCategory = mapCategory(category)
          if (!mappedCategory) {
            continue
          }

          // Parse date
          let isoDate = parseDate(dateStr)

          // If no date and week number exists, calculate Sunday of that week
          if (!isoDate && typeof week === "number" && week > 0) {
            try {
              const year = 2026
              const firstDay = new Date(Date.UTC(year, 0, 1))
              let firstSunday = new Date(firstDay)
              firstSunday.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay())
              if (firstDay.getUTCDay() !== 0) {
                firstSunday.setUTCDate(firstSunday.getUTCDate() + 7)
              }
              
              const sundayOfWeek = new Date(firstSunday)
              sundayOfWeek.setUTCDate(firstSunday.getUTCDate() + (week - 1) * 7)
              
              const day = String(sundayOfWeek.getUTCDate()).padStart(2, "0")
              const month = String(sundayOfWeek.getUTCMonth() + 1).padStart(2, "0")
              const y = sundayOfWeek.getUTCFullYear()
              isoDate = `${y}-${month}-${day}`
            } catch (err) {
              // Silent fail
            }
          }

          // Skip if no date found
          if (!isoDate) continue

          const key = `${isoDate}-${mappedCategory}-${amountNum}`

          if (!existingKeys.has(key)) {
            addTransaction({
              description: mappedCategory,
              amount: amountNum,
              category: mappedCategory as Transaction["category"],
              date: isoDate,
            })
            existingKeys.add(key)
            loadedCount++
          }
        }
      }
      
      if (loadedCount > 0) {
        setLoadingCount(loadedCount)
        setTimeout(() => setLoadingCount(0), 3000)
      }
      
      // Switch to semanal tab to show all imported transactions grouped by week
      setTab("semanal")
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

  // Group transactions by period and calculate totals
  const groupedData = useMemo(() => {
    let filtered: Transaction[] = []
    
    if (tab === "diario") {
      filtered = transactions.filter((t) => t.date === today)
    } else if (tab === "semanal") {
      filtered = transactions.filter((t) => t.date >= weekStart)
    } else {
      // mensual
      filtered = transactions.filter((t) => t.date.startsWith(currentMonth))
    }

    if (tab === "diario") {
      // Group by day
      const groups: Record<string, Transaction[]> = {}
      filtered.forEach((tx) => {
        if (!groups[tx.date]) groups[tx.date] = []
        groups[tx.date].push(tx)
      })
      
      return Object.entries(groups)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, txs]) => {
          const total = txs.reduce((sum, t) => sum + t.amount, 0)
          const d = new Date(date + "T00:00:00Z")
          const dayName = d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
          return {
            periodType: "day" as const,
            label: dayName,
            date,
            transactions: txs.sort((a, b) => a.category.localeCompare(b.category)),
            total,
          }
        })
    } else if (tab === "semanal") {
      // Group by week
      const groups: Record<number, Transaction[]> = {}
      filtered.forEach((tx) => {
        const week = getWeekNumber(tx.date)
        if (!groups[week]) groups[week] = []
        groups[week].push(tx)
      })
      
      return Object.entries(groups)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([weekStr, txs]) => {
          const week = Number(weekStr)
          const weekDate = txs[0].date
          const { sunday, saturday } = getWeekDateRange(weekDate)
          const income = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
          const expenses = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
          const savings = income - expenses
          
          return {
            periodType: "week" as const,
            label: `WEEK ${week} (${sunday} - ${saturday})`,
            week,
            transactions: txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            income,
            expenses,
            savings,
          }
        })
    } else {
      // Group by month
      const groups: Record<string, Transaction[]> = {}
      filtered.forEach((tx) => {
        const month = tx.date.slice(0, 7) // "yyyy-mm"
        if (!groups[month]) groups[month] = []
        groups[month].push(tx)
      })
      
      return Object.entries(groups)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, txs]) => {
          const d = new Date(month + "-01T00:00:00Z")
          const monthName = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
          const income = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
          const expenses = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
          const savings = income - expenses
          
          return {
            periodType: "month" as const,
            label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
            month,
            transactions: txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            income,
            expenses,
            savings,
          }
        })
    }
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
      {/* Loading count toast */}
      {loadingCount > 0 && (
        <div className="flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          {loadingCount} transacciones cargadas
        </div>
      )}

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
          <Button onClick={() => setShowForm(true)} className="flex-1 bg-[#7c6fff] hover:bg-[#6d5ee8] text-white">
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

      {/* Transaction list - grouped by period */}
      <div className="space-y-5">
        {groupedData.length === 0 ? (
          <Card className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">Sin transacciones en este período</p>
          </Card>
        ) : (
          groupedData.map((group, groupIdx) => (
            <Card key={groupIdx} className="overflow-hidden p-0">
              {/* Period header */}
              <div
                className={`px-5 py-3 border-b border-border flex items-center justify-between ${
                  group.periodType === "day"
                    ? "bg-muted/40"
                    : group.periodType === "week"
                      ? "bg-blue-500/10"
                      : "bg-purple-500/10"
                }`}
              >
                <h3 className="font-semibold text-sm">{group.label}</h3>
                {group.periodType === "day" && (
                  <span className={`text-sm font-semibold tabular-nums ${
                    group.total >= 0 ? "text-emerald-500" : "text-red-400"
                  }`}>
                    {fmt(group.total)} AUD
                  </span>
                )}
              </div>

              {/* Transactions in this period */}
              <div className="divide-y divide-border">
                {group.transactions.map((tx) => (
                  <div key={tx.id}>
                    <button
                      onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{tx.category}</p>
                        <p className="truncate text-xs text-muted-foreground">{tx.description}</p>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums whitespace-nowrap ${
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
                      <div className="border-t border-border bg-muted/20 px-5 py-3 text-sm">
                        <div className="space-y-2">
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Categoría:</span> {tx.category}
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Fecha:</span> {tx.date}
                          </p>
                        </div>
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
                ))}
              </div>

              {/* Period footer with totals (for week and month) */}
              {(group.periodType === "week" || group.periodType === "month") && (
                <div className="bg-muted/20 px-5 py-3 border-t border-border space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ingresos:</span>
                    <span className="font-semibold text-emerald-500">{fmt(group.income)} AUD</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gastos:</span>
                    <span className="font-semibold text-red-400">{fmt(-group.expenses)} AUD</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="font-medium">Ahorro:</span>
                    <span className={`font-semibold ${group.savings >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                      {fmt(group.savings)} AUD
                    </span>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

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
