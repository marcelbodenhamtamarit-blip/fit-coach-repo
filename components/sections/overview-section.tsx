"use client"

import { PiggyBank, Footprints, Moon, Navigation } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import useSWR from "swr"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

export function OverviewSection({
  onNavigate,
}: {
  onNavigate: (tab: string) => void
}) {
  const { data } = useStore()

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

  const fitnessSWR = useSWR("/api/intervals", fetcher, { revalidateOnFocus: false })
  const wellness = fitnessSWR.data && fitnessSWR.data.wellness ? fitnessSWR.data.wellness : {}
  const activities: any[] = fitnessSWR.data?.activities || []
  const hasFitness = !!(fitnessSWR.data && !fitnessSWR.data.error && fitnessSWR.data.wellness)

  const lastActivity = activities[0]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={PiggyBank}
          label="Ahorro semanal"
          value={`${weekSavings >= 0 ? "+" : "-"}$${Math.abs(weekSavings).toFixed(2)}`}
          unit="AUD"
          sub={weekSavings >= 0 ? "Esta semana" : "Déficit"}
          accent={weekSavings >= 0 ? "green" : "red"}
        />
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
        <StatCard
          icon={Navigation}
          label="Actividades"
          value={hasFitness ? String(activities.length) : "--"}
          sub={lastActivity ? lastActivity.dateDisplay : "Últimos 14 días"}
          accent="amber"
        />
      </div>
    </div>
  )
}
