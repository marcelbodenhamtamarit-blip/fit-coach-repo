"use client"

import { useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"
import { currencySymbol, type Transaction } from "@/lib/types"
import { categoryLabel, type Language } from "@/lib/i18n"

function fmt(amount: number, symbol: string): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount >= 0 ? `+${symbol}${abs}` : `-${symbol}${abs}`
}

// Popup que aparece cuando, al abrir la app, se han creado solas las
// transacciones del mes a partir de las plantillas recurrentes activas.
// Deja revisar el importe o borrar cualquiera antes de darlas por buenas.
export function RecurringReviewDialog() {
  const { data, pendingReview, reviewOpen, dismissReview, updateTransaction, deleteTransaction, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const symbol = currencySymbol(data.homeCurrency)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())

  const items = pendingReview.filter((t) => !removedIds.has(t.id))

  const startEdit = (t: Transaction) => {
    setEditingId(t.id)
    setEditAmount(String(Math.abs(t.amount)))
  }

  const saveEdit = (t: Transaction) => {
    const raw = parseFloat(editAmount)
    if (!isNaN(raw)) {
      const signed = t.amount >= 0 ? Math.abs(raw) : -Math.abs(raw)
      updateTransaction(t.id, { amount: signed })
    }
    setEditingId(null)
  }

  const remove = (t: Transaction) => {
    deleteTransaction(t.id)
    setRemovedIds((s) => new Set(s).add(t.id))
  }

  return (
    <Dialog
      open={reviewOpen}
      onOpenChange={(open) => {
        if (!open) dismissReview()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("recurringReview.title")}</DialogTitle>
          <DialogDescription>{t("recurringReview.desc")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {items.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("recurringReview.empty")}</p>
          )}
          {items.map((tx) => (
            <div key={tx.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{categoryLabel(tx.category, lang)}</p>
              </div>
              {editingId === tx.id ? (
                <>
                  <Input
                    type="number"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="h-8 w-24 text-sm"
                  />
                  <Button size="icon-sm" variant="ghost" onClick={() => saveEdit(tx)}>
                    <Check className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className={`text-sm font-semibold tabular-nums ${tx.amount >= 0 ? "text-emerald-500" : "text-red-400"}`}
                  >
                    {fmt(tx.amount, symbol)}
                  </span>
                  <Button size="icon-sm" variant="ghost" onClick={() => startEdit(tx)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-500"
                    onClick={() => remove(tx)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={dismissReview} className="w-full">
            {t("recurringReview.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
