"use client"

import { useState } from "react"
import {
  ChevronDown,
  Heart,
  Zap,
  Flame,
  Mountain,
  AlertCircle,
  Timer,
  Activity,
  Navigation,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function FitnessSection({ onSettings }: { onSettings?: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const { data: fitnessData, isLoading, error } = useSWR(
    "/api/intervals",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  const hasCredentialError =
    fitnessData?.error?.includes("Sin credenciales") ||
    error?.error?.includes("Sin credenciales") ||
    (fitnessData?.error && !fitnessData?.activities)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (hasCredentialError) {
    return (
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <h3 className="mb-1 font-semibold">Intervals.icu no conectado</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Conecta tu cuenta de Intervals.icu en Ajustes para ver tus datos.
            </p>
            {onSettings && (
              <Button onClick={onSettings} size="sm">
                Ir a Ajustes
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  const wellness = fitnessData?.wellness || {}
  const activities: any[] = fitnessData?.activities || []

  return (
    <div className="space-y-6">
      {/* Panel desplegable: Pasos, Latido y Actividades recientes */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted/50 sm:p-4"
        >
          <h3 className="text-sm font-semibold">Forma física</h3>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
              panelOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {panelOpen && (
          <div className="space-y-4 border-t border-border p-3 sm:p-4">
            {/* Pasos y Latido */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <WellnessItem label="Pasos" value={wellness.stepsDisplay ?? "--"} icon={Activity} />
              <WellnessItem label="FC reposo" value={wellness.restingHR ? `${wellness.restingHR} bpm` : "--"} icon={Heart} />
              <WellnessItem label="Sueño" value={wellness.sleepDisplay ?? "--"} icon={Timer} />
              <WellnessItem label="HRV" value={wellness.hrv ? String(wellness.hrv) : "--"} icon={Zap} />
            </div>

            {/* Actividades recientes */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">Actividades recientes</h4>

              {activities.length === 0 ? (
                <div className="rounded-lg border border-border p-8 text-center">
                  <p className="text-sm text-muted-foreground">No hay actividades de running</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => (
                    <ActivityRow
                      key={a.id}
                      activity={a}
                      isExpanded={expandedId === a.id}
                      onToggle={() =>
                        setExpandedId(expandedId === a.id ? null : a.id)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WellnessItem({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: typeof Activity
}) {
  return (
    <Card className="flex items-center gap-2.5 p-3">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold">{value}</p>
      </div>
    </Card>
  )
}

function ActivityRow({
  activity,
  isExpanded,
  onToggle,
}: {
  activity: any
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        onClick={onToggle}
        className="w-full p-3 text-left transition-colors hover:bg-muted/50 sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Navigation className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="truncate text-sm font-medium">{activity.name}</p>
                <span className="text-xs text-muted-foreground">
                  {activity.dateDisplay}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{activity.distanceDisplay}</span>
                <span>{activity.durationDisplay}</span>
                <span>{activity.heartRateAvg}</span>
              </div>
            </div>
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border bg-muted/20 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <DetailItem icon={Heart} label="FC máx." value={activity.heartRateMax} />
            <DetailItem icon={Mountain} label="Desnivel" value={activity.elevation} />
            <DetailItem icon={Flame} label="Calorías" value={activity.calories} />
            <DetailItem icon={Zap} label="Carga" value={activity.trainingLoad} />
            <DetailItem icon={Timer} label="Ritmo medio" value={activity.avgPace} />
          </div>
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
