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
    const [activitiesRes, wellnessRes, athleteRes] = await Promise.all([
      fetch(`${BASE}/athlete/${id}/activities?oldest=${isoDaysAgo(14)}&newest=${newest}`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
      fetch(`${BASE}/athlete/${id}/wellness?oldest=${isoDaysAgo(7)}&newest=${newest}`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
      fetch(`${BASE}/athlete/${id}.json`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
    ])

    if (activitiesRes.status === 401 || wellnessRes.status === 401 || athleteRes.status === 401) {
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
    const athleteData = athleteRes.ok ? (await athleteRes.json()) as any : null

    // Limit to last 10 activities for list view
    const recentActivities = (activitiesRaw || []).slice(0, 10)
    
    const workouts = recentActivities.map((a) => {
      const movingTimeSec = a.moving_time || 0
      const hours = Math.floor(movingTimeSec / 3600)
      const minutes = Math.floor((movingTimeSec % 3600) / 60)
      
      return {
        id: `icu-${a.id}`,
        date: (a.start_date_local || a.start_date || "").slice(0, 10),
        name: a.name || a.type || "Actividad",
        type: a.type || "Otro",
        durationSec: movingTimeSec,
        durationMin: Math.round(movingTimeSec / 60),
        durationDisplay: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
        calories: a.calories ?? null,
        distanceKm: a.distance ? +(a.distance / 1000).toFixed(1) : null,
        heartRateAvg: a.avg_heart_rate ?? null,
        heartRateMax: a.max_heart_rate ?? null,
        elevation: a.total_elevation_gain ?? null,
        trainingLoad: a.training_load ?? null,
        averagePower: a.average_watts ?? null,
        elapsedTime: a.elapsed_time ?? null,
        source: "intervals.icu" as const,
      }
    })

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

    // Get today's wellness data for steps and resting HR
    const todayWellness = wellnessRaw?.[wellnessRaw.length - 1] || null

    // Extract fitness metrics from athlete data (CTL, ATL, TSB)
    const fitnessMetrics = {
      ctl: athleteData?.ctl ?? null,
      atl: athleteData?.atl ?? null,
      tsb: athleteData?.tsb ?? null,
    }

    return NextResponse.json({
      workouts,
      sleep,
      weights,
      dailyMetrics,
      fitnessMetrics,
      todayWellness: {
        steps: todayWellness?.steps ?? null,
        restingHeartRate: todayWellness?.restingHR ?? null,
      },
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo conectar con intervals.icu." },
      { status: 500 },
    )
  }
}
