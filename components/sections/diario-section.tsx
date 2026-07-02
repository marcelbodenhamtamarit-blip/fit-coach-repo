"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  ChevronDown,
  Heart,
  Flame,
  Mountain,
  Zap,
  Timer,
  Navigation,
  Bike,
  Waves,
} from "lucide-react"
import { Card } from "@/components/ui/card"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const SPORT_ICON: Record<string, typeof Navigation> = {
  running: Navigation,
  cycling: Bike,
  swimming: Waves,
  other: Zap,
}

export function DiarioSection() {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const { data, isLoading } = useSWR("/api/garmin/activities", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const activities: any[] = data?.activities || []

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Sin actividades de Garmin todavía. Se sincronizan automáticamente cada día.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {activities.map((a) => {
        const Icon = SPORT_ICON[a.sport] ?? Zap
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
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <span className="text-xs text-muted-foreground">{a.dateDisplay}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{a.sportLabel}</span>
                      <span>{a.distanceDisplay}</span>
                      <span>{a.durationDisplay}</span>
                      <span>{a.avgHr}</span>
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
                  <DetailItem icon={Heart} label="FC máx." value={a.maxHr} />
                  <DetailItem icon={Mountain} label="Desnivel" value={a.elevation} />
                  <DetailItem icon={Flame} label="Calorías" value={a.calories} />
                  <DetailItem icon={Zap} label="Carga (TSS)" value={a.tss} />
                </div>
              </div>
            )}
          </div>
        )
      })}
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
