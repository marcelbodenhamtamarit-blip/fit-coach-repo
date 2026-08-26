"use client"

import { useEffect, useMemo, useState } from "react"
import {
  PiggyBank,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react"
import { ResponsiveContainer, BarChart, Bar, Cell, Tooltip, XAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { todayISO, TRANSACTION_CATEGORIES, CURRENCIES, currencySymbol, type Transaction } from "@/lib/types"
import { categoryLabel, type Language } from "@/lib/i18n"
import { RecurringManagerDialog } from "@/components/recurring-manager-dialog"
import { BatchAddDialog } from "@/components/batch-add-dialog"
import { supabase } from "@/lib/supabase"
import { convertAmount } from "@/lib/exchange-rates"

const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

type TabId = "diario" | "semanal" | "mensual"
type TxType = "gasto" | "ingreso"

function getMonthName(monthNum: number, locale: string): string {
  return new Date(Date.UTC(2026, monthNum - 1, 1)).toLocaleDateString(locale, { month: "long", timeZone: "UTC" })
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

function fmt(amount: number, currency?: string | null): string {
  const symbol = currencySymbol(currency)
  const abs = Math.abs(amount).toFixed(2)
  return amount >= 0 ? `+${symbol}${abs}` : `-${symbol}${abs}`
}

const CATEGORY_EMOJI: Record<string, string> = {
  Alojamiento: "\u{1F3E0}",
  Supermercado: "\u{1F6D2}",
  "Comida fuera": "\u{1F37D}️",
  Transporte: "\u{1F697}",
  Salario: "\u{1F4B0}",
  Compras: "\u{1F6CD}️",
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

export function EconomySection({ autoOpenSignal }: { autoOpenSignal?: number } = {}) {
  const { data, addTransaction, updateTransaction, deleteTransaction, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const locale = lang === "en" ? "en-US" : "es-ES"
  const transactions: Transaction[] = data.transactions ?? []
  const homeCurrency = data.homeCurrency
  // Si el modo viaje está activo, las nuevas transacciones parten de la
  // divisa de viaje en vez de la principal, para no tener que cambiarla a
  // mano en cada gasto durante el viaje (ver Ajustes > Modo viaje).
  const defaultCurrency = data.travelMode && data.travelCurrency ? data.travelCurrency : homeCurrency

  const [tab, setTab] = useState<TabId>("mensual")
  const [showForm, setShowForm] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)

  const [desc, setDesc] = useState("")
  const [showDescField, setShowDescField] = useState(false)
  const [txType, setTxType] = useState<TxType>("gasto")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [currency, setCurrency] = useState<string>(defaultCurrency)
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [conversionError, setConversionError] = useState("")

  const [editDesc, setEditDesc] = useState("")
  const [editType, setEditType] = useState<TxType>("gasto")
  const [editAmount, setEditAmount] = useState("")
  const [editCategory, setEditCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [editDate, setEditDate] = useState(todayISO())
  const [editSaving, setEditSaving] = useState(false)

  // El botón "Añadir gasto" de Resumen navega aquí y sube autoOpenSignal;
  // lo escuchamos para abrir el formulario automáticamente (no solo al
  // montar el componente, por eso comparamos con la señal anterior).
  useEffect(() => {
    if (autoOpenSignal) {
      setCurrency(defaultCurrency)
      setShowForm(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenSignal])

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
          const label = d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
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
          const label = `${t("economy.week", { n: weekNum })} (${sunday} - ${saturday})`
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
        const monthName = getMonthName(parseInt(month), locale)
        const label = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`
        return toGroups(monthKey, label, txs)
      })
  }, [transactions, tab, locale])

  const handleSave = async () => {
    const raw = parseFloat(amount)
    if (isNaN(raw)) return

    const num = txType === "gasto" ? -Math.abs(raw) : Math.abs(raw)

    setSaving(true)
    setConversionError("")

    // Si se registra en una divisa distinta a la principal, se convierte
    // ahora (con la tasa del día) y se guardan ambos importes: el original
    // (tal cual se pagó) y el convertido (con el que se suman los totales).
    let finalAmount = num
    let txCurrency: string | null = null
    let txOriginalAmount: number | null = null

    if (currency !== homeCurrency) {
      try {
        finalAmount = await convertAmount(num, currency, homeCurrency, supabase)
        txCurrency = currency
        txOriginalAmount = num
      } catch {
        setSaving(false)
        setConversionError(t("economy.conversionError"))
        return
      }
    }

    // La descripción es opcional: si no se rellena, usamos la categoría
    // como descripción por defecto para que la transacción no quede sin
    // texto en los listados.
    const tx: Omit<Transaction, "id"> = {
      description: desc.trim() || categoryLabel(category, lang),
      amount: finalAmount,
      category: category as Transaction["category"],
      date,
      currency: txCurrency,
      originalAmount: txOriginalAmount,
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
      setToastError(t("economy.googleSheetsError"))
      setTimeout(() => setToastError(null), 3000)
    }

    setDesc("")
    setShowDescField(false)
    setTxType("gasto")
    setAmount("")
    setCategory(TRANSACTION_CATEGORIES[0])
    setCurrency(defaultCurrency)
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
    // Editar cambia directamente el importe ya convertido (en tu divisa
    // principal); si la transacción tenía una divisa original asociada, se
    // limpia aquí para no dejar un importe original desincronizado.
    updateTransaction(id, {
      description: editDesc.trim(),
      amount: num,
      category: editCategory as Transaction["category"],
      date: editDate,
      currency: null,
      originalAmount: null,
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
          <p className="font-semibold text-amber-600 dark:text-amber-400">{t("economy.noTransactions")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("economy.addFirstHint")}</p>
        </Card>
      )}

      {showForm && (
        <Card className="p-5 animate-in slide-in-from-top-4 duration-300">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("economy.newTransaction")}</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("economy.type")}</Label>
              <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setTxType("gasto")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    txType === "gasto" ? "bg-red-500/15 text-red-400 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("common.expense")}
                </button>
                <button
                  type="button"
                  onClick={() => setTxType("ingreso")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    txType === "ingreso" ? "bg-emerald-500/15 text-emerald-500 shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("common.income")}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">{t("economy.amount")}</Label>
              <div className="flex gap-2">
                <Input
                  id="tx-amount"
                  type="number"
                  min="0"
                  placeholder={t("economy.amountPlaceholder")}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1"
                />
                <select
                  aria-label={t("common.currency")}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-9 w-28 shrink-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("economy.amountHint")}
                {currency !== homeCurrency && t("economy.convertNotice", { currency: homeCurrency })}
              </p>
              {data.travelMode && data.travelCurrency && currency === data.travelCurrency && (
                <p className="text-xs text-primary">
                  {t("economy.travelModeHint", { currency: data.travelCurrency })}
                </p>
              )}
              {conversionError && <p className="text-xs text-red-500">{conversionError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-category">{t("economy.category")}</Label>
              <select
                id="tx-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {TRANSACTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{categoryLabel(c, lang)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">{t("economy.date")}</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setShowDescField((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <ChevronDown className={`size-3 transition-transform ${showDescField ? "rotate-180" : ""}`} />
                {showDescField ? t("economy.hideDescription") : t("economy.addDescription")}
              </button>
              {showDescField && (
                <Input
                  id="tx-desc"
                  placeholder={t("economy.descPlaceholder")}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <Button onClick={handleSave} disabled={saving || !amount} className="w-full">
              {saving ? t("common.saving") : t("common.save")}
            </Button>
            <div className="flex justify-center">
              <BatchAddDialog />
            </div>
          </div>
        </Card>
      )}

      {!showForm && (
        <div className="space-y-2">
          <Button
            onClick={() => {
              setCurrency(defaultCurrency)
              setShowForm(true)
            }}
            className="w-full"
            style={{ backgroundColor: "#7c6fff" }}
          >
            <Plus className="mr-2 size-4" />
            {t("economy.addButton")}
          </Button>
          <RecurringManagerDialog />
        </div>
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
            <p className="text-sm font-medium">{t("economy.monthBalance")}</p>
            <p className={`text-lg font-bold ${ahorro >= 0 ? "text-emerald-500" : "text-red-400"}`}>
              {ahorro >= 0 ? "+" : "-"}{currencySymbol(homeCurrency)}{Math.abs(ahorro).toFixed(2)}
            </p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${showSummary ? "rotate-180" : ""}`} />
        </button>

        {showSummary && (
          <div className="border-t border-border p-4">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <MiniStat label={t("economy.incomeMonth")} value={`+${currencySymbol(homeCurrency)}${ingresos.toFixed(2)}`} tone="green" />
              <MiniStat label={t("economy.spentMonth")} value={`-${currencySymbol(homeCurrency)}${gastos.toFixed(2)}`} tone="red" />
            </div>

          </div>
        )}
      </Card>

      {weeklySavingsData.length > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold">{t("economy.weeklySavings")}</p>
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySavingsData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#a1a1aa", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1d", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px", color: "#f4f4f5" }}
                  labelStyle={{ color: "#a1a1aa" }}
                  itemStyle={{ color: "#f4f4f5", fontWeight: 600 }}
                  formatter={(value: unknown) => [`${currencySymbol(homeCurrency)}${(Number(value) || 0).toFixed(2)}`, t("economy.savingsLabel")]}
                  labelFormatter={(label) => t("economy.week", { n: label.replace("W", "") })}
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
            <MiniStat label={t("economy.totalSaved")} value={`${allSavings >= 0 ? "+" : "-"}${currencySymbol(homeCurrency)}${Math.abs(allSavings).toFixed(2)}`} tone={allSavings >= 0 ? "green" : "red"} />
            {bestWeek && <MiniStat label={t("economy.best")} value={`+${currencySymbol(homeCurrency)}${bestWeek.savings.toFixed(2)}`} tone="green" />}
            {worstWeek && <MiniStat label={t("economy.worst")} value={`${worstWeek.savings >= 0 ? "+" : "-"}${currencySymbol(homeCurrency)}${Math.abs(worstWeek.savings).toFixed(2)}`} tone={worstWeek.savings >= 0 ? "green" : "red"} />}
          </div>
        </Card>
      )}

      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {[
          { id: "diario", label: t("common.daily") },
          { id: "semanal", label: t("common.weekly") },
          { id: "mensual", label: t("common.monthly") },
        ].map((tabOption) => (
          <button
            key={tabOption.id}
            onClick={() => setTab(tabOption.id as TabId)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === tabOption.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabOption.label}
          </button>
        ))}
      </div>

      {groupedData.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">{t("economy.noTransactionsRegistered")}</p>
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
                      {fmt(group.net, homeCurrency)}
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
                      const catColor = CATEGORY_COLOR[catGroup.category] ?? "#8a8a93"
                      const groupAbs = group.categories.reduce((s, c) => s + Math.abs(c.net), 0)
                      const catPct = groupAbs > 0 ? (Math.abs(catGroup.net) / groupAbs) * 100 : 0
                      return (
                        <div key={catKey}>
                          <button
                            onClick={() => setExpandedCategory(isCatExpanded ? null : catKey)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                          >
                            <div
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-base"
                              style={{ backgroundColor: catColor + "24" }}
                            >
                              {CATEGORY_EMOJI[catGroup.category] ?? "\u{1F4CC}"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{categoryLabel(catGroup.category, lang)}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {catGroup.transactions.length} {catGroup.transactions.length === 1 ? t("common.movement") : t("common.movements")}
                              </p>
                              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/5">
                                <div className="h-full rounded-full" style={{ width: `${catPct}%`, backgroundColor: catColor }} />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className={`text-sm font-semibold tabular-nums ${catGroup.net >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                {fmt(catGroup.net, homeCurrency)}
                              </p>
                              <p className="text-[9px] text-muted-foreground">
                                {catGroup.net >= 0 ? t("economy.incomeTag") : `${Math.round(catPct)}%`}
                              </p>
                            </div>
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
                                    <span className={`text-right text-xs font-semibold tabular-nums ${tx.amount >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                                      {tx.currency && tx.currency !== homeCurrency && tx.originalAmount != null && (
                                        <span className="mr-1.5 font-normal text-muted-foreground">
                                          {fmt(tx.originalAmount, tx.currency)}
                                        </span>
                                      )}
                                      {fmt(tx.amount, homeCurrency)}
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
                                              {t("common.expense")}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditType("ingreso")}
                                              className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
                                                editType === "ingreso" ? "bg-emerald-500/15 text-emerald-500" : "text-muted-foreground"
                                              }`}
                                            >
                                              {t("common.income")}
                                            </button>
                                          </div>
                                          <Input placeholder={t("economy.description")} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="h-8 text-sm" />
                                          <Input type="number" min="0" placeholder={t("economy.amount")} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="h-8 text-sm" />
                                          <select
                                            value={editCategory}
                                            onChange={(e) => setEditCategory(e.target.value)}
                                            className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                                          >
                                            {TRANSACTION_CATEGORIES.map((c) => (
                                              <option key={c} value={c}>{categoryLabel(c, lang)}</option>
                                            ))}
                                          </select>
                                          <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-8 text-sm" />
                                          <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEditing}>
                                              {t("common.cancel")}
                                            </Button>
                                            <Button size="sm" className="h-7 text-xs" disabled={editSaving || !editDesc.trim() || !editAmount} onClick={() => handleUpdate(tx.id)}>
                                              {editSaving ? t("common.saving") : t("common.save")}
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex justify-end gap-2">
                                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startEditing(tx)}>
                                            <Pencil className="mr-1 size-3" />
                                            {t("common.edit")}
                                          </Button>
                                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-500" onClick={() => deleteTransaction(tx.id)}>
                                            <X className="mr-1 size-3" />
                                            {t("common.delete")}
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
  const color = tone === "green" ? "text-emerald-400" : tone === "red" ? "text-red-400" : "text-zinc-100"
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-2 text-center">
      <p className="text-[10px] text-zinc-400">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  )
}
