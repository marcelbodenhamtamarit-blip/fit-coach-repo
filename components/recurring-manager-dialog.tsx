"use client"

import { useState } from "react"
import { CalendarClock, Plus, Repeat, Trash2 } from "lucide-react"
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
import {
  CURRENCIES,
  TRANSACTION_CATEGORIES,
  currencySymbol,
  type RecurringFrequency,
  type RecurringTransaction,
} from "@/lib/types"
import { supabase } from "@/lib/supabase"
import { convertAmount } from "@/lib/exchange-rates"
import { categoryLabel, weekdayLabel, type Language } from "@/lib/i18n"

type TxType = "gasto" | "ingreso"

function fmt(amount: number, symbol: string): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount >= 0 ? `+${symbol}${abs}` : `-${symbol}${abs}`
}

function defaultPayDay(frequency: RecurringFrequency): number {
  return frequency === "weekly" ? 0 : 1
}

// Gestión de plantillas de gastos/ingresos recurrentes: alquiler,
// suscripciones, nómina (mensuales) o la compra semanal, la paga de los
// peques, etc (semanales). Según su frecuencia y su día de pago se generan
// solas como transacciones reales (ver runRecurringGeneration en
// lib/store.tsx) y el popup de revisión (recurring-review-dialog.tsx) avisa
// de lo que se creó.
export function RecurringManagerDialog() {
  const { data, addRecurring, updateRecurring, deleteRecurring, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const recurring: RecurringTransaction[] = data.recurring ?? []
  const homeCurrency = data.homeCurrency

  const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
    monthly: t("common.monthly"),
    weekly: t("common.weekly"),
  }

  const [showForm, setShowForm] = useState(false)
  const [desc, setDesc] = useState("")
  const [txType, setTxType] = useState<TxType>("gasto")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<string>(homeCurrency)
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly")
  const [payDay, setPayDay] = useState<number>(1)
  const [saving, setSaving] = useState(false)
  const [conversionError, setConversionError] = useState("")

  const handleAdd = async () => {
    const raw = parseFloat(amount)
    if (!desc.trim() || isNaN(raw)) return
    setSaving(true)
    setConversionError("")

    const num = txType === "gasto" ? -Math.abs(raw) : Math.abs(raw)

    // Igual que en el alta de transacciones sueltas: si se elige una divisa
    // distinta a la principal, se convierte una vez aquí (con la tasa del
    // día) y la plantilla recurrente se queda ya en la divisa principal —
    // no hace falta reconvertir cada vez que se genera una transacción real.
    let finalAmount = num
    if (currency !== homeCurrency) {
      try {
        finalAmount = await convertAmount(num, currency, homeCurrency, supabase)
      } catch {
        setSaving(false)
        setConversionError(t("economy.conversionError"))
        return
      }
    }

    addRecurring({
      description: desc.trim(),
      amount: finalAmount,
      category: category as RecurringTransaction["category"],
      active: true,
      frequency,
      payDay,
    })
    setDesc("")
    setTxType("gasto")
    setAmount("")
    setCurrency(homeCurrency)
    setCategory(TRANSACTION_CATEGORIES[0])
    setFrequency("monthly")
    setPayDay(1)
    setShowForm(false)
    setSaving(false)
  }

  const toggleFrequency = (r: RecurringTransaction) => {
    const nextFrequency: RecurringFrequency = r.frequency === "monthly" ? "weekly" : "monthly"
    updateRecurring(r.id, { frequency: nextFrequency, payDay: defaultPayDay(nextFrequency) })
  }

  const changeFormFrequency = (next: RecurringFrequency) => {
    setFrequency(next)
    setPayDay(defaultPayDay(next))
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        <Repeat className="mr-2 size-4" />
        {t("recurring.title")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Repeat className="size-4.5" />
          </div>
          <DialogTitle>{t("recurring.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("recurring.dialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {recurring.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CalendarClock className="size-5" />
              </div>
              <p className="text-sm text-muted-foreground">{t("recurring.empty")}</p>
            </div>
          )}
          {recurring.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border bg-card/40 p-3 transition-colors hover:border-muted-foreground/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.description}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{categoryLabel(r.category, lang)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`text-sm font-semibold tabular-nums ${r.amount >= 0 ? "text-emerald-500" : "text-red-400"}`}
                  >
                    {fmt(r.amount, currencySymbol(homeCurrency))}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground opacity-60 hover:text-red-500 hover:opacity-100"
                    onClick={() => deleteRecurring(r.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleFrequency(r)}
                  className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70"
                >
                  {FREQUENCY_LABEL[r.frequency]}
                </button>

                <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  <CalendarClock className="size-3" />
                  <select
                    value={r.payDay}
                    onChange={(e) => updateRecurring(r.id, { payDay: Number(e.target.value) })}
                    className="appearance-none bg-transparent pr-0.5 focus-visible:outline-none"
                  >
                    {r.frequency === "weekly"
                      ? Array.from({ length: 7 }, (_, idx) => idx).map((idx) => (
                          <option key={idx} value={idx} className="bg-background text-foreground">
                            {weekdayLabel(idx, lang)}
                          </option>
                        ))
                      : Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d} className="bg-background text-foreground">
                            {t("recurring.day", { n: d })}
                          </option>
                        ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => updateRecurring(r.id, { active: !r.active })}
                  className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    r.active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.active ? t("recurring.active") : t("recurring.paused")}
                </button>
              </div>
            </div>
          ))}
        </div>

        {showForm ? (
          <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("economy.type")}</p>
              <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setTxType("gasto")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    txType === "gasto" ? "bg-red-500/15 text-red-400" : "text-muted-foreground"
                  }`}
                >
                  {t("common.expense")}
                </button>
                <button
                  type="button"
                  onClick={() => setTxType("ingreso")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    txType === "ingreso" ? "bg-emerald-500/15 text-emerald-500" : "text-muted-foreground"
                  }`}
                >
                  {t("common.income")}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("recurring.frequency")}</p>
              <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => changeFormFrequency("monthly")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    frequency === "monthly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t("common.monthly")}
                </button>
                <button
                  type="button"
                  onClick={() => changeFormFrequency("weekly")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    frequency === "weekly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t("common.weekly")}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {frequency === "weekly" ? t("recurring.dayOfWeek") : t("recurring.dayOfMonth")}
              </p>
              <select
                value={payDay}
                onChange={(e) => setPayDay(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {frequency === "weekly"
                  ? Array.from({ length: 7 }, (_, idx) => idx).map((idx) => (
                      <option key={idx} value={idx}>
                        {weekdayLabel(idx, lang)}
                      </option>
                    ))
                  : Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {t("recurring.day", { n: d })}
                      </option>
                    ))}
              </select>
            </div>

            <Input placeholder={t("recurring.descPlaceholder")} value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <Input
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
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              {currency !== homeCurrency && (
                <p className="text-xs text-muted-foreground">
                  {t("economy.convertNotice", { currency: homeCurrency })}
                </p>
              )}
              {conversionError && <p className="text-xs text-red-500">{conversionError}</p>}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {TRANSACTION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, lang)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1" disabled={saving || !desc.trim() || !amount} onClick={handleAdd}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 size-4" />
            {t("recurring.addNew")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
