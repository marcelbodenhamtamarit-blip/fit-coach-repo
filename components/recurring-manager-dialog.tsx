"use client"

import { useState } from "react"
import { Plus, Repeat, Trash2 } from "lucide-react"
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
import { TRANSACTION_CATEGORIES, type RecurringFrequency, type RecurringTransaction } from "@/lib/types"

type TxType = "gasto" | "ingreso"

function fmt(amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount >= 0 ? `+$${abs}` : `-$${abs}`
}

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  monthly: "Mensual",
  weekly: "Semanal",
}

// Gestión de plantillas de gastos/ingresos recurrentes: alquiler,
// suscripciones, nómina (mensuales) o la compra semanal, la paga de los
// peques, etc (semanales). Según su frecuencia se generan solas como
// transacciones reales (ver runRecurringGeneration en lib/store.tsx) y el
// popup de revisión (recurring-review-dialog.tsx) avisa de lo que se creó.
export function RecurringManagerDialog() {
  const { data, addRecurring, updateRecurring, deleteRecurring } = useStore()
  const recurring: RecurringTransaction[] = data.recurring ?? []

  const [showForm, setShowForm] = useState(false)
  const [desc, setDesc] = useState("")
  const [txType, setTxType] = useState<TxType>("gasto")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<string>(TRANSACTION_CATEGORIES[0])
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly")
  const [saving, setSaving] = useState(false)

  const handleAdd = () => {
    const raw = parseFloat(amount)
    if (!desc.trim() || isNaN(raw)) return
    setSaving(true)
    addRecurring({
      description: desc.trim(),
      amount: txType === "gasto" ? -Math.abs(raw) : Math.abs(raw),
      category: category as RecurringTransaction["category"],
      active: true,
      frequency,
    })
    setDesc("")
    setTxType("gasto")
    setAmount("")
    setCategory(TRANSACTION_CATEGORIES[0])
    setFrequency("monthly")
    setShowForm(false)
    setSaving(false)
  }

  const toggleFrequency = (r: RecurringTransaction) => {
    updateRecurring(r.id, { frequency: r.frequency === "monthly" ? "weekly" : "monthly" })
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        <Repeat className="mr-2 size-4" />
        Gastos recurrentes
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gastos e ingresos recurrentes</DialogTitle>
          <DialogDescription>
            Elige mensual o semanal y se crean solas al empezar cada periodo (alquiler, suscripciones, nómina... o la
            compra semanal). Al abrir la app te avisamos con un popup para que los revises.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {recurring.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Aún no tienes ninguno.</p>
          )}
          {recurring.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.description}</p>
                <p className="text-xs text-muted-foreground">{r.category}</p>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${r.amount >= 0 ? "text-emerald-500" : "text-red-400"}`}
              >
                {fmt(r.amount)}
              </span>
              <button
                type="button"
                onClick={() => toggleFrequency(r)}
                className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors"
              >
                {FREQUENCY_LABEL[r.frequency]}
              </button>
              <button
                type="button"
                onClick={() => updateRecurring(r.id, { active: !r.active })}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  r.active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
                }`}
              >
                {r.active ? "Activo" : "Pausado"}
              </button>
              <Button
                size="icon-sm"
                variant="ghost"
                className="shrink-0 text-red-500 hover:text-red-500"
                onClick={() => deleteRecurring(r.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        {showForm ? (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setTxType("gasto")}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  txType === "gasto" ? "bg-red-500/15 text-red-400" : "text-muted-foreground"
                }`}
              >
                Gasto (−)
              </button>
              <button
                type="button"
                onClick={() => setTxType("ingreso")}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  txType === "ingreso" ? "bg-emerald-500/15 text-emerald-500" : "text-muted-foreground"
                }`}
              >
                Ganancia (+)
              </button>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setFrequency("monthly")}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  frequency === "monthly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setFrequency("weekly")}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  frequency === "weekly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Semanal
              </button>
            </div>
            <Input placeholder="Ej: Alquiler" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <Input
              type="number"
              min="0"
              placeholder="Cantidad en AUD"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <select
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
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={saving || !desc.trim() || !amount} onClick={handleAdd}>
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 size-4" />
            Añadir recurrente
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
