"use client"

// Turnos: calendario semanal de turnos de trabajo, inspirado en Homebase.
// Cada día de la semana muestra si hay un turno planificado/cobrado, sus
// horas y lo que se espera ganar (bruto y neto estimado según la tarifa e
// impuestos de Ajustes > Turnos). Marcar un turno como "cobrado" crea una
// transacción real de ingreso en Economía (ver lib/shifts-store.tsx).

import { useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  Banknote,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore } from "@/lib/store"
import { useShifts } from "@/lib/shifts-store"
import {
  SHIFT_TYPES,
  currencySymbol,
  shiftGrossPay,
  shiftNetPay,
  shiftTypeForDate,
  todayISO,
  type Shift,
  type ShiftType,
} from "@/lib/types"
import { weekdayLabel, type Language } from "@/lib/i18n"
import { getWeekStart, getWeekNumberFromISO, getWeekDateRangeFromNum } from "@/lib/week"

function fmtMoney(amount: number, symbol: string): string {
  return `${symbol}${amount.toFixed(2)}`
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00")
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function dayOfMonth(dateISO: string): number {
  return Number(dateISO.slice(8, 10))
}

// A partir de dos horas "HH:MM", cuántas se han trabajado — si la salida es
// antes que la entrada, se asume que el turno cruza la medianoche.
function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (minutes <= 0) minutes += 24 * 60
  return Math.round((minutes / 60) * 100) / 100
}

const STATUS_STYLE: Record<Shift["status"], string> = {
  planificado: "bg-muted text-muted-foreground",
  cobrado: "bg-emerald-500/15 text-emerald-500",
}

const SHIFT_TYPE_COLOR: Record<ShiftType, string> = {
  normal: "#60a5fa",
  sabado: "#fbbf24",
  domingo: "#f472b6",
}

