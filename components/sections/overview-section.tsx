"use client"

import { Flame, Dumbbell, Scale, PiggyBank } from "lucide-react"
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

  // Meals today
  const todaysMeals = data.meals.filter((m) => m.date === today)
  const caloriesToday = todaysMeals.reduce((s, m) => s + m.totalCalories, 0)
  const proteinToday = todaysMeals.reduce((s, m) => s + m.totalProtein, 0)

  // Weight
  const sortedMetrics = [...data.metrics].sort((a, b) =>
    a.date.localeCompare(b.date),
  )
  const latestWeight = sortedMetrics[sortedMetrics.length - 1]?.weight ?? 0
  const firstWeight = sortedMetrics[0]?.weight ?? latestWeight
  const weightDelta = latestWeight - firstWeight

  // Percentages
  const calPct = Math.min(
    100,
    Math.round((caloriesToday / data.profile.calorieGoal) * 100),
  )
  const proteinPct = Math.min(
    100,
    Math.round((proteinToday / data.profile.proteinGoal) * 100),
  )

  // Weekly savings
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

  // Weekly supermarket spending
  const weekSupermarket = weekTx
    .filter((t) => t.category === "Supermercado" && t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="space-y-5">
      {/* Top 4 stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Flame}
          label="Calorías de hoy"
          value={caloriesToday.toLocaleString()}
          unit={`/ ${data.profile.calorieGoal.toLocaleString()}`}
          sub={`Objetivo: ${data.profile.calorieGoal.toLocaleString()}`}
          accent="amber"
        />
        <StatCard
          icon={Dumbbell}
          label="Proteína de hoy"
          value={`${proteinToday.toFixed(0)}g`}
          unit={`/ ${data.profile.proteinGoal}g`}
          sub={`Objetivo: ${data.profile.proteinGoal}g`}
          accent="primary"
        />
        <StatCard
          icon={PiggyBank}
          label="Ahorro semanal"
          value={`$${Math.abs(weekSavings).toFixed(2)}`}
          unit="AUD"
          sub={weekSavings >= 0 ? "Esta semana" : "Déficit"}
          accent={weekSavings >= 0 ? "green" : "red"}
        />
        <StatCard
          icon={PiggyBank}
          label="Supermercado esta semana"
          value={`$${weekSupermarket.toFixed(2)}`}
          unit="AUD"
          sub="Gasto semanal"
          accent="blue"
        />
      </div>

      {/* Progress bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Progreso calórico</h2>
            <span className="text-lg font-bold tabular-nums">{calPct}%</span>
          </div>
          <Progress value={calPct} className="h-2.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            {data.profile.calorieGoal - caloriesToday > 0
              ? `${(data.profile.calorieGoal - caloriesToday).toLocaleString()} kcal restantes`
              : "Objetivo alcanzado"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Progreso de proteína</h2>
            <span className="text-lg font-bold tabular-nums">{proteinPct}%</span>
          </div>
          <Progress value={proteinPct} className="h-2.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            {data.profile.proteinGoal - proteinToday > 0
              ? `${(data.profile.proteinGoal - proteinToday).toFixed(0)}g restantes`
              : "Objetivo alcanzado"}
          </p>
        </Card>
      </div>
    </div>
  )
}
