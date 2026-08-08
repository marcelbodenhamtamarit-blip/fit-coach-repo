"use client"

import { Footprints, Moon, TrendingDown, TrendingUp, Zap } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { useStore } from "@/lib/store"
import useSWR from "swr"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function OverviewSection({
  onNavigate,
}: {
  onNavigate: (tab: string) => void
}) {
  const { data } = useStore()
  const transactions = data.transactions ?? []
  const today = todayISO()

  const todayTx = transactions.filter((t) => t.date === today)
  const spentToday = todayTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const incomeToday = todayTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)

  const fitnessSWR = useSWR("/api/intervals", fetcher, { revalidateOnFocus: false })
  const wellness = fitnessSWR.data && fitnessSWR.data.wellness ? fitnessSWR.data.wellness : {}
  const hasFitness = !!(fitnessSWR.data && !fitnessSWR.data.error && fitnessSWR.data.wellness)
  const activities: any[] = fitnessSWR.data?.activities || []
  const todayActivity = activities.find((a) => a.date === today)

  return (
    <div className="space-y-5">
      <p className="text-xs font-medium text-muted-foreground">
        Hoy · {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate("diario")} className="text-left">
          <StatCard
            icon={Footprints}
            label="Pasos"
            value={hasFitness ? (wellness.stepsDisplay ?? "--") : "--"}
            sub={hasFitness ? "Hoy" : "Conecta Garmin"}
            accent="teal"
          />
        </button>

        <button onClick={() => onNavigate("diario")} className="text-left">
          <StatCard
            icon={Moon}
            label="Sueño"
            value={hasFitness ? (wellness.sleepDisplay ?? "--") : "--"}
            sub={hasFitness && wellness.sleepScore ? `Calidad ${wellness.sleepScore}` : "Anoche"}
            accent="primary"
          />
        </button>

        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard
            icon={TrendingDown}
            label="Gastado hoy"
            value={`-$${spentToday.toFixed(2)}`}
            sub={`${todayTx.filter((t) => t.amount < 0).length} movimientos`}
            accent="red"
          />
        </button>

        <button onClick={() => onNavigate("economy")} className="text-left">
          <StatCard
            icon={TrendingUp}
            label="Ingresado hoy"
            value={`+$${incomeToday.toFixed(2)}`}
            sub={incomeToday > 0 ? "Registrado" : "Sin ingresos"}
            accent="green"
          />
        </button>

        <button onClick={() => onNavigate("diario")} className="text-left">
          <StatCard
            icon={Zap}
            label="Deporte de hoy"
            value={todayActivity ? (todayActivity.distanceDisplay ?? todayActivity.name) : "Sin actividad"}
            sub={todayActivity ? (todayActivity.durationDisplay ?? todayActivity.name) : "Descanso"}
            accent="amber"
          />
        </button>
      </div>
    </div>
  )
}

