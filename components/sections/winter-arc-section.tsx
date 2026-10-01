"use client"

// Winter Arc: el plan personal de fin de año dentro de ZentOS. Marcar el
// día tiene que costar menos de 30 segundos desde el móvil: 9 casillas,
// botón de "día mínimo", la sesión que toca según el orden fijo, lectura y
// la revisión del domingo con una gráfica de progreso. Privado: los datos
// están protegidos por RLS (solo tu usuario) y la app ya está cerrada a tu
// cuenta (NEXT_PUBLIC_OWNER_EMAIL). Lógica pura en lib/winter-arc.ts,
// estado en lib/winter-arc-store.tsx.

import { useEffect, useMemo, useState, type ComponentProps } from "react"
import {
  BellRing,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Lock,
  ShieldAlert,
  TrendingUp,
} from "lucide-react"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { todayISO } from "@/lib/types"
import { useWinterArc } from "@/lib/winter-arc-store"
import { useAutomations } from "@/lib/automations-store"
import { CoachCard } from "@/components/coach-card"
import {
  DAY_TARGET,
  MINIMUM_DAY_RULES,
  SESSION_DETAIL,
  SESSION_LABEL,
  SESSION_ORDER,
  WINTER_ARC_RULES,
  PUSH_REMINDER_PREFIX,
  WINTER_ARC_PUSH_REMINDERS,
  addDaysISO,
  currentStreak,
  doneMessageFor,
  inAppReminders,
  motivationFor,
  daysBetween,
  isDayDone,
  longRunTarget,
  missedYesterday,
  mondayOf,
  nextSession,
  type WinterArcDay,
  type WinterArcRuleId,
  type WinterArcSession,
} from "@/lib/winter-arc"

const ALL_SESSIONS: WinterArcSession[] = [...SESSION_ORDER, "descanso"]

function shortDate(dateISO: string): string {
  return `${Number(dateISO.slice(8, 10))}/${Number(dateISO.slice(5, 7))}`
}

function toNumberOrNull(v: string): number | null {
  const n = Number(v.replace(",", "."))
  return v.trim() === "" || Number.isNaN(n) ? null : n
}

