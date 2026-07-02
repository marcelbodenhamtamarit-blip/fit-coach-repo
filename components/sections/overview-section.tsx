"use client"

import { useMemo } from "react"
import { PiggyBank, Footprints, Moon, Route, TrendingUp } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { StatCard } from "@/components/stat-card"
import { Card } from "@/components/ui/card"
import { useStore } from "@/lib/store"
import useSWR from "swr"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

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

  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toISOString().slice(0, 10)
  })()
  const weekTx = transactions.filter((t) => t.date >= weekStart)
  const weekIncome = weekTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const weekExpenses = weekTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const weekSavings = weekIncome - weekExpenses

  const weeklyTrend = useMemo(() => {
    const groups = new Map<number, { income: number; expenses: number }>()
    transactions.forEach((t) => {
      const w = getWeekNumberFromISO(t.date)
      if (!groups.has(w)) groups.set(w, { income: 0, expenses: 0 })
      const g = groups.get(w)!
      if (t.amount > 0) g.income += t.amount
      else g.expenses += Math.abs(t.amount)
    })
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([w, g]) => ({ label: `W${w}`, savings: g.income - g.expenses }))
  }, [transactions])

  const fitnessSWR = useSWR("/api/intervals", fetcher, { revalidateOnFocus: false })
  const wellness = fitnessSWR.data && fitnessSWR.data.wellness ? fitnessSWR.data.wellness : {}
  const hasFitness = !!(fitnessSWR.data && !fitnessSWR.data.error && fitnessSWR.data.wellness)
  const kmRun = fitnessSWR.data?.kmRun ?? 0
  const kmWalked = fitnessSWR.data?.kmWalked ?? 0
  const kmTotal = kmRun + kmWalked

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard
            icon={PiggyBank}
            label="Ahorro semanal"
            value={`${weekSavings >= 0 ? "+" : "-"}$${Math.abs(weekSavings).toFixed(2)}`}
            unit="AUD"
            sub={weekSavings >= 0 ? "Esta semana" : "Déficit"}
            accent={weekSavings >= 0 ? "green" : "red"}
          />
        </button>
        <StatCard
          icon={Footprints}
          label="Pasos"
          value={hasFitness ? (wellness.stepsDisplay ?? "--") : "--"}
          sub={hasFitness ? "Hoy" : "Conecta Garmin"}
          accent="teal"
        />
        <StatCard
          icon={Moon}
          label="Sueño"
          value={hasFitness ? (wellness.sleepDisplay ?? "--") : "--"}
          sub={hasFitness && wellness.sleepScore ? `Calidad ${wellness.sleepScore}` : "Anoche"}
          accent="primary"
        />
        <button onClick={() => onNavigate("diario")} className="text-left">
          <StatCard
            icon={Route}
            label="Km corridos/caminados"
            value={hasFitness ? `${kmTotal.toFixed(1)} km` : "--"}
            sub={hasFitness ? `${kmRun.toFixed(1)} corridos · ${kmWalked.toFixed(1)} caminados` : "Últimos 14 días"}
            accent="amber"
          />
        </button>
      </div>

      {weeklyTrend.length > 1 && (
        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Tendencia de ahorro semanal</p>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1d", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#888" }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Ahorro"]}
                />
                <Area
                  type="monotone"
                  dataKey="savings"
                  stroke="#7c6fff"
                  strokeWidth={2}
                  fill="#7c6fff"
                  fillOpacity={0.2}
                  dot={{ fill: "#7c6fff", strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: "#7c6fff", strokeWidth: 0, r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">Resumen de la semana</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniStat label="Ahorro" value={`${weekSavings >= 0 ? "+" : "-"}$${Math.abs(weekSavings).toFixed(2)}`} tone={weekSavings >= 0 ? "green" : "red"} />
          <MiniStat label="Gastos" value={`-$${weekExpenses.toFixed(2)}`} tone="red" />
          <MiniStat label="Ingresos" value={`+$${weekIncome.toFixed(2)}`} tone="green" />
          <MiniStat label="Pasos hoy" value={hasFitness ? (wellness.stepsDisplay ?? "--") : "--"} tone="neutral" />
          <MiniStat label="Sueño anoche" value={hasFitness ? (wellness.sleepDisplay ?? "--") : "--"} tone="neutral" />
          <MiniStat label="Km totales" value={hasFitness ? `${kmTotal.toFixed(1)} km` : "--"} tone="neutral" />
        </div>
      </Card>
    </div>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: "green" | "red" | "neutral"
}) {
  const color = tone === "green" ? "text-emerald-500" : tone === "red" ? "text-red-400" : "text-foreground"
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  )
}
