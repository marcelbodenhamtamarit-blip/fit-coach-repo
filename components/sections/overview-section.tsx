"use client"

import { useState } from "react"
import { PiggyBank, Footprints, Moon, Navigation, Heart, Flame, Mountain, Zap, ChevronDown } from "lucide-react"
import { StatCard } from "@/components/stat-card"
import { Card } from "@/components/ui/card"
import { useStore } from "@/lib/store"
import useSWR from "swr"

const fetcher = (u: string) => fetch(u).then((r) => r.json())

export function OverviewSection({
  onNavigate,
}: {
  onNavigate: (tab: string) => void
}) {
  const { data } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
        <button onClick={() => onNavigate("diario")} className="text-left">
          <StatCard
            icon={Navigation}
            label="Actividades"
            value={hasFitness ? String(activities.length) : "--"}
            sub={lastActivity ? lastActivity.dateDisplay : "Últimos 14 días"}
            accent="amber"
          />
        </button>
      </div>

      {hasFitness && activities.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Actividades recientes</p>
          {activities.map((a) => {
            const isExpanded = expandedId === a.id
            return (
              <div key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full p-3 text-left transition-colors hover:bg-muted/50 sm:p-4"
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
                  <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
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
          })}
        </div>
      )}
    </div>
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
