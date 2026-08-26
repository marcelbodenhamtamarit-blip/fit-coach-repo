"use client"

import { useState } from "react"
import { ListPlus, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"
import { todayISO, uid, TRANSACTION_CATEGORIES, CURRENCIES, type Transaction } from "@/lib/types"
import { supabase } from "@/lib/supabase"
import { convertAmount } from "@/lib/exchange-rates"
import { categoryLabel, type Language } from "@/lib/i18n"

const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

type TxType = "gasto" | "ingreso"

type DraftRow = {
  key: string
  type: TxType
  amount: string
  category: string
  date: string
}

function newRow(): DraftRow {
  return { key: uid(), type: "gasto", amount: "", category: TRANSACTION_CATEGORIES[0], date: todayISO() }
}

// Copiado tal cual de economy-section.tsx: mismo criterio de semana ISO
// (domingo a sábado) que usa el resto de la app para agrupar por semana,
// necesario aquí solo para mandar el número de semana al webhook de
// Google Sheets igual que hace el alta individual.
function getWeekNumberFromISO(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00Z")
  const jan4 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const dayOfWeek = jan4.getUTCDay()
  const week1Start = new Date(jan4)
  week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek)
  const diffDays = Math.floor((date.getTime() - week1Start.getTime()) / (24 * 60 * 60 * 1000))
  return 1 + Math.floor(diffDays / 7)
}

// Alta en lote: varias filas (importe, tipo, categoría, fecha) rellenadas
// de golpe y guardadas en una sola pasada — pensado para cuando vuelves de
// un viaje o tienes varios gastos sueltos pendientes de apuntar, en vez de
// abrir el formulario normal una vez por cada uno. Todas las filas
// comparten una única divisa (la de viaje por defecto, si está activo el
// modo viaje) porque el caso de uso típico es "un montón de gastos de un
// mismo sitio", no mezclar varias divisas en la misma tanda — para eso
// sigue estando el alta individual.
export function BatchAddDialog() {
  const { data, addTransactions, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const homeCurrency = data.homeCurrency
  const defaultCurrency = data.travelMode && data.travelCurrency ? data.travelCurrency : homeCurrency

  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState<string>(defaultCurrency)
  const [rows, setRows] = useState<DraftRow[]>(() => [newRow()])
  const [saving, setSaving] = useState(false)
  const [conversionError, setConversionError] = useState("")

  const validRows = rows.filter((r) => {
    const n = parseFloat(r.amount)
    return !isNaN(n) && n !== 0
  })

  const updateRow = (key: string, updates: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...updates } : r)))

  const addRow = () => setRows((rs) => [...rs, newRow()])

  const removeRow = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs))

  const resetForm = () => {
    setRows([newRow()])
    setCurrency(defaultCurrency)
    setConversionError("")
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setCurrency(defaultCurrency)
    else resetForm()
  }

  const handleSaveAll = async () => {
    if (validRows.length === 0) return
    setSaving(true)
    setConversionError("")

    // Si la divisa elegida no es la principal, se convierte fila a fila
    // (misma tasa del día, cacheada por getExchangeRates) igual que hace
    // el alta individual — el importe original tal cual se pagó y el
    // convertido a la divisa principal se guardan ambos.
    const items: Omit<Transaction, "id">[] = []
    for (const row of validRows) {
      const raw = parseFloat(row.amount)
      const num = row.type === "gasto" ? -Math.abs(raw) : Math.abs(raw)

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

      items.push({
        description: categoryLabel(row.category, lang),
        amount: finalAmount,
        category: row.category as Transaction["category"],
        date: row.date,
        currency: txCurrency,
        originalAmount: txOriginalAmount,
      })
    }

    addTransactions(items)

    // Best-effort, igual que el alta individual: si el webhook falla no
    // bloquea nada, las transacciones ya quedaron guardadas en Supabase.
    items.forEach((tx) => {
      const weekNum = getWeekNumberFromISO(tx.date)
      const formattedAmount = tx.amount.toFixed(2).replace(".", ",")
      fetch(GOOGLE_SHEETS_WEBHOOK, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: weekNum,
          category: tx.category,
          amount: formattedAmount,
          date: tx.date.split("-").reverse().join("/"),
        }),
      }).catch(() => {})
    })

    setSaving(false)
    setOpen(false)
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        <ListPlus className="mr-2 size-4" />
        {t("batch.trigger")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ListPlus className="size-4.5" />
          </div>
          <DialogTitle>{t("batch.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("batch.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("common.currency")}</p>
          <select
            aria-label={t("common.currency")}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="flex h-9 w-28 shrink-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          {currency !== homeCurrency && (
            <p className="text-xs text-muted-foreground">{t("economy.convertNotice", { currency: homeCurrency })}</p>
          )}
          {conversionError && <p className="text-xs text-red-500">{conversionError}</p>}
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {rows.map((row, idx) => (
            <div key={row.key} className="space-y-2 rounded-xl border border-border bg-card/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
                  <button
                    type="button"
                    onClick={() => updateRow(row.key, { type: "gasto" })}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      row.type === "gasto" ? "bg-red-500/15 text-red-400" : "text-muted-foreground"
                    }`}
                  >
                    {t("common.expense")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRow(row.key, { type: "ingreso" })}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      row.type === "ingreso" ? "bg-emerald-500/15 text-emerald-500" : "text-muted-foreground"
                    }`}
                  >
                    {t("common.income")}
                  </button>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("batch.removeRow")}
                  className="text-muted-foreground opacity-60 hover:text-red-500 hover:opacity-100"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder={t("economy.amountPlaceholder")}
                  value={row.amount}
                  onChange={(e) => updateRow(row.key, { amount: e.target.value })}
                  className="flex-1"
                  autoFocus={idx === rows.length - 1 && idx > 0}
                />
                <select
                  value={row.category}
                  onChange={(e) => updateRow(row.key, { category: e.target.value })}
                  className="flex h-9 w-32 shrink-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {TRANSACTION_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {categoryLabel(c, lang)}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                type="date"
                value={row.date}
                onChange={(e) => updateRow(row.key, { date: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full" onClick={addRow}>
          <Plus className="mr-2 size-4" />
          {t("batch.addRow")}
        </Button>

        <Button className="w-full" disabled={saving || validRows.length === 0} onClick={handleSaveAll}>
          {saving ? t("common.saving") : t("batch.saveAll", { n: validRows.length })}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