export function WinterArcSection() {
  const { t } = useStore()
  const { ready, available, days, weeks, settings, saveDay, saveWeek, saveSettings } = useWinterArc()
  const today = todayISO()
  const [selected, setSelected] = useState(today)

  const byDate = useMemo(() => {
    const map = new Map<string, WinterArcDay>()
    for (const d of days) map.set(d.date, d)
    return map
  }, [days])

  if (!ready) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("common.loadingData")}</p>
  }

  if (!available) {
    return (
      <Card className="max-w-2xl p-4 text-sm">
        <p className="flex items-start gap-2 text-amber-500">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          {t("wa.notReady")}
        </p>
      </Card>
    )
  }

  const totalDays = daysBetween(settings.startDate, settings.endDate) + 1
  const dayNumber = daysBetween(settings.startDate, today) + 1
  const firstTracked = days[0]?.date ?? today
  const streak = currentStreak(byDate, today)
  const doneCount = days.filter(isDayDone).length
  const daysLeft = Math.max(0, daysBetween(today, settings.endDate))
  const phaseLabel =
    dayNumber < 1
      ? t("wa.phaseBefore", { n: 1 - dayNumber })
      : dayNumber > totalDays
        ? t("wa.ended")
        : t("wa.dayOf", { n: dayNumber, total: totalDays })

  const day = byDate.get(selected)
  const checks = day?.checks ?? []
  const minimumDay = day?.minimumDay ?? false
  const done = isDayDone(day)

  const toggleRule = (id: WinterArcRuleId) => {
    const next = checks.includes(id) ? checks.filter((c) => c !== id) : [...checks, id]
    saveDay(selected, { checks: next })
  }

  const upNext = nextSession(days, selected)
  const target = longRunTarget(settings, selected)
  const totalPages = days.reduce((sum, d) => sum + (d.pages ?? 0), 0)
  const last14 = Array.from({ length: 14 }, (_, i) => addDaysISO(today, i - 13))
  const arcPct = dayNumber < 1 ? 0 : Math.min(100, (dayNumber / totalDays) * 100)
  const reminders = inAppReminders({
    day: byDate.get(today),
    hour: new Date().getHours(),
    isSunday: new Date().getDay() === 0,
    weekReviewed: weeks.some((w) => w.weekStart === mondayOf(today) && (w.weight !== null || w.longRunMinutes !== null)),
    sessionUp: t(SESSION_LABEL[nextSession(days, today)]),
  })

  return (
    <div className="max-w-2xl space-y-3">
      {/* Cabecera motivacional: fase, frase del día, avance del arco y racha */}
      <Card className="overflow-hidden border-orange-500/30 bg-black/35 p-0 backdrop-blur-md">
        <div className="bg-gradient-to-br from-orange-500/25 via-red-600/10 to-transparent p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-orange-400">Winter Arc</span>
            <span className="flex items-center gap-1 text-[11px] text-white/60">
              <Lock className="size-3" />
              {t("wa.private").split(":")[0]}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 text-white shadow-lg shadow-orange-600/40">
              <Flame className="size-7" />
            </div>
            <div>
              <p className="text-2xl font-extrabold leading-tight text-white">{phaseLabel}</p>
              <p className="text-xs text-white/60">
                {shortDate(settings.startDate)} – {shortDate(settings.endDate)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-balance text-lg font-semibold leading-snug text-white">
            «{motivationFor(today)}»
          </p>
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-700"
                style={{ width: `${arcPct}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-white/60">{Math.round(arcPct)}% del arco</p>
          </div>
        </div>
        <div className="p-4 pt-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={t("wa.streak")} value={`${streak}`} accent />
            <Stat label={t("wa.doneDays")} value={`${doneCount}`} />
            <Stat label={t("wa.daysLeft")} value={`${daysLeft}`} />
          </div>
          <div className="mt-3 flex justify-between gap-1">
            {last14.map((d) => {
              const status = isDayDone(byDate.get(d)) ? "done" : d < today && d >= firstTracked ? "miss" : "empty"
              return (
                <button
                  key={d}
                  onClick={() => setSelected(d)}
                  title={shortDate(d)}
                  className={cn(
                    "h-2.5 flex-1 rounded-full transition-all",
                    status === "done" && "bg-orange-500",
                    status === "miss" && "bg-red-900/70",
                    status === "empty" && "bg-white/10",
                    d === selected && "ring-2 ring-orange-300 ring-offset-1 ring-offset-black",
                  )}
                />
              )
            })}
          </div>
          <p className="mt-1 text-right text-[10px] text-muted-foreground">{t("wa.last14")}</p>
        </div>
      </Card>

      <CoachCard />

      {selected === today && missedYesterday(byDate, today, firstTracked) && !done && (
        <Card className="border-amber-500/40 bg-amber-500/10 p-3 text-sm font-medium text-amber-500">
          {t("wa.noFailToday")}
        </Card>
      )}

      {selected === today && reminders.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/10 p-4">
          <div className="flex items-center gap-2">
            <BellRing className="size-4 text-orange-400" />
            <p className="text-sm font-semibold">Ahora toca</p>
          </div>
          <ul className="mt-2 space-y-1.5">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-orange-400" />
                {r.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Checklist del día */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <Button size="icon-sm" variant="outline" onClick={() => setSelected((d) => addDaysISO(d, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-semibold">{selected === today ? t("wa.today") : shortDate(selected)}</p>
            <p className="text-xs text-muted-foreground">
              {minimumDay ? t("wa.minimumTarget") : `${checks.length}/9 · ${t("wa.dayTarget")}`}
            </p>
          </div>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={selected >= today}
            onClick={() => setSelected((d) => addDaysISO(d, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              done ? "bg-emerald-500" : "bg-gradient-to-r from-orange-400 to-red-500",
            )}
            style={{ width: `${Math.min(100, (checks.length / DAY_TARGET) * 100)}%` }}
          />
        </div>

        <div className="mt-3 space-y-1.5">
          {WINTER_ARC_RULES.map((rule) => {
            const on = checks.includes(rule.id)
            const dimmed = minimumDay && !MINIMUM_DAY_RULES.includes(rule.id)
            return (
              <button
                key={rule.id}
                onClick={() => toggleRule(rule.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-all active:scale-[0.99]",
                  on ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/20",
                  dimmed && !on && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border",
                    on ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40",
                  )}
                >
                  {on && <Check className="size-3.5" />}
                </span>
                {t(rule.label)}
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant={minimumDay ? "default" : "outline"}
            onClick={() => saveDay(selected, { minimumDay: !minimumDay })}
          >
            {t("wa.minimumDay")}
          </Button>
          {done && (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-500">
              {doneMessageFor(selected)}
            </span>
          )}
        </div>
      </Card>

      {/* Entreno */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="size-4 text-primary" />
          <p className="text-sm font-semibold">
            {t("wa.nextSession")}: {t(SESSION_LABEL[upNext])}
          </p>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t(SESSION_DETAIL[upNext])}</p>
        {target !== null && (
          <p className="mt-1.5 text-xs font-medium">{t("wa.longRunTarget", { n: target })}</p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">{t("wa.sessionToday")}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ALL_SESSIONS.map((s) => (
            <button
              key={s}
              onClick={() => saveDay(selected, { session: day?.session === s ? null : s })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-all",
                day?.session === s
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {t(SESSION_LABEL[s])}
            </button>
          ))}
        </div>
        {day?.session && day.session !== "descanso" && (
          <div className="mt-3 grid grid-cols-[90px_1fr] gap-2">
            <DraftInput
              key={`min-${selected}`}
              placeholder={t("wa.minutes")}
              inputMode="numeric"
              value={day.sessionMinutes?.toString() ?? ""}
              onCommit={(v) => saveDay(selected, { sessionMinutes: toNumberOrNull(v) })}
            />
            <DraftInput
              key={`notes-${selected}`}
              placeholder={t("wa.sessionNotes")}
              value={day.sessionNotes ?? ""}
              onCommit={(v) => saveDay(selected, { sessionNotes: v.trim() || null })}
            />
          </div>
        )}
      </Card>

      {/* Lectura */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" />
          <p className="text-sm font-semibold">{t("wa.reading")}</p>
          <span className="ml-auto text-xs text-muted-foreground">{t("wa.pagesTotal", { n: totalPages })}</span>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_110px] gap-2">
          <DraftInput
            placeholder={t("wa.book")}
            value={settings.currentBook ?? ""}
            onCommit={(v) => saveSettings({ currentBook: v.trim() || null })}
          />
          <DraftInput
            key={`pages-${selected}`}
            placeholder={t("wa.pagesToday")}
            inputMode="numeric"
            value={day?.pages?.toString() ?? ""}
            onCommit={(v) => {
              const pages = toNumberOrNull(v)
              const patch: { pages: number | null; checks?: WinterArcRuleId[] } = { pages }
              // 10 páginas o más marca sola la casilla de lectura.
              if (pages !== null && pages >= 10 && !checks.includes("lectura")) patch.checks = [...checks, "lectura"]
              saveDay(selected, patch)
            }}
          />
        </div>
      </Card>

      <WeeklyReview
        weekStart={mondayOf(selected)}
        week={weeks.find((w) => w.weekStart === mondayOf(selected))}
        onSave={saveWeek}
      />

      <ProgressChart />

      <PushRemindersCard />

      {/* Fechas del arco */}
      <Card className="p-4">
        <p className="text-sm font-semibold">{t("wa.dates")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            {t("wa.startDate")}
            <Input
              type="date"
              className="mt-1"
              value={settings.startDate}
              onChange={(e) => e.target.value && saveSettings({ startDate: e.target.value })}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            {t("wa.endDate")}
            <Input
              type="date"
              className="mt-1"
              value={settings.endDate}
              onChange={(e) => e.target.value && saveSettings({ endDate: e.target.value })}
            />
          </label>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="size-3" />
          {t("wa.private")}
        </p>
      </Card>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg p-2.5", accent ? "bg-orange-500/10" : "bg-muted/40")}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", accent && "text-orange-500")}>{value}</p>
    </div>
  )
}

// Input que guarda al salir del campo (o con Intro), no en cada tecla: así
// no se lanza un guardado a Supabase por cada número que escribes.
function DraftInput({
  value,
  onCommit,
  ...props
}: { value: string; onCommit: (v: string) => void } & Omit<ComponentProps<"input">, "value" | "onChange">) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft !== value) onCommit(draft)
  }
  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

function WeeklyReview({
  weekStart,
  week,
  onSave,
}: {
  weekStart: string
  week: { weight: number | null; waist: number | null; longRunMinutes: number | null; note: string | null } | undefined
  onSave: ReturnType<typeof useWinterArc>["saveWeek"]
}) {
  const { t } = useStore()
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t("wa.weekly")}</p>
        <span className="text-xs text-muted-foreground">{t("wa.weekOf", { date: shortDate(weekStart) })}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <label className="text-[11px] text-muted-foreground">
          {t("wa.weight")}
          <DraftInput
            key={`w-${weekStart}`}
            className="mt-1"
            inputMode="decimal"
            value={week?.weight?.toString() ?? ""}
            onCommit={(v) => onSave(weekStart, { weight: toNumberOrNull(v) })}
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          {t("wa.waist")}
          <DraftInput
            key={`c-${weekStart}`}
            className="mt-1"
            inputMode="decimal"
            value={week?.waist?.toString() ?? ""}
            onCommit={(v) => onSave(weekStart, { waist: toNumberOrNull(v) })}
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          {t("wa.longRun")}
          <DraftInput
            key={`l-${weekStart}`}
            className="mt-1"
            inputMode="numeric"
            value={week?.longRunMinutes?.toString() ?? ""}
            onCommit={(v) => onSave(weekStart, { longRunMinutes: toNumberOrNull(v) })}
          />
        </label>
      </div>
      <DraftInput
        key={`n-${weekStart}`}
        className="mt-2"
        placeholder={t("wa.weekNote")}
        value={week?.note ?? ""}
        onCommit={(v) => onSave(weekStart, { note: v.trim() || null })}
      />
    </Card>
  )
}

function ProgressChart() {
  const { t } = useStore()
  const { weeks } = useWinterArc()
  const rows = weeks
    .filter((w) => w.weight !== null || w.longRunMinutes !== null)
    .map((w) => ({ week: shortDate(w.weekStart), peso: w.weight, tirada: w.longRunMinutes }))

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-4 text-primary" />
        <p className="text-sm font-semibold">{t("wa.progress")}</p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("wa.progressEmpty")}</p>
      ) : (
        <div className="mt-3 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
              <YAxis yAxisId="min" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} />
              <YAxis yAxisId="kg" orientation="right" tick={{ fontSize: 10 }} stroke="currentColor" opacity={0.5} domain={["dataMin - 2", "dataMax + 2"]} />
              <Tooltip contentStyle={{ background: "#16161a", border: "1px solid #2a2a30", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="min" type="monotone" dataKey="tirada" name={t("wa.longRun")} stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="kg" type="monotone" dataKey="peso" name={t("wa.weight")} stroke="#95e85f" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}

// Notificaciones al móvil: crea (o pausa/reactiva) 5 recordatorios en el
// sistema de Recordatorios de Ajustes, marcados con PUSH_REMINDER_PREFIX.
function PushRemindersCard() {
  const { automations, ready, addAutomation, toggleAutomation } = useAutomations()
  const [busy, setBusy] = useState(false)
  const mine = automations.filter((a) => a.name.startsWith(PUSH_REMINDER_PREFIX))
  const allOn = mine.length > 0 && mine.every((a) => a.active)

  const create = async () => {
    setBusy(true)
    for (const r of WINTER_ARC_PUSH_REMINDERS) {
      if (mine.some((a) => a.name === PUSH_REMINDER_PREFIX + r.name)) continue
      await addAutomation({
        name: PUSH_REMINDER_PREFIX + r.name,
        active: true,
        triggerType: "schedule",
        scheduleFrequency: r.frequency,
        scheduleTime: r.time,
        scheduleWeekday: r.weekday,
        conditionMetric: null,
        conditionOperator: null,
        conditionValue: null,
        conditionCategory: null,
        conditionCooldownHours: 24,
        actionType: "both",
        messageTitle: r.title,
        messageBody: r.body,
      })
    }
    setBusy(false)
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-orange-400" />
        <p className="text-sm font-semibold">Recordatorios en el móvil</p>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {WINTER_ARC_PUSH_REMINDERS.map((r) => (
          <li key={r.name} className="flex gap-2">
            <span className="w-14 shrink-0 font-medium tabular-nums text-foreground">
              {r.frequency === "weekly" ? `Dom ${r.time}` : r.time}
            </span>
            {r.body}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        {!ready ? null : mine.length < WINTER_ARC_PUSH_REMINDERS.length ? (
          <Button size="sm" disabled={busy} onClick={create} className="bg-orange-500 text-white hover:bg-orange-600">
            {busy ? "Activando..." : "Activar recordatorios"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant={allOn ? "outline" : "default"}
            onClick={() => mine.forEach((a) => toggleAutomation(a.id, !allOn))}
          >
            {allOn ? "Pausar recordatorios" : "Reactivar recordatorios"}
          </Button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Llegan como notificación si las tienes activadas en Ajustes → Recordatorios.
      </p>
    </Card>
  )
}
