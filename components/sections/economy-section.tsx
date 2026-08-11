"use client"

import { useMemo, useState } from "react"
import {
  PiggyBank,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  PieChart,
} from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, Cell, Tooltip, XAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { todayISO, TRANSACTION_CATEGORIES, type Transaction } from "@/lib/types"

const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

type TabId = "diario" | "semanal" | "mensual"
type TxType = "gasto" | "ingreso"

function getMonthName(monthNum: number): string {
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
  return months[monthNum - 1] || ""
}

function getWeekNumberFromISO(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z")
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const dayOfWeek = jan4.getUTCDay()
  const week1Start = new Date(jan4)
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek)
  const diffDays = Math.floor((date.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000))
  return 1 + Math.floor(diffDays / 7)
}

function getWeekDateRangeFromNum(weekNum: number): { sunday: string; saturday: string } {
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

function fmt(amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount >= 0 ? `+$${abs}` : `-$${abs}`
}

const CATEGORY_EMOJI: Record<string, string> = {
  Alojamiento: "\u{1F3E0}",
  Supermercado: "\u{1F6D2}",
  "Comida fuera": "\u{1F37D}\uFE0F",
  Transporte: "\u{1F697}",
  Salario: "\u{1F4B0}",
  Compras: "\u{1F6CD}\uFE0F",
  Necesidades: "\u{1F9FE}",
  Ocio: "\u{1F3AC}",
  Otros: "\u{1F4CC}",
}

const CATEGORY_COLOR: Record<string, string> = {
  Alojamiento: "#fbbf24",
  Supermercado: "#2dd4bf",
  "Comida fuera": "#fb7185",
  Transporte: "#60a5fa",
  Salario: "#34d399",
  Compras: "#c084fc",
  Necesidades: "#f87171",
  Ocio: "#a78bfa",
  Otros: "#8a8a93",
}

interface WeeklyCategory {
  category: string
  total: number
  count: number
  history: { week: number; total: number }[]
  trend: number | null
  transactions: Transaction[]
}

interface CategoryGroup {
  category: string
  net: number
  transactions: Transaction[]
}

interface GroupedData {
  key: string
  label: string
  transactions: Transaction[]
  net: number
  categories: CategoryGroup[]
}

export function EconomySection() {
  const { data, addTransaction, updateTransaction, deleteTransaction } = useStore()
  const transactions: Transaction[] = data.transactions ?? []

  const [tab, setTab] = useState<TabId>("mensual")
  const [showForm, setShowForm] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [expandedSpendCat, setExpandedSpendCat] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)

  const [desc, setDesc] = useState("")
  const [txType, setTxType] = useState<TxType>("gasto")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const [editDesc, setEditDesc] = useState("")
  const [editType, setEditType] = useState<TxType>("gasto")
  const [editAmount, setEditAmount] = useState("")
  const [editCategory, setEditCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [editDate, setEditDate] = useState(todayISO())
  const [editSaving, setEditSaving] = useState(false)

  const today = todayISO()
  const currentMonth = today.slice(0, 7)

  const monthTx = transactions.filter((t) => t.date.startsWith(currentMonth))
  const ingresos = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const gastos = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const ahorro = ingresos - gastos

  const allSavings = transactions.reduce((s, t) => s + t.amount, 0)

  const weeklySavingsData = useMemo(() => {
    const groups = new Map<number, { income: number; expenses: number }>()
    transactions.forEach((t) => {
      const weekNum = getWeekNumberFromISO(t.date)
      if (!groups.has(weekNum)) groups.set(weekNum, { income: 0, expenses: 0 })
      const week = groups.get(weekNum)!
      if (t.amount > 0) week.income += t.amount
      else week.expenses += Math.abs(t.amount)
    })
    const weekNumbers = Array.from(groups.keys()).sort((a, b) => a - b)
    return weekNumbers.map((w) => {
      const week = groups.get(w)!
      return { week: w, label: `W${w}`, savings: week.income - week.expenses }
    })
  }, [transactions])

  const bestWeek = weeklySavingsData.length > 0 ? weeklySavingsData.reduce((best, w) => (w.savings > best.savings ? w : best)) : null
  const worstWeek = weeklySavingsData.length > 0 ? weeklySavingsData.reduce((worst, w) => (w.savings < worst.savings ? w : worst)) : null

  // Gasto por categoria de la semana actual, con historico de 6 semanas
  const currentWeekNum = getWeekNumberFromISO(today)
  const weeklyByCategory = useMemo((): WeeklyCategory[] => {
    const expenses = transactions.filter((t) => t.amount < 0)
    const cats = new Map<string, Transaction[]>()
    expenses
      .filter((t) => getWeekNumberFromISO(t.date) === currentWeekNum)
      .forEach((t) => {
        if (!cats.has(t.category)) cats.set(t.category, [])
        cats.get(t.category)!.push(t)
      })

    return Array.from(cats.entries())
      .map(([category, txs]) => {
        const total = txs.reduce((s, t) => s + Math.abs(t.amount), 0)
        const history = Array.from({ length: 6 }, (_, i) => {
          const w = currentWeekNum - 5 + i
          const wTotal = expenses
            .filter((t) => t.category === category && getWeekNumberFromISO(t.date) === w)
            .reduce((s, t) => s + Math.abs(t.amount), 0)
          return { week: w, total: wTotal }
        })
        const past = history.slice(0, 5).filter((h) => h.total > 0)
        const avg = past.length > 0 ? past.reduce((s, h) => s + h.total, 0) / past.length : null
        const trend = avg && avg > 0 ? ((total - avg) / avg) * 100 : null
        return {
          category,
          total,
          count: txs.length,
          history,
          trend,
          transactions: [...txs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [transactions, currentWeekNum])

  const weekSpendTotal = weeklyByCategory.reduce((s, c) => s + c.total, 0)

  const groupedData = useMemo((): GroupedData[] => {
    const source = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

    function toGroups(key: string, label: string, txs: Transaction[]): GroupedData {
      const net = txs.reduce((s, t) => s + t.amount, 0)
      const byCategory = new Map<string, Transaction[]>()
      txs.forEach((t) => {
        if (!byCategory.has(t.category)) byCategory.set(t.category, [])
        byCategory.get(t.category)!.push(t)
      })
      const categories: CategoryGroup[] = Array.from(byCategory.entries())
        .map(([cat, catTxs]) => ({
          category: cat,
          net: catTxs.reduce((s, t) => s + t.amount, 0),
          transactions: catTxs,
        }))
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      return { key, label, transactions: txs, net, categories }
    }

    if (tab === "diario") {
      const groups = new Map<string, Transaction[]>()
      source.forEach((t) => {
        if (!groups.has(t.date)) groups.set(t.date, [])
        groups.get(t.date)!.push(t)
      })
      return Array.from(groups.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, txs]) => {
          const d = new Date(date + "T00:00:00")
          const label = d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
          return toGroups(date, label, txs)
        })
    }

    if (tab === "semanal") {
      const groups = new Map<number, Transaction[]>()
      source.forEach((t) => {
        const weekNum = getWeekNumberFromISO(t.date)
        if (!groups.has(weekNum)) groups.set(weekNum, [])
        groups.get(weekNum)!.push(t)
      })
      return Array.from(groups.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([weekNum, txs]) => {
          const { sunday, saturday } = getWeekDateRangeFromNum(weekNum)
          const label = `Semana ${weekNum} (${sunday} - ${saturday})`
          return toGroups(`week-${weekNum}`, label, txs)
        })
    }

    const groups = new Map<string, Transaction[]>()
    source.forEach((t) => {
      const monthKey = t.date.slice(0, 7)
      if (!groups.has(monthKey)) groups.set(monthKey, [])
      groups.get(monthKey)!.push(t)
    })
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, txs]) => {
        const [year, month] = monthKey.split("-")
        const label = `${getMonthName(parseInt(month))} ${year}`
        return toGroups(monthKey, label, txs)
      })
  }, [transactions, tab])

  const handleSave = async () => {
    const raw = parseFloat(amount)
    if (!desc.trim() || isNaN(raw)) return

    const num = txType === "gasto" ? -Math.abs(raw) : Math.abs(raw)

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
    setTxType("gasto")
    setAmount("")
    setCategory(TRANSACTION_CATEGORIES[0])
    setDate(todayISO())
    setShowForm(false)
    setSaving(false)
  }

  const startEditing = (tx: Transaction) => {
    setEditingId(tx.id)
    setEditDesc(tx.description)
    setEditType(tx.amount >= 0 ? "ingreso" : "gasto")
    setEditAmount(String(Math.abs(tx.amount)))
    setEditCategory(tx.category)
    setEditDate(tx.date)
  }

  const cancelEditing = () => {
    setEditingId(null)
  }

  const handleUpdate = async (id: string) => {
    const raw = parseFloat(editAmount)
    if (!editDesc.trim() || isNaN(raw)) return
    setEditSaving(true)
    const num = editType === "gasto" ? -Math.abs(raw) : Math.abs(raw)
    updateTransaction(id, {
      description: editDesc.trim(),
      amount: num,
      category: editCategory as Transaction["category"],
      date: editDate,
    })
    setEditSaving(false)
    setEditingId(null)
  }

  return (
    <div className="space-y-5">
      {toastError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <X className="h-4 w-4 shrink-0" />
          <span>{toastError}</span>
        </div>
      )}

      {transactions.length === 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10 p-4">
          <p className="font-semibold text-amber-600 dark:text-amber-400">Sin transacciones</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Añade tu primer gasto o ingreso con el botón de abajo
          </p>
        </Card>
      )}

      {showForm && (
        <Card className="p-5 animate-in slide-in-from-top-4 duration-300">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Nueva transacción</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setTxType("gasto")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    txType === "gasto" ? "bg-red-500/15 text-red-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Gasto (−)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType("ingreso")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    txType === "ingreso" ? "bg-emerald-500/15 text-emerald-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Ganancia (+)
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-desc">Descripción</Label>
              <Input id="tx-desc" placeholder="Ej: Compra semanal" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Cantidad en AUD</Label>
              <Input id="tx-amount" type="number" min="0" placeholder="Ej: 45.50" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Introduce solo el número positivo, el signo se aplica solo según el tipo elegido arriba.
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

      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full" style={{ backgroundColor: "#7c6fff" }}>
          <Plus className="mr-2 size-4" />
          Añadir gasto o ganancia
        </Button>
      )}

      <Card className="overflow-hidden p-0">
        <button
          onClick={() => setShowSummary((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ahorro >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
            <PiggyBank className={`size-4 ${ahorro >= 0 ? "text-emerald-500" : "text-red-400"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Balance del mes</p>
            <p className={`text-lg font-bold ${ahorro >= 0 ? "text-emerald-500" : "text-red-400"}`}>
              {ahorro >= 0 ? "+" : "-"}${Math.abs(ahorro).toFixed(2)}
            </p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${showSummary ? "rotate-180" : ""}`} />
        </button>

        {showSummary && (
          <div className="border-t border-border p-4">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <MiniStat label="Ingresado (mes)" value={`+$${ingresos.toFixed(2)}`} tone="green" />
              <MiniStat label="Gastado (mes)" value={`-$${gastos.toFixed(2)}`} tone="red" />
            </div>

          </div>
        )}
      </Card>

      {weeklySavingsData.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold">Ahorro semanal</p>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySavingsData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1d", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#888" }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Ahorro"]}
                  labelFormatter={(label) => `Semana ${label.replace("W", "")}`}
                  cursor={{ fill: "rgba(255,255,255,0.06)" }}
                />
                <Bar dataKey="savings" radius={[3, 3, 0, 0]}>
                  {weeklySavingsData.map((entry, i) => (
                    <Cell key={i} fill={entry.savings >= 0 ? "#34d399" : "#f87171"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="Total ahorrado" value={`${allSavings >= 0 ? "+" : "-"}$${Math.abs(allSavings).toFixed(2)}`} tone={allSavings >= 0 ? "green" : "red"} />
            {bestWeek && <MiniStat label="Mejor" value={`+$${bestWeek.savings.toFixed(2)}`} tone="green" />}
            {worstWeek && <MiniStat label="Peor" value={`${worstWeek.savings >= 0 ? "+" : "-"}$${Math.abs(worstWeek.savings).toFixed(2)}`} tone={worstWeek.savings >= 0 ? "green" : "red"} />}
          </div>
        </Card>
      )}

      {weeklyByCategory.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <PieChart className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Gasto por categoria</p>
              <p className="text-xs text-muted-foreground">
                Esta semana &middot; ${weekSpendTotal.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="divide-y divide-border border-t border-border">
            {weeklyByCategory.map((cat) => {
              const isOpen = expandedSpendCat === cat.category
              const color = CATEGORY_COLOR[cat.category] ?? "#8a8a93"
              const pct = weekSpendTotal > 0 ? (cat.total / weekSpendTotal) * 100 : 0
              const maxHist = Math.max(...cat.history.map((h) => h.total), 1)
              return (
                <div key={cat.category}>
                  <button
                    onClick={() => setExpandedSpendCat(isOpen ? null : cat.category)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {CATEGORY_EMOJI[cat.category] ?? "\u{1F4CC}"} {cat.category}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {cat.count} {cat.count === 1 ? "movimiento" : "movimientos"}
                      </p>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>

                    <div className="flex h-6 w-12 shrink-0 items-end gap-[2px]">
                      {cat.history.map((h, i) => (
                        <div
                          key={h.week}
                          className="flex-1 rounded-t-[1px]"
                          style={{
                            height: `${Math.max((h.total / maxHist) * 100, 4)}%`,
                            backgroundColor: color,
                            opacity: i === cat.history.length - 1 ? 1 : 0.35,
                          }}
                        />
                      ))}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums text-red-400">-${cat.total.toFixed(2)}</p>
                      {cat.trend != null && (
                        <p className={`text-[9px] ${cat.trend > 0 ? "text-red-400" : "text-emerald-500"}`}>
                          {cat.trend > 0 ? "\u2191" : "\u2193"} {Math.abs(Math.round(cat.trend))}%
                        </p>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border bg-muted/10 px-4 py-3 pl-10">
                      <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Ultimas 6 semanas</p>
                      <div className="mb-3 flex h-10 items-end gap-1.5">
                        {cat.history.map((h) => (
                          <div key={h.week} className="flex flex-1 flex-col">
                            <div
                              className="rounded-t-sm"
                              style={{ height: `${Math.max((h.total / maxHist) * 40, 2)}px`, backgroundColor: color }}
                            />
                            <span className="mt-1 text-center text-[8px] text-muted-foreground">W{h.week}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Movimientos</p>
                      {cat.transactions.map((tx) => (
                        <div key={tx.id} className="flex justify-between border-t border-white/5 py-1 text-[11px]">
                          <span className="truncate pr-2 text-muted-foreground">{tx.description}</span>
                          <span className="shrink-0 font-semibold text-red-400">-${Math.abs(tx.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
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
          <p className="text-sm text-muted-foreground">Sin transacciones registradas</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedData.map((group) => {
            const isGroupExpanded = expandedGroup === group.key
            return (
              <Card key={group.key} className="overflow-hidden p-0">
                <button
                  onClick={() => setExpandedGroup(isGroupExpanded ? null : group.key)}
                  className="flex w-full items-center justify-between gap-3 bg-muted/30 p-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <p className="text-sm font-medium">{group.label}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold tabular-nums ${group.net >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                      {fmt(group.net)}
                    </span>
                    {isGroupExpanded ? (
                      <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isGroupExpanded && (
                  <div className="divide-y divide-border border-t border-border">
                    {group.categories.map((catGroup) => {
                      const catKey = `${group.key}:${catGroup.category}`
                      const isCatExpanded = expandedCategory === catKey
                      return (
                        <div key={catKey}>
                          <button
                            onClick={() => setExpandedCategory(isCatExpanded ? null : catKey)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{catGroup.category}</p>
                              <p className="text-xs text-muted-foreground">
                                {catGroup.transactions.length} {catGroup.transactions.length === 1 ? "movimiento" : "movimientos"}
                              </p>
                            </div>
                            <span className={`text-sm font-semibold tabular-nums ${catGroup.net >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                              {fmt(catGroup.net)}
                            </span>
                            {isCatExpanded ? (
                              <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                            )}
                          </button>

                          {isCatExpanded && (
                            <div className="divide-y divide-border bg-muted/10">
                              {catGroup.transactions.map((tx) => (
                                <div key={tx.id}>
                                  <button
                                    onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                                    className="flex w-full items-center gap-3 py-2.5 pl-8 pr-4 text-left hover:bg-muted/40 transition-colors"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-medium">{tx.description}</p>
                                      <p className="truncate text-xs text-muted-foreground">{tx.date}</p>
                                    </div>
                                    <span className={`text-xs font-semibold tabular-nums ${tx.amount >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                      {fmt(tx.amount)}
                                    </span>
                                  </button>
                                  {expandedId === tx.id && (
                                    <div className="border-t border-border bg-muted/20 px-4 py-3 pl-8 text-sm">
                                      {editingId === tx.id ? (
                                        <div className="space-y-3">
                                          <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                                            <button
                                              type="button"
                                              onClick={() => setEditType("gasto")}
                                              className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
                                                editType === "gasto" ? "bg-red-500/15 text-red-400" : "text-muted-foreground"
                                              }`}
                                            >
                                              Gasto (−)
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditType("ingreso")}
                                              className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
                                                editType === "ingreso" ? "bg-emerald-500/15 text-emerald-500" : "text-muted-foreground"
                                              }`}
                                            >
                                              Ganancia (+)
                                            </button>
                                          </div>
                                          <Input placeholder="Descripción" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-8 text-sm" />
                                          <Input type="number" min="0" placeholder="Cantidad" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="h-8 text-sm" />
                                          <select
                                            value={editCategory}
                                            onChange={(e) => setEditCategory(e.target.value)}
                                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                          >
                                            {TRANSACTION_CATEGORIES.map((c) => (
                                              <option key={c} value={c}>{c}</option>
                                            ))}
                                          </select>
                                          <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8 text-sm" />
                                          <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEditing}>
                                              Cancelar
                                            </Button>
                                            <Button size="sm" className="h-7 text-xs" disabled={editSaving || !editDesc.trim() || !editAmount} onClick={() => handleUpdate(tx.id)}>
                                              {editSaving ? "Guardando..." : "Guardar"}
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex justify-end gap-2">
                                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEditing(tx)}>
                                            <Pencil className="mr-1 size-3" />
                                            Editar
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500" onClick={() => deleteTransaction(tx.id)}>
                                            <X className="mr-1 size-3" />
                                            Eliminar
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "green" | "red" | "neutral"
}) {
  const color = tone === "green" ? "text-emerald-500" : tone === "red" ? "text-red-400" : "text-foreground"
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  )
}
