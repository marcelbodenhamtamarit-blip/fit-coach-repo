"use client"

import {
  Flame,
  Moon,
  Scale,
  Dumbbell,
  TrendingDown,
  ChevronRight,
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

export function OverviewSection({
  onNavigate,
}: {
  onNavigate: (tab: string) => void
}) {
  const { data } = useStore()
  const today = todayISO()

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Flame}
          label="Calories today"
          value={caloriesToday.toLocaleString()}
          unit={`/ ${data.profile.calorieGoal.toLocaleString()}`}
          sub={`${proteinToday}g protein`}
          accent="amber"
        />
        <StatCard
          icon={Moon}
          label="Last sleep"
          value={lastSleep ? lastSleep.hours.toFixed(1) : "--"}
          unit="hrs"
          sub={lastSleep ? `Quality ${lastSleep.quality}/5` : "No data"}
          accent="blue"
        />
        <StatCard
          icon={Scale}
          label="Weight"
          value={latestWeight.toFixed(1)}
          unit="kg"
          sub={`${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(1)} kg trend`}
          accent="teal"
        />
        <StatCard
          icon={Dumbbell}
          label="Workouts"
          value={String(data.workouts.length)}
          unit="logged"
          sub={`${data.routines.length} routines`}
          accent="primary"
        />
      </div>

      {/* Calorie goal ring/bar */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Today&apos;s nutrition goal</h2>
            <p className="text-xs text-muted-foreground">
              {data.profile.calorieGoal - caloriesToday > 0
                ? `${(data.profile.calorieGoal - caloriesToday).toLocaleString()} kcal remaining`
                : "Goal reached"}
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
              Weight trend
            </h2>
            <button
              onClick={() => onNavigate("metrics")}
              className="flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              View <ChevronRight className="size-3.5" />
            </button>
          </div>
          <ChartFrame data={weightChart} dataKey="weight" color="var(--chart-5)" unit="kg" />
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Moon className="size-4 text-[var(--chart-2)]" />
              Sleep (7 days)
            </h2>
            <button
              onClick={() => onNavigate("sleep")}
              className="flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              View <ChevronRight className="size-3.5" />
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
