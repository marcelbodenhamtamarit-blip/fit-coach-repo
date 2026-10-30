"use client"

// Apartado de ahorro de la pareja ("avisar a papi"): objetivo fijo (cantidad
// + cada cuánto) y un check-in manual por periodo. Si no llega al
// objetivo, puede avisar ella misma con un botón (POST /api/partner/report)
// -- nada automático. Ver lib/partner-savings-store.tsx y
// supabase-migrations/partner-savings.sql.
import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Send } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { usePartnerSavings } from "@/lib/partner-savings-store"
import { supabase } from "@/lib/supabase"
import {
  currencySymbol,
  currentPeriodKey,
  periodLabel,
  SAVINGS_FREQUENCIES,
  type SavingsFrequency,
} from "@/lib/types"
import { type Language } from "@/lib/i18n"

function fmt(amount: number, currency: string): string {
  return `${currencySymbol(currency)}${amount.toFixed(2)}`
}

export function PartnerSavingsSection() {
  const { data, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const { goal, checkins, ready, setGoal, saveCheckin, markReported } = usePartnerSavings()

  // --- Objetivo: formulario inicial, o edición si ya hay uno ---
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalAmount, setGoalAmount] = useState("")
  const [goalFrequency, setGoalFrequency] = useState<SavingsFrequency>("weekly")
  const [goalSaving, setGoalSaving] = useState(false)
  const [goalError, setGoalError] = useState<string | null>(null)

  const startEditingGoal = () => {
    setGoalAmount(goal ? String(goal.targetAmount) : "")
    setGoalFrequency(goal?.frequency ?? "weekly")
    setGoalError(null)
    setEditingGoal(true)
  }

  const saveGoal = async () => {
    const n = Number(goalAmount.replace(",", "."))
    if (!isFinite(n) || n <= 0) {
      setGoalError(t("partnerSavings.goalInvalid"))
      return
    }
    setGoalSaving(true)
    setGoalError(null)
    try {
      await setGoal(n, goalFrequency, goal?.currency ?? data.homeCurrency)
      setEditingGoal(false)
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : t("settings.saveError"))
    } finally {
      setGoalSaving(false)
    }
  }

  // --- Check-in del periodo actual ---
  const periodKey = goal ? currentPeriodKey(goal.frequency, data.weekStartDay) : null
  const currentCheckin = useMemo(
    () => (periodKey ? checkins.find((c) => c.periodKey === periodKey) ?? null : null),
    [checkins, periodKey],
  )
  const pastCheckins = useMemo(() => checkins.filter((c) => c.periodKey !== periodKey), [checkins, periodKey])

  const [checkinAmount, setCheckinAmount] = useState("")
  const [checkinSaving, setCheckinSaving] = useState(false)
  const [checkinError, setCheckinError] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const saveTodayCheckin = async () => {
    if (!goal || !periodKey) return
    const n = Number(checkinAmount.replace(",", "."))
    if (!isFinite(n) || n < 0) {
      setCheckinError(t("partnerSavings.checkinInvalid"))
      return
    }
    setCheckinSaving(true)
    setCheckinError(null)
    try {
      await saveCheckin(periodKey, n, n >= goal.targetAmount)
      setCheckinAmount("")
    } catch (err) {
      setCheckinError(err instanceof Error ? err.message : t("settings.saveError"))
    } finally {
      setCheckinSaving(false)
    }
  }

  const reportToDad = async () => {
    if (!currentCheckin) return
    setReporting(true)
    setReportError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error(t("partnerSavings.reportError"))
      const res = await fetch("/api/partner/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkinId: currentCheckin.id }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || t("partnerSavings.reportError"))
      markReported(currentCheckin.id)
    } catch (err) {
      setReportError(err instanceof Error ? err.message : t("partnerSavings.reportError"))
    } finally {
      setReporting(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        {t("common.loadingData")}
      </div>
    )
  }

  // Sin objetivo todavía, o editándolo a propósito.
  if (!goal || editingGoal) {
    return (
      <div className="space-y-5">
        <p className="text-xs leading-snug text-muted-foreground">{t("partnerSavings.appSummary")}</p>
        <Card className="p-4">
          <p className="mb-3 text-sm font-medium">{t("partnerSavings.setGoalTitle")}</p>
          <div className="space-y-3">
            <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-1">
              {SAVINGS_FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setGoalFrequency(f)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                    goalFrequency === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {f === "weekly" ? t("common.weekly") : t("common.monthly")}
                </button>
              ))}
            </div>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={t("partnerSavings.goalAmountPlaceholder")}
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveGoal()}
            />
            {goalError && <p className="text-xs text-red-500">{goalError}</p>}
            <div className="flex gap-2">
              <Button onClick={saveGoal} disabled={goalSaving} className="flex-1">
                {goalSaving ? t("common.saving") : t("common.save")}
              </Button>
              {goal && (
                <Button variant="outline" onClick={() => setEditingGoal(false)}>
                  {t("common.cancel")}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const progressPct = currentCheckin ? Math.min(100, (currentCheckin.savedAmount / goal.targetAmount) * 100) : 0

  return (
    <div className="space-y-5">
      <p className="text-xs leading-snug text-muted-foreground">{t("partnerSavings.appSummary")}</p>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("partnerSavings.goalLabel")}
            </p>
            <p className="text-xl font-bold tabular-nums">{fmt(goal.targetAmount, goal.currency)}</p>
            <p className="text-xs text-muted-foreground">
              {goal.frequency === "weekly" ? t("common.weekly") : t("common.monthly")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={startEditingGoal}>
            {t("common.edit")}
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {periodKey ? periodLabel(periodKey, goal.frequency, lang) : ""}
        </p>

        {!currentCheckin ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("partnerSavings.checkinPrompt")}</p>
            <Input
              type="number"
              inputMode="decimal"
              placeholder={t("partnerSavings.checkinAmountPlaceholder")}
              value={checkinAmount}
              onChange={(e) => setCheckinAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTodayCheckin()}
            />
            {checkinError && <p className="text-xs text-red-500">{checkinError}</p>}
            <Button onClick={saveTodayCheckin} disabled={checkinSaving} className="w-full">
              {checkinSaving ? t("common.saving") : t("partnerSavings.checkinSave")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <p className="text-xl font-bold tabular-nums">{fmt(currentCheckin.savedAmount, goal.currency)}</p>
              <p className="text-xs text-muted-foreground">
                {t("partnerSavings.ofGoal", { amount: fmt(goal.targetAmount, goal.currency) })}
              </p>
            </div>
            <Progress value={progressPct} />

            {currentCheckin.metGoal ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500">
                <CheckCircle2 className="size-4 shrink-0" />
                {t("partnerSavings.goalMet")}
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-500">
                  <AlertTriangle className="size-4 shrink-0" />
                  {t("partnerSavings.goalMissed")}
                </div>
                <p className="text-xs text-muted-foreground">{t("partnerSavings.goalMissedHint")}</p>
                {reportError && <p className="text-xs text-red-500">{reportError}</p>}
                <Button
                  onClick={reportToDad}
                  disabled={reporting || currentCheckin.reported}
                  variant={currentCheckin.reported ? "outline" : "default"}
                  className="w-full"
                >
                  <Send className="size-4" />
                  {currentCheckin.reported
                    ? t("partnerSavings.reported")
                    : reporting
                      ? t("common.saving")
                      : t("partnerSavings.reportButton")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {pastCheckins.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("partnerSavings.history")}
          </p>
          <div className="space-y-2">
            {pastCheckins.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{periodLabel(c.periodKey, goal.frequency, lang)}</span>
                <span className={cn("font-medium tabular-nums", c.metGoal ? "text-emerald-500" : "text-amber-500")}>
                  {fmt(c.savedAmount, goal.currency)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
