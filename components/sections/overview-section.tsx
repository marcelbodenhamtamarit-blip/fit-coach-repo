"use client"

import {
  Flame,
  Moon,
  Scale,
  Dumbbell,
  TrendingDown,
  ChevronRight,
  Footprints,
  Heart,
  PiggyBank,
} from "lucide-react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import { todayISO } from "@/lib/types"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function OverviewSection({
  onNavigate,
}: {
  onNavigate: (tab: string) => void
}) {
  const { data } = useStore()
  const today = todayISO()
  const { data: fitnessData } = useSWR("/api/intervals", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const wellness = fitnessData?.wellness || {}

  const todaysMeals = data.meals.filter((m) => m.date === today)
  const caloriesToday = todaysMeals.reduce((s, m) => s + m.calories, 0)
  const proteinToday = todaysMeals.reduce((s, m) => s + m.protein, 0)

  const lastSleep = [...data.sleep].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0]

  const sortedMetrics = [...data.metrics].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const latestWeight = sortedMetrics[sortedMetrics.length - 1]?.weight ?? 0
  const firstWeight = sortedMetrics[0]?.weight ?? latestWeight
  const weightDelta = latestWeight - firstWeight

  const calPct = Math.min(
    100,
    Math.round((caloriesToday / data.profile.calorieGoal) * 100),
  )

  const weightChart = sortedMetrics.map((m) => ({
    date: m.date.slice(5),
    weight: m.weight,
  }))

  const sleepChart = [...data.sleep]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)
    .map((s) => ({ date: s.date.slice(5), hours: s.hours }))

  // Ahorro semanal
  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().slice(0, 10)
  })()
  const weekTx = (data.transactions ?? []).filter((t) => t.date >= weekStart)
  const weekIncome = weekTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const weekExpenses = weekTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const weekSavings = weekIncome - weekExpenses

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Flame}
          label="Calorías de hoy"
          value={caloriesToday.toLocaleString()}
          unit={`/ ${data.profile.calorieGoal.toLocaleString()}`}
          sub={`Objetivo: ${data.profile.calorieGoal.toLocaleString()} kcal`}
          accent="amber"
        />
        <StatCard
          icon={Dumbbell}
          label="Proteína de hoy"
          value={`${proteinToday}g`}
          unit={`/ ${data.profile.proteinGoal ?? 170}g`}
          sub={`Objetivo: ${data.profile.proteinGoal ?? 170}g`}
          accent="primary"
        />
        <StatCard
          icon={Scale}
          label="Peso"
          value={latestWeight ? latestWeight.toFixed(1) : "--"}
          unit="kg"
          sub={latestWeight ? `${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)} kg tendencia` : "Sin datos"}
          accent="teal"
        />
        <StatCard
          icon={Footprints}
          label="Pasos hoy"
          value={wellness.steps ? wellness.steps.toLocaleString("es-ES") : "--"}
          unit="pasos"
          sub="Intervals.icu"
          accent="lime"
        />
        <StatCard
          icon={Heart}
          label="FC en reposo"
          value={wellness.restingHR ? String(wellness.restingHR) : "--"}
          unit="bpm"
          sub="Intervals.icu"
          accent="rose"
        />
        <StatCard
          icon={PiggyBank}
          label="Ahorro semanal"
          value={`$${Math.abs(weekSavings).toFixed(2)}`}
          unit="AUD"
          sub={weekSavings >= 0 ? "Esta semana" : "Déficit esta semana"}
          accent={weekSavings >= 0 ? "green" : "red"}
        />
        <StatCard
          icon={Moon}
          label="Sueño anoche"
          value={wellness.sleepDisplay ?? (lastSleep ? lastSleep.hours.toFixed(1) + "h" : "--")}
          unit={wellness.sleepDisplay ? "" : ""}
          sub={wellness.sleepScore ? `Puntuación: ${wellness.sleepScore}/100` : (lastSleep ? `Calidad ${lastSleep.quality}/5` : "Sin datos")}
          accent="blue"
        />
      </div>

      {/* Calorie goal bar */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Objetivo nutricional de hoy</h2>
            <p className="text-xs text-muted-foreground">
              {data.profile.calorieGoal - caloriesToday > 0
                ? `${(data.profile.calorieGoal - caloriesToday).toLocaleString()} kcal restantes`
                : "Objetivo alcanzado"}
            </p>
          </div>
          <span className="text-2xl font-semibold tabular-nums text-primary">
            {calPct}%
          </span>
        </div>
        <Progress value={calPct} className="mt-4 h-2.5" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <TrendingDown className="size-4 text-[var(--chart-5)]" />
              Tendencia de peso
            </h2>
            <button
              onClick={() => onNavigate("metrics")}
              className="flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              Ver <ChevronRight className="size-3.5" />
            </button>
          </div>
          <ChartFrame data={weightChart} dataKey="weight" color="var(--chart-5)" unit="kg" />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Moon className="size-4 text-[var(--chart-2)]" />
              Sueño (7 días)
            </h2>
            <button
              onClick={() => onNavigate("sleep")}
              className="flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              Ver <ChevronRight className="size-3.5" />
            </button>
          </div>
          <ChartFrame data={sleepChart} dataKey="hours" color="var(--chart-2)" unit="h" />
        </Card>
      </div>
    </div>
  )
}

function ChartFrame({
  data,
  dataKey,
  color,
  unit,
}: {
  data: { date: string; [k: string]: number | string }[]
  dataKey: string
  color: string
  unit: string
}) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -22 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["dataMin - 1", "dataMax + 1"]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "12px",
              color: "var(--popover-foreground)",
            }}
            formatter={(v: number) => [`${v} ${unit}`, ""]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${dataKey})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
