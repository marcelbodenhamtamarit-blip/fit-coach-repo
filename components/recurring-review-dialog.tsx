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
import type { Transaction } from "@/lib/types"

function fmt(amount: number): string {
  const abs = Math.abs(amount).toFixed(2)
  return amount >= 0 ? `+$${abs}` : `-$${abs}`
}

// Popup que aparece cuando, al abrir la app, se han creado solas las
// transacciones del mes a partir de las plantillas recurrentes activas.
// Deja revisar el importe o borrar cualquiera antes de darlas por buenas.
export function RecurringReviewDialog() {
  const { pendingReview, reviewOpen, dismissReview, updateTransaction, deleteTransaction } = useStore()
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
          <DialogTitle>Gastos recurrentes de este mes</DialogTitle>
          <DialogDescription>
            Se han añadido solos porque los marcaste como recurrentes. Revisa que estén bien, edita el importe si
            cambió, o bórralos si este mes no toca.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto">
          {items.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nada más que revisar.</p>
          )}
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground">{t.category}</p>
              </div>
              {editingId === t.id ? (
                <>
                  <Input
                    type="number"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="h-8 w-24 text-sm"
                  />
                  <Button size="icon-sm" variant="ghost" onClick={() => saveEdit(t)}>
                    <Check className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span
                    className={`text-sm font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-500" : "text-red-400"}`}
                  >
                    {fmt(t.amount)}
                  </span>
                  <Button size="icon-sm" variant="ghost" onClick={() => startEdit(t)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-500"
                    onClick={() => remove(t)}
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
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
