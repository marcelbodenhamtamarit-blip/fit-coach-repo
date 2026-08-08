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
  Pencil,
  ShoppingCart,
} from "lucide-react"
import { ResponsiveContainer, Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatCard } from "@/components/stat-card"
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
  const { data, addTransaction, updateTransaction, deleteTransaction, weeklySupermarket } = useStore()
  const transactions: Transaction[] = data.transactions ?? []

  const [tab, setTab] = useState<TabId>("mensual")
  const [showForm, setShowForm] = useState(false)
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
  const now = new Date()
  const currentMonth = today.slice(0, 7)

  const monthTx = transactions.filter((t) => t.date.startsWith(currentMonth))
  const ingresos = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const gastos = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const ahorro = ingresos - gastos

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

  const avgWeeklySavings =
    weeklySavingsData.reduce((sum, w) => sum + w.savings, 0) / (weeklySavingsData.length || 1)

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

      {!showForm && (
        <Button onClick={() => setShowForm(true)} className="w-full" style={{ backgroundColor: "#7c6fff" }}>
          <Plus className="mr-2 size-4" />
          Añadir gasto o ganancia
        </Button>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={TrendingUp} label="Ingresado" value={`+$${ingresos.toFixed(2)}`} sub={now.toLocaleString("es-ES", { month: "long" })} accent="green" />
        <StatCard icon={TrendingDown} label="Gastado" value={`-$${gastos.toFixed(2)}`} sub={now.toLocaleString("es-ES", { month: "long" })} accent="red" />
        <StatCard icon={PiggyBank} label="Balance" value={`${ahorro >= 0 ? "+" : "-"}$${Math.abs(ahorro).toFixed(2)}`} sub={ahorro >= 0 ? "Positivo" : "Déficit"} accent={ahorro >= 0 ? "green" : "red"} />
      </div>

      {transactions.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Ahorro semanal</p>
            <p className={`text-xs font-medium ${avgWeeklySavings >= 0 ? "text-emerald-500" : "text-red-400"}`}>
              Promedio: ${avgWeeklySavings.toFixed(2)}
            </p>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklySavingsData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1d", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
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
        <div className="space-y-4">
          {groupedData.map((group) => (
            <Card key={group.key} className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">{group.label}</p>
                <span className={`text-xs font-semibold tabular-nums ${group.net >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                  {fmt(group.net)}
                </span>
              </div>
              <div className="divide-y divide-border">
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
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
