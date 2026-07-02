import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

function formatDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const SPORT_LABEL: Record<string, string> = {
  running: "Running",
  cycling: "Ciclismo",
  swimming: "Natación",
  other: "Actividad",
}

export async function GET() {
  const { data, error } = await supabase
    .from("garmin_activities")
    .select("*")
    .order("start_time", { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const activities = (data || []).map((a) => ({
    id: a.id,
    title: a.title,
    sport: a.sport,
    sportLabel: SPORT_LABEL[a.sport] ?? "Actividad",
    dateDisplay: formatDate(a.start_time),
    dateISO: (a.start_time || "").slice(0, 10),
    distanceDisplay: a.distance_km ? `${a.distance_km} km` : "--",
    durationDisplay: formatDuration(a.duration_seconds),
    avgHr: a.avg_hr ? `${a.avg_hr} bpm` : "--",
    maxHr: a.max_hr ? `${a.max_hr} bpm` : "--",
    calories: a.calories ? `${a.calories} kcal` : "--",
    elevation: a.elevation_gain != null ? `${a.elevation_gain} m` : "--",
    tss: a.tss != null ? String(Math.round(a.tss)) : "--",
  }))

  return NextResponse.json({ activities, count: activities.length })
}
