"use client"

import { useStore } from "@/lib/store"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Droplets, Thermometer, Heart } from "lucide-react"

export function DailyMetricsSection() {
  const { data } = useStore()
  
  // Get the last 7 days of metrics
  const recentMetrics = (data.dailyMetrics || []).slice(0, 7)
  
  if (recentMetrics.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground text-center py-8">
          Sin datos de métricas diarias. Sincroniza con intervals.icu para ver pasos, pulsaciones, etc.
        </p>
      </Card>
    )
  }

  const avgSteps = Math.round(
    recentMetrics.reduce((sum, m) => sum + (m.steps || 0), 0) / recentMetrics.length
  )
  const avgRestingHR = Math.round(
    recentMetrics.reduce((sum, m) => sum + (m.restingHeartRate || 0), 0) /
      recentMetrics.filter((m) => m.restingHeartRate).length
  ) || 0

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <p className="text-xs text-muted-foreground">Pasos promedio</p>
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums">
            {avgSteps.toLocaleString()}
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Heart className="size-4 text-red-500" />
            <p className="text-xs text-muted-foreground">FC en reposo</p>
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums">
            {avgRestingHR} bpm
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Droplets className="size-4 text-blue-500" />
            <p className="text-xs text-muted-foreground">Máximas hoy</p>
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums">
            {recentMetrics[0]?.steps?.toLocaleString() || "—"}
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Thermometer className="size-4 text-orange-500" />
            <p className="text-xs text-muted-foreground">Temperatura</p>
          </div>
          <p className="mt-1.5 text-lg font-semibold tabular-nums">
            {recentMetrics[0]?.temperature ? `${recentMetrics[0].temperature}°C` : "—"}
          </p>
        </Card>
      </div>

      {/* Daily breakdown */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Últimos 7 días</p>
        <div className="space-y-2">
          {recentMetrics.map((metric) => {
            const date = new Date(metric.date + "T00:00:00")
            const dateStr = date.toLocaleDateString("es-ES", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })

            return (
              <Card key={metric.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{dateStr}</p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {metric.steps && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Activity className="size-3" />
                        {metric.steps.toLocaleString()} pasos
                      </Badge>
                    )}
                    {metric.restingHeartRate && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Heart className="size-3 text-red-500" />
                        {metric.restingHeartRate} bpm
                      </Badge>
                    )}
                    {metric.temperature && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Thermometer className="size-3 text-orange-500" />
                        {metric.temperature}°C
                      </Badge>
                    )}
                  </div>
                </div>
                {metric.comment && (
                  <p className="mt-1.5 text-xs text-muted-foreground italic">
                    "{metric.comment}"
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
