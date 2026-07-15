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
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts"
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
  const dailySleep: any[] = data?.dailySleep || []
  const dailySteps: any[] = data?.dailySteps || []
  const hasFitness = !!(data && !data.error && data.wellness)
  const kmRun = data?.kmRun ?? 0
const kmWalked = data?.kmWalked ?? 0
    const totalSleepHours = useMemo(() => dailySleep.reduce((s, d) => s + (d.hours || 0), 0),
    [dailySleep],
  )

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Footprints} label="Pasos" value={wellness.stepsDisplay ?? "--"} sub="Hoy" accent="teal" />
        <StatCard icon={Moon} label="Sueño total (7d)" value={`${totalSleepHours.toFixed(1)}h`} sub="Última semana" accent="primary" />
        <StatCard icon={Navigation} label="Km corridos" value={`${kmRun.toFixed(1)} km`} sub="Últimos 14 días" accent="amber" />
<StatCard icon={Route} label="Km caminados" value={`${(kmWalked + (data?.kmWalkedFromSteps ?? 0)).toFixed(1)} km`} sub={(data?.kmWalkedFromSteps ?? 0) > 0 ? `~${(data?.kmWalkedFromSteps ?? 0).toFixed(1)} km por pasos` : "Últimos 14 días"} accent="green" />      </div>

      {/* Daily sleep table + chart */}
      {dailySleep.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Moon className="size-4 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Horas dormidas esta semana</p>
          </div>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Día</th>
                  <th className="py-1.5 text-right font-medium">Horas</th>
                  <th className="py-1.5 text-right font-medium">Calidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dailySleep.map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5 capitalize">{d.dayLabel} {d.dateDisplay}</td>
                    <td className="py-1.5 text-right font-semibold">{d.hoursDisplay}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{d.score ?? "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySleep} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="dayLabel" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} tickFormatter={(v) => `${v}h`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1d", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#888" }}
                  formatter={(value: number) => [`${value}h`, "Sueño"]}
                />
                <Bar dataKey="hours" fill="#7c6fff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Daily steps table + chart */}
      {dailySteps.length > 0 && (
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Footprints className="size-4 text-teal-500" />
            <p className="text-xs font-medium text-muted-foreground">Pasos por día esta semana</p>
          </div>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-1.5 text-left font-medium">Día</th>
                  <th className="py-1.5 text-right font-medium">Pasos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dailySteps.map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5 capitalize">{d.dayLabel} {d.dateDisplay}</td>
                    <td className="py-1.5 text-right font-semibold">{d.stepsDisplay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySteps} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="dayLabel" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 10 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1a1a1d", border: "1px solid #333", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#888" }}
                  formatter={(value: number) => [value.toLocaleString("es-ES"), "Pasos"]}
                />
                <Line type="monotone" dataKey="steps" stroke="#2dd4bf" strokeWidth={2} dot={{ fill: "#2dd4bf", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {activities.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay actividades recientes.</p>
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