export function TurnosSection() {
  const { data, t } = useStore()
  const { shifts, ready } = useShifts()
  const lang = (data.language as Language) ?? "es"
  const weekStartDay = data.weekStartDay ?? 0
  const symbol = currencySymbol(data.homeCurrency)
  const hourlyRate = data.shiftHourlyRate ?? 34.6
  const taxPct = data.shiftTaxPct ?? 15

  const [weekAnchor, setWeekAnchor] = useState(todayISO())
  const [editingDate, setEditingDate] = useState<string | null>(null)

  const weekStart = useMemo(
    () => getWeekStart(new Date(weekAnchor + "T00:00:00"), weekStartDay),
    [weekAnchor, weekStartDay],
  )
  const weekStartISOValue = useMemo(() => {
    const y = weekStart.getFullYear()
    const m = String(weekStart.getMonth() + 1).padStart(2, "0")
    const d = String(weekStart.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }, [weekStart])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISOValue, i)),
    [weekStartISOValue],
  )

  const weekNum = getWeekNumberFromISO(weekStartISOValue, weekStartDay)
  const { start: rangeStart, end: rangeEnd } = getWeekDateRangeFromNum(weekNum, weekStartDay)

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift>()
    for (const s of shifts) map.set(s.date, s)
    return map
  }, [shifts])

  const weekShifts = days.map((d) => shiftsByDate.get(d)).filter((s): s is Shift => !!s)
  const totalHours = weekShifts.reduce((sum, s) => sum + s.hours, 0)
  const totalGross = weekShifts.reduce((sum, s) => sum + shiftGrossPay(s.hours, s.shiftType, hourlyRate), 0)
  const totalNet = weekShifts.reduce(
    (sum, s) => sum + shiftNetPay(s.hours, s.shiftType, hourlyRate, taxPct),
    0,
  )

  const editingShift = editingDate ? shiftsByDate.get(editingDate) ?? null : null

  return (
    <div className="max-w-2xl space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button size="icon-sm" variant="outline" onClick={() => setWeekAnchor((d) => addDaysISO(d, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-semibold">{t("economy.week", { n: weekNum })}</p>
            <p className="text-xs text-muted-foreground">
              {rangeStart} - {rangeEnd}
            </p>
          </div>
          <Button size="icon-sm" variant="outline" onClick={() => setWeekAnchor((d) => addDaysISO(d, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">{t("turnos.hoursTotal")}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{totalHours.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="text-[11px] text-muted-foreground">{t("turnos.grossTotal")}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtMoney(totalGross, symbol)}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2.5">
            <p className="text-[11px] text-muted-foreground">{t("turnos.netTotal")}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-500">
              {fmtMoney(totalNet, symbol)}
            </p>
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {!ready ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("common.loadingData")}</p>
        ) : (
          days.map((date) => {
            const shift = shiftsByDate.get(date)
            const weekday = new Date(date + "T00:00:00").getDay()
            const isToday = date === todayISO()

            return (
              <Card key={date} className="p-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-11 shrink-0 flex-col items-center justify-center rounded-lg ${
                      isToday ? "bg-primary/15 text-primary" : "bg-muted/50 text-foreground"
                    }`}
                  >
                    <span className="text-[9px] font-medium uppercase leading-none">
                      {weekdayLabel(weekday, lang).slice(0, 3)}
                    </span>
                    <span className="text-base font-semibold leading-tight">{dayOfMonth(date)}</span>
                  </div>

                  {shift ? (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: SHIFT_TYPE_COLOR[shift.shiftType] + "26", color: SHIFT_TYPE_COLOR[shift.shiftType] }}
                        >
                          {t(`turnos.shiftType.${shift.shiftType}`)}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[shift.status]}`}>
                          {shift.status === "cobrado" ? t("turnos.statusPaid") : t("turnos.statusPlanned")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">
                        <span className="font-semibold tabular-nums">{shift.hours}h</span>
                        <span className="text-muted-foreground"> · {fmtMoney(shiftGrossPay(shift.hours, shift.shiftType, hourlyRate), symbol)}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1 text-sm text-muted-foreground">{t("turnos.noShift")}</div>
                  )}

                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => setEditingDate(date)}
                    aria-label={shift ? t("turnos.editShift") : t("turnos.addShift")}
                  >
                    {shift ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
                  </Button>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {editingDate && (
        <ShiftDialog
          date={editingDate}
          shift={editingShift}
          hourlyRate={hourlyRate}
          taxPct={taxPct}
          symbol={symbol}
          onClose={() => setEditingDate(null)}
        />
      )}

      <p className="pb-2 pt-1 text-center text-[11px] text-muted-foreground">
        ZentOS · {t("app.tagline")}
      </p>
    </div>
  )
}

const timeInputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function ShiftDialog({
  date,
  shift,
  hourlyRate,
  taxPct,
  symbol,
  onClose,
}: {
  date: string
  shift: Shift | null
  hourlyRate: number
  taxPct: number
  symbol: string
  onClose: () => void
}) {
  const { t } = useStore()
  const { addShift, updateShift, deleteShift, markShiftPaid, markShiftUnpaid } = useShifts()

  const [startTime, setStartTime] = useState(shift?.startTime ?? "")
  const [endTime, setEndTime] = useState(shift?.endTime ?? "")
  const [hours, setHours] = useState(shift ? String(shift.hours) : "")
  const [shiftType, setShiftType] = useState<ShiftType>(shift?.shiftType ?? shiftTypeForDate(date))
  const [notes, setNotes] = useState(shift?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [confirmingPaid, setConfirmingPaid] = useState(false)
  const [netInput, setNetInput] = useState("")

  const locked = shift?.status === "cobrado"

  function calcHoursFromTimes() {
    if (startTime && endTime) {
      setHours(String(hoursBetween(startTime, endTime)))
    }
  }

  const hoursNum = parseFloat(hours) || 0
  const gross = shiftGrossPay(hoursNum, shiftType, hourlyRate)
  const netEstimate = shiftNetPay(hoursNum, shiftType, hourlyRate, taxPct)

  async function handleSave() {
    const parsedHours = parseFloat(hours)
    if (isNaN(parsedHours) || parsedHours <= 0) return
    setSaving(true)

    if (shift) {
      await updateShift(shift.id, {
        startTime: startTime || null,
        endTime: endTime || null,
        hours: parsedHours,
        shiftType,
        notes: notes.trim() || null,
      })
    } else {
      await addShift({
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        hours: parsedHours,
        shiftType,
        notes: notes.trim() || null,
      })
    }
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    if (!shift) return
    setSaving(true)
    await deleteShift(shift)
    setSaving(false)
    onClose()
  }

  function openConfirmPaid() {
    setNetInput(netEstimate.toFixed(2))
    setConfirmingPaid(true)
  }

  async function handleConfirmPaid() {
    if (!shift) return
    const amount = parseFloat(netInput)
    if (isNaN(amount)) return
    setSaving(true)
    await markShiftPaid(shift, amount)
    setSaving(false)
    onClose()
  }

  async function handleUnmarkPaid() {
    if (!shift) return
    setSaving(true)
    await markShiftUnpaid(shift)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <CalendarDays className="size-4.5" />
          </div>
          <DialogTitle>{shift ? t("turnos.editShift") : t("turnos.addShift")}</DialogTitle>
          <DialogDescription>{date}</DialogDescription>
        </DialogHeader>

        {confirmingPaid ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("turnos.confirmPaidDesc")}</p>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("turnos.netEstimate")}</p>
              <Input
                type="number"
                step="0.01"
                value={netInput}
                onChange={(e) => setNetInput(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirmingPaid(false)} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1" onClick={handleConfirmPaid} disabled={saving || !netInput}>
                {t("turnos.confirmPaidButton")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("turnos.startTime")}</p>
                <Input
                  type="time"
                  value={startTime}
                  disabled={locked}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("turnos.endTime")}</p>
                <Input
                  type="time"
                  value={endTime}
                  disabled={locked}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {!locked && startTime && endTime && (
              <button
                type="button"
                onClick={calcHoursFromTimes}
                className="text-xs font-medium text-primary underline underline-offset-2"
              >
                {t("turnos.calcHours")}
              </button>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("turnos.hours")}</p>
              <Input
                type="number"
                step="0.25"
                min="0"
                value={hours}
                disabled={locked}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("turnos.shiftType")}</p>
              <select
                value={shiftType}
                disabled={locked}
                onChange={(e) => setShiftType(e.target.value as ShiftType)}
                className={timeInputClass}
              >
                {SHIFT_TYPES.map((st) => (
                  <option key={st} value={st}>
                    {t(`turnos.shiftType.${st}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("turnos.notes")}</p>
              <Input
                value={notes}
                placeholder={t("turnos.notesPlaceholder")}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {locked && <p className="text-xs text-muted-foreground">{t("turnos.lockedNote")}</p>}

            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("turnos.gross")}</span>
                <span className="font-semibold tabular-nums">{fmtMoney(gross, symbol)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">{t("turnos.netEstimate")}</span>
                <span className="font-semibold tabular-nums text-emerald-500">{fmtMoney(netEstimate, symbol)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onClose} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving || !hours}>
                {t("common.save")}
              </Button>
            </div>

            {shift && (
              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                {shift.status === "cobrado" ? (
                  <Button variant="outline" size="sm" onClick={handleUnmarkPaid} disabled={saving}>
                    <Wallet className="size-3.5" />
                    {t("turnos.markUnpaid")}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={openConfirmPaid} disabled={saving}>
                    <Banknote className="size-3.5" />
                    {t("turnos.markPaid")}
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground opacity-60 hover:text-red-500 hover:opacity-100"
                  onClick={handleDelete}
                  disabled={saving}
                  aria-label={t("turnos.deleteShift")}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
