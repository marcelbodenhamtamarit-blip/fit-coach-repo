"use client"

// Pop-up que muestra el aviso de una automatización disparada con acción
// "popup"/"both", pendiente de ver (automation_events.popup_seen = false).
// Se monta una vez en Dashboard, al lado de RecurringReviewDialog — mismo
// patrón: se dispara solo al detectar eventos pendientes, sin que nadie
// tenga que abrirlo a mano.

import { Bell } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAutomations } from "@/lib/automations-store"
import { useStore } from "@/lib/store"

export function AutomationPopup() {
  const { pendingPopupEvents, dismissPopupEvent } = useAutomations()
  const { t } = useStore()

  const current = pendingPopupEvents[0]
  const open = !!current

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && current) dismissPopupEvent(current.id) }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Bell className="size-4" />
          </div>
          <DialogTitle>{current?.title}</DialogTitle>
          <DialogDescription>{current?.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => current && dismissPopupEvent(current.id)}>{t("recurringReview.done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
