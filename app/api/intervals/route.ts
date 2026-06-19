import { NextResponse } from "next/server"

const BASE = "https://intervals.icu/api/v1"

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const apiKey = process.env.INTERVALS_ICU_API_KEY
  const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID

  if (!apiKey || !athleteId) {
    return NextResponse.json(
      {
        error:
          "Faltan credenciales. Agrega INTERVALS_ICU_API_KEY e INTERVALS_ICU_ATHLETE_ID en los ajustes del proyecto.",
      },
      { status: 400 },
    )
  }

  const id = athleteId.startsWith("i") ? athleteId : `i${athleteId}`
  const auth = "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64")
  const oldest = isoDaysAgo(30)
  const newest = isoDaysAgo(0)

  try {
    const [activitiesRes, wellnessRes] = await Promise.all([
      fetch(`${BASE}/athlete/${id}/activities?oldest=${oldest}&newest=${newest}`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
      fetch(`${BASE}/athlete/${id}/wellness?oldest=${oldest}&newest=${newest}`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
    ])

    if (activitiesRes.status === 401 || wellnessRes.status === 401) {
      return NextResponse.json(
        { error: "Clave API inválida. Genera una nueva en intervals.icu (Ajustes > Developer)." },
        { status: 401 },
      )
    }

    if (!activitiesRes.ok || !wellnessRes.ok) {
      return NextResponse.json(
        { error: `Error de intervals.icu (${activitiesRes.status}/${wellnessRes.status}).` },
        { status: 502 },
      )
    }

    const activitiesRaw = (await activitiesRes.json()) as any[]
    const wellnessRaw = (await wellnessRes.json()) as any[]

    const workouts = (activitiesRaw || []).map((a) => ({
      id: `icu-${a.id}`,
      date: (a.start_date_local || a.start_date || "").slice(0, 10),
      name: a.name || a.type || "Actividad",
      type: a.type || "Otro",
      durationMin: a.moving_time ? Math.round(a.moving_time / 60) : 0,
      calories: a.calories ?? null,
      distanceKm: a.distance ? +(a.distance / 1000).toFixed(2) : null,
      heartRateAvg: a.avg_heart_rate ?? null,
      heartRateMax: a.max_heart_rate ?? null,
      elevation: a.total_elevation_gain ?? null,
      source: "intervals.icu" as const,
    }))

    const sleep = (wellnessRaw || [])
      .filter((w) => w.sleepSecs != null || w.sleepScore != null)
      .map((w) => ({
        id: `icu-sleep-${w.id || w.date}`,
        date: (w.id || w.date || "").slice(0, 10),
        hours: w.sleepSecs != null ? +(w.sleepSecs / 3600).toFixed(2) : null,
        score: w.sleepScore ?? null,
        source: "intervals.icu" as const,
      }))

    const weights = (wellnessRaw || [])
      .filter((w) => w.weight != null)
      .map((w) => ({
        id: `icu-weight-${w.id || w.date}`,
        date: (w.id || w.date || "").slice(0, 10),
        weightKg: w.weight,
        source: "intervals.icu" as const,
      }))

    // Daily wellness metrics: steps, resting HR, and other biomarkers
    const dailyMetrics = (wellnessRaw || [])
      .filter((w) => w.date != null)
      .map((w) => ({
        id: `icu-daily-${w.date}`,
        date: (w.date || "").slice(0, 10),
        steps: w.steps ?? null,
        restingHeartRate: w.restingHR ?? null,
        temperature: w.temp ?? null,
        comment: w.comment ?? null,
        source: "intervals.icu" as const,
      }))

    return NextResponse.json({
      workouts,
      sleep,
      weights,
      dailyMetrics,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo conectar con intervals.icu." },
      { status: 500 },
    )
  }
}
