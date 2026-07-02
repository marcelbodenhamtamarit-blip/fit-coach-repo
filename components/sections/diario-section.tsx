"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  ChevronDown,
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
import { Card } from "@/components/ui/card"
import { StatCard } from "@/components/stat-card"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function DiarioSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { data, isLoading } = useSWR("/api/intervals", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const wellness = data && data.wellness ? data.wellness : {}
  const activities: any[] = data?.activities || []
  const hasFitness = !!(data && !data.error && data.wellness)

  // Weekly summary from the activities Intervals.icu already returns
  const summary = useMemo(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const recent = activities.filter((a) => {
      if (!a.dateDisplay) return true // fall back to counting all if no parseable date
      return true
    })
    const totalDistance = activities.reduce((s, a) => s + (parseFloat(a.distanceDisplay) || 0), 0)
    return {
      count: activities.length,
      totalDistanceDisplay: totalDistance > 0 ? `${totalDistance.toFixed(1)} km` : "--",
    }
  }, [activities])

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
      {/* Weekly summary from Intervals.icu */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Footprints} label="Pasos" value={wellness.stepsDisplay ?? "--"} sub="Hoy" accent="teal" />
        <StatCard icon={Moon} label="Sueño" value={wellness.sleepDisplay ?? "--"} sub="Anoche" accent="primary" />
        <StatCard icon={Activity} label="Actividades" value={String(summary.count)} sub="Últimos 14 días" accent="amber" />
        <StatCard icon={Route} label="Distancia total" value={summary.totalDistanceDisplay} sub="Últimos 14 días" accent="green" />
      </div>

      {activities.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay actividades de running recientes.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Todas las actividades</p>
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
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
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
