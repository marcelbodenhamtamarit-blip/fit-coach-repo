"use client"

import { useState } from "react"
import { ChevronDown, MapPin, Heart, Zap, Clock, Flame, Mountain, TrendingUp, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function FitnessSection({ onSettings }: { onSettings?: () => void }) {
  const { data } = useStore()
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)
  const { data: fitnessData, isLoading, error } = useSWR("/api/intervals", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })

  const fitnessMetrics = fitnessData?.fitnessMetrics || {}
  const workouts = fitnessData?.workouts || []
  const noCredentials = error?.error?.includes("No credentials") || error?.error?.includes("Missing")

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (noCredentials) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-900 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-yellow-900 mb-1">No Intervals.icu credentials</h3>
            <p className="text-sm text-yellow-800 mb-4">Add your Intervals.icu details in Settings to see your fitness data, activities, and metrics.</p>
            {onSettings && (
              <Button onClick={onSettings} size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                Go to Settings
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Fitness Metrics Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <MetricCard
          label="CTL"
          value={fitnessMetrics.ctl}
          subtitle="Fitness"
          icon={TrendingUp}
          color="blue"
        />
        <MetricCard
          label="ATL"
          value={fitnessMetrics.atl}
          subtitle="Fatigue"
          icon={Zap}
          color="orange"
        />
        <MetricCard
          label="TSB"
          value={fitnessMetrics.tsb}
          subtitle="Form"
          icon={Heart}
          color={
            typeof fitnessMetrics.tsb === "number"
              ? fitnessMetrics.tsb >= 0
                ? "green"
                : "red"
              : "gray"
          }
        />
      </div>

      {/* Activities List */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Recent Activities</h3>
        {workouts.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No activities found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workouts.map((workout) => (
              <ActivityCard
                key={workout.id}
                workout={workout}
                isExpanded={expandedActivityId === workout.id}
                onToggle={() =>
                  setExpandedActivityId(
                    expandedActivityId === workout.id ? null : workout.id,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string
  value: number | null | undefined
  subtitle: string
  icon: typeof TrendingUp
  color: "blue" | "orange" | "green" | "red" | "gray"
}) {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-600 border-blue-200",
    orange: "bg-orange-500/10 text-orange-600 border-orange-200",
    green: "bg-green-500/10 text-green-600 border-green-200",
    red: "bg-red-500/10 text-red-600 border-red-200",
    gray: "bg-muted text-muted-foreground border-border",
  }

  return (
    <Card className={`flex flex-col items-center gap-2 p-3 ${colorClasses[color]}`}>
      <Icon className="size-5" />
      <div className="text-center">
        <p className="text-xs font-medium text-muted-foreground">{subtitle}</p>
        <p className="text-xl font-bold">
          {value !== null && value !== undefined ? Math.round(value) : "—"}
        </p>
      </div>
    </Card>
  )
}

interface ActivityCardProps {
  workout: any
  isExpanded: boolean
  onToggle: () => void
}

function ActivityCard({ workout, isExpanded, onToggle }: ActivityCardProps) {
  const getActivityIcon = (type: string) => {
    if (type.toLowerCase().includes("run")) return "🏃"
    if (type.toLowerCase().includes("ride") || type.toLowerCase().includes("bike")) return "🚴"
    if (type.toLowerCase().includes("swim")) return "🏊"
    if (type.toLowerCase().includes("walk")) return "🚶"
    return "⚡"
  }

  const formatPace = (distanceKm: number | null, durationSec: number | null) => {
    if (!distanceKm || !durationSec || distanceKm === 0) return "—"
    const paceMinutes = Math.floor((durationSec / 60) / distanceKm)
    const paceSeconds = Math.round(((durationSec / 60) % distanceKm) * 60)
    return `${paceMinutes}:${String(paceSeconds).padStart(2, "0")}/km`
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card transition-all">
      {/* Summary */}
      <button
        onClick={onToggle}
        className="w-full p-3 sm:p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <span className="text-xl">{getActivityIcon(workout.type)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm truncate">{workout.name}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(workout.date + "T00:00:00").toLocaleDateString("es-ES", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {workout.distanceKm && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {workout.distanceKm} km
                  </span>
                )}
                {workout.durationDisplay && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {workout.durationDisplay}
                  </span>
                )}
                {workout.heartRateAvg && (
                  <span className="flex items-center gap-1">
                    <Heart className="size-3" />
                    {Math.round(workout.heartRateAvg)} bpm
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronDown
            className={`size-5 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border bg-muted/30 p-3 sm:p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {workout.elevation && (
              <DetailItem
                icon={Mountain}
                label="Elevation"
                value={`${Math.round(workout.elevation)} m`}
              />
            )}
            {workout.heartRateMax && (
              <DetailItem
                icon={Heart}
                label="Max HR"
                value={`${Math.round(workout.heartRateMax)} bpm`}
              />
            )}
            {workout.calories && (
              <DetailItem
                icon={Flame}
                label="Calories"
                value={`${Math.round(workout.calories)} kcal`}
              />
            )}
            {workout.trainingLoad && (
              <DetailItem
                icon={Zap}
                label="Training Load"
                value={`${Math.round(workout.trainingLoad)}`}
              />
            )}
            {workout.distanceKm && (
              <DetailItem
                icon={MapPin}
                label="Avg Pace"
                value={formatPace(workout.distanceKm, workout.durationSec)}
              />
            )}
            {workout.averagePower && (
              <DetailItem icon={Zap} label="Avg Power" value={`${Math.round(workout.averagePower)} W`} />
            )}
          </div>

          {/* Additional Details */}
          <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {workout.elapsedTime && workout.durationSec && (
              <p>
                Moving time vs Elapsed time:{" "}
                <span className="font-medium">
                  {formatSeconds(workout.durationSec)} / {formatSeconds(workout.elapsedTime)}
                </span>
              </p>
            )}
            <a
              href={`https://intervals.icu/app/activities/${workout.id.replace("icu-", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
            >
              View on Intervals.icu →
            </a>
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
  icon: typeof MapPin
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm">{value}</p>
      </div>
    </div>
  )
}

function formatSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
