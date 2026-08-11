"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Flame,
  Mountain,
  Zap,
  Navigation,
  Activity,
  Route,
  Footprints,
  Moon,
} from "lucide-react"
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from "recharts"
import { Card } from "@/components/ui/card"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type Period = "diario" | "semanal" | "mensual"

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
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

export function DiarioSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showActivities, setShowActivities] = useState(false)
  const [period, setPeriod] = useState<Period>("diario")
  const { data, isLoading } = useSWR("/api/intervals", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const wellness = data && data.wellness ? data.wellness : {}
  const activities: any[] = data?.activities || []
  const dailySleep: any[] = data?.dailySleep || []
  const dailySteps: any[] = data?.dailySteps || []
  const dailyRestingHR: any[] = data?.dailyRestingHR || []
  const hasFitness = !!(data && !data.error && data.wellness)

  const today = todayISO()
  const currentWeek = getWeekNumberFromISO(today)
  const currentMonth = today.slice(0, 7)

  const inPeriod = (dateStr: string) => {
    if (period === "diario") return dateStr === today
    if (period === "semanal") return getWeekNumberFromISO(dateStr) === currentWeek
    return dateStr.startsWith(currentMonth)
  }

  const periodSteps = useMemo(() => dailySteps.filter((d) => inPeriod(d.date)), [dailySteps, period, today])
  const periodSleep = useMemo(() => dailySleep.filter((d) => inPeriod(d.date)), [dailySleep, period, today])
  const periodHR = useMemo(() => dailyRestingHR.filter((d) => inPeriod(d.date)), [dailyRestingHR, period, today])
  const periodActivities = useMemo(() => activities.filter((a) => inPeriod(a.date)), [activities, period, today])

  // --- Pasos ---
  const stepsSum = periodSteps.reduce((s, d) => s + (Number(d.steps) || 0), 0)
  const stepsValue = period === "diario" ? wellness.stepsDisplay ?? "--" : stepsSum > 0 ? stepsSum.toLocaleString("es-ES") : "--"
  const stepsSub =
    period === "diario" ? "Hoy" : periodSteps.length > 0 ? `Media: ${Math.round(stepsSum / periodSteps.length).toLocaleString("es-ES")}/día` : "Sin datos"

  // --- Km caminados (estimado por pasos) ---
  const kmWalkedSum = periodSteps.reduce((s, d) => s + (d.kmWalked || 0), 0)
  const kmWalkedValue = kmWalkedSum > 0 ? `${kmWalkedSum.toFixed(1)}` : "--"

  // --- Km corridos (actividades reales) ---
  const kmRunSum = periodActivities.filter((a) => a.type === "run").reduce((s, a) => s + (a.distanceKm || 0), 0)
  const kmRunValue = kmRunSum > 0 ? `${kmRunSum.toFixed(1)}` : "--"

  // --- Sueño ---
  const sleepSum = periodSleep.reduce((s, d) => s + (d.hours || 0), 0)
  const sleepValue = period === "diario" ? wellness.sleepDisplay ?? "--" : sleepSum > 0 ? `${sleepSum.toFixed(1)}h` : "--"
  const sleepSub =
    period === "diario"
      ? wellness.sleepScore
        ? `Calidad ${wellness.sleepScore}`
        : "Anoche"
      : periodSleep.length > 0
        ? `Media: ${(sleepSum / periodSleep.length).toFixed(1)}h/noche`
        : "Sin datos"

  // --- FC en reposo ---
  const hrValue =
    period === "diario"
      ? wellness.restingHR
        ? `${Math.round(wellness.restingHR)}`
        : "--"
      : periodHR.length > 0
        ? `${Math.round(periodHR.reduce((s, d) => s + d.restingHR, 0) / periodHR.length)}`
        : "--"

  const periodLabel =
    period === "diario"
      ? new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
      : period === "semanal"
        ? `Semana ${currentWeek}`
        : new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (!hasFitness) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Intervals.icu no conectado. No hay datos de actividad disponibles.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {[
          { id: "diario", label: "Diario" },
          { id: "semanal", label: "Semanal" },
          { id: "mensual", label: "Mensual" },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id as Period)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              period === p.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium capitalize text-muted-foreground">{periodLabel}</p>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actividad</p>
        <div className="grid grid-cols-3 gap-2">
          <MiniCard icon={Footprints} accent="teal" label="Pasos" value={stepsValue} sub={stepsSub} />
          <MiniCard icon={Route} accent="green" label="Km caminados" value={kmWalkedValue} />
          <MiniCard icon={Navigation} accent="amber" label="Km corridos" value={kmRunValue} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Salud</p>
        <div className="grid grid-cols-3 gap-2">
          <MiniCard icon={Moon} accent="primary" label="Sueño" value={sleepValue} sub={sleepSub} />
          <MiniCard icon={Heart} accent="pink" label="FC reposo" value={hrValue} sub="lpm" />
          <MiniCard icon={Activity} accent="blue" label="HRV" value={wellness.hrv != null ? `${wellness.hrv}` : "--"} sub="ms" />
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Forma física</p>
        <div className="grid grid-cols-3 gap-2">
          <MiniCard icon={Zap} accent="purple" label="CTL" value={wellness.ctl != null ? `${wellness.ctl}` : "--"} sub="Fitness" />
          <MiniCard icon={Flame} accent="red" label="ATL" value={wellness.atl != null ? `${wellness.atl}` : "--"} sub="Fatiga" />
          <MiniCard icon={Mountain} accent="green" label="TSB" value={wellness.tsb != null ? `${wellness.tsb}` : "--"} sub="Forma" />
        </div>
      </div>

      {dailySteps.length > 0 && (
        <MiniChart title="Pasos — 7 días" data={dailySteps} dataKey="steps" color="#2dd4bf" formatValue={(v) => `${(v / 1000).toFixed(1)}k`} />
      )}

      {dailySleep.length > 0 && (
        <MiniChart title="Sueño — 7 días" data={dailySleep} dataKey="hours" color="#7c6fff" formatValue={(v) => `${v}h`} />
      )}

      <Card className="overflow-hidden p-0">
        <button
          onClick={() => setShowActivities((v) => !v)}
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <Activity className="size-4 text-amber-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Actividades</p>
            <p className="text-xs text-muted-foreground">
              {periodActivities.length === 0 ? "Sin actividades" : `${periodActivities.length} ${periodActivities.length === 1 ? "actividad" : "actividades"}`}
            </p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${showActivities ? "rotate-180" : ""}`} />
        </button>

        {showActivities && (
          <div className="space-y-2 border-t border-border p-4">
            {periodActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay actividades en este periodo.</p>
            ) : (
              periodActivities.map((a) => {
                const isExpanded = expandedId === a.id
                return (
                  <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : a.id)}
                      className="w-full p-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Navigation className="size-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-2">
                              <p className="truncate text-sm font-medium">{a.name}</p>
                              <span className="text-xs text-muted-foreground">{a.dateDisplay}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>{a.distanceDisplay}</span>
                              <span>{a.durationDisplay}</span>
                              <span>{a.heartRateAvg}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border bg-muted/20 p-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <DetailItem icon={Heart} label="FC máx." value={a.heartRateMax} />
                          <DetailItem icon={Mountain} label="Desnivel" value={a.elevation} />
                          <DetailItem icon={Flame} label="Calorías" value={a.calories} />
                          <DetailItem icon={Zap} label="Carga" value={a.trainingLoad} />
                          <DetailItem icon={Navigation} label="Ritmo medio" value={a.avgPace} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

const ACCENTS: Record<string, { bg: string; text: string }> = {
  teal: { bg: "bg-teal-500/10", text: "text-teal-500" },
  green: { bg: "bg-emerald-500/10", text: "text-emerald-500" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-500" },
  primary: { bg: "bg-primary/10", text: "text-primary" },
  pink: { bg: "bg-rose-500/10", text: "text-rose-500" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-400" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400" },
  red: { bg: "bg-red-500/10", text: "text-red-400" },
}

function MiniCard({
  icon: Icon,
  accent,
  label,
  value,
  sub,
}: {
  icon: typeof Footprints
  accent: string
  label: string
  value: string
  sub?: string
}) {
  const colors = ACCENTS[accent] ?? ACCENTS.primary
  return (
    <Card className="p-2.5">
      <div className={`mb-1.5 flex size-6 items-center justify-center rounded-full ${colors.bg}`}>
        <Icon className={`size-3 ${colors.text}`} />
      </div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold leading-tight">{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </Card>
  )
}

function MiniChart({
  title,
  data,
  dataKey,
  color,
  formatValue,
}: {
  title: string
  data: any[]
  dataKey: string
  color: string
  formatValue: (v: number) => string
}) {
  const avg = data.length > 0 ? data.reduce((s, d) => s + (d[dataKey] || 0), 0) / data.length : 0
  return (
    <Card className="p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold">{title}</p>
        <span className="text-[11px] text-muted-foreground">Media: {formatValue(avg)}</span>
      </div>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="dayLabel" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 9 }} interval={0} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1a1a1d", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }}
              labelStyle={{ color: "#888" }}
              formatter={(value: number) => [formatValue(value), ""]}
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mountain
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold">{value}</p>
      </div>
    </div>
  )
}

