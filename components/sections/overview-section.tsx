"use client"

import { useMemo, useState } from "react"
import { Footprints, Moon, TrendingDown, TrendingUp, Zap, Heart } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import useSWR from "swr"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

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

export function OverviewSection({
  onNavigate,
}: {
  onNavigate: (tab: string) => void
}) {
  const { data } = useStore()
  const transactions = data.transactions ?? []
  const [period, setPeriod] = useState<Period>("diario")

  const today = todayISO()
  const currentWeek = getWeekNumberFromISO(today)
  const currentMonth = today.slice(0, 7)

  const inPeriod = (dateStr: string) => {
    if (period === "diario") return dateStr === today
    if (period === "semanal") return getWeekNumberFromISO(dateStr) === currentWeek
    return dateStr.startsWith(currentMonth)
  }

  const periodTx = useMemo(() => transactions.filter((t) => inPeriod(t.date)), [transactions, period, today])
  const spent = periodTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const income = periodTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)

  const fitnessSWR = useSWR("/api/intervals", fetcher, { revalidateOnFocus: false })
  const fdata = fitnessSWR.data
  const hasFitness = !!(fdata && !fdata.error && fdata.wellness)
  const wellness = hasFitness ? fdata.wellness : {}
  const dailySteps: any[] = fdata?.dailySteps || []
  const dailySleep: any[] = fdata?.dailySleep || []
  const dailyRestingHR: any[] = fdata?.dailyRestingHR || []
  const activities: any[] = fdata?.activities || []

  const periodSteps = useMemo(() => dailySteps.filter((d) => inPeriod(d.date)), [dailySteps, period, today])
  const periodSleep = useMemo(() => dailySleep.filter((d) => inPeriod(d.date)), [dailySleep, period, today])
  const periodHR = useMemo(() => dailyRestingHR.filter((d) => inPeriod(d.date)), [dailyRestingHR, period, today])
  const periodActivities = useMemo(() => activities.filter((a) => inPeriod(a.date)), [activities, period, today])

  // --- Steps ---
  const stepsValue =
    period === "diario"
      ? wellness.stepsDisplay ?? "--"
      : periodSteps.length > 0
        ? periodSteps.reduce((s, d) => s + (Number(d.steps) || 0), 0).toLocaleString("es-ES")
        : "--"
  const stepsSub =
    period === "diario"
      ? "Hoy"
      : periodSteps.length > 0
        ? `Media: ${Math.round(periodSteps.reduce((s, d) => s + (Number(d.steps) || 0), 0) / periodSteps.length).toLocaleString("es-ES")}/día`
        : "Sin datos"

  // --- Sleep ---
  const sleepHoursSum = periodSleep.reduce((s, d) => s + (d.hours || 0), 0)
  const sleepValue =
    period === "diario"
      ? wellness.sleepDisplay ?? "--"
      : periodSleep.length > 0
        ? `${sleepHoursSum.toFixed(1)}h`
        : "--"
  const sleepSub =
    period === "diario"
      ? wellness.sleepScore
        ? `Anoche · Calidad ${wellness.sleepScore}`
        : "Anoche"
      : periodSleep.length > 0
        ? `Media: ${(sleepHoursSum / periodSleep.length).toFixed(1)}h/noche`
        : "Sin datos"

  // --- Resting HR ---
  const hrValue =
    period === "diario"
      ? wellness.restingHR
        ? `${Math.round(wellness.restingHR)} lpm`
        : "--"
      : periodHR.length > 0
        ? `${Math.round(periodHR.reduce((s, d) => s + d.restingHR, 0) / periodHR.length)} lpm`
        : "--"
  const hrSub = period === "diario" ? "Esta mañana" : `Media ${period}`

  // --- Sport ---
  const sportKm = periodActivities.reduce((s, a) => s + (Number(a.distanceKm) || 0), 0)
  const sportValue =
    period === "diario"
      ? periodActivities[0]
        ? periodActivities[0].distanceDisplay ?? periodActivities[0].name
        : "Sin actividad"
      : periodActivities.length > 0
        ? `${periodActivities.length} ${periodActivities.length === 1 ? "sesión" : "sesiones"}`
        : "Sin actividad"
  const sportSub =
    period === "diario"
      ? periodActivities[0]
        ? periodActivities[0].durationDisplay ?? periodActivities[0].name
        : "Descanso"
      : periodActivities.length > 0
        ? `${sportKm.toFixed(1)} km totales`
        : "Descanso"

  const periodLabel =
    period === "diario"
      ? new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
      : period === "semanal"
        ? `Semana ${currentWeek}`
        : new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })

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

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Footprints} label="Pasos" value={hasFitness ? stepsValue : "--"} sub={hasFitness ? stepsSub : "Conecta Garmin"} accent="teal" />

        <StatCard icon={Moon} label="Sueño" value={hasFitness ? sleepValue : "--"} sub={hasFitness ? sleepSub : "Conecta Garmin"} accent="primary" />

        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard icon={TrendingDown} label="Gastado" value={`-$${spent.toFixed(2)}`} sub={`${periodTx.filter((t) => t.amount < 0).length} movimientos`} accent="red" />
        </button>

        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard icon={TrendingUp} label="Ingresado" value={`+$${income.toFixed(2)}`} sub={income > 0 ? "Registrado" : "Sin ingresos"} accent="green" />
        </button>
      </div>
    </div>
  )
}
