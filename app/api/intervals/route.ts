import { NextResponse, NextRequest } from "next/server"

const BASE = "https://intervals.icu/api/v1"

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

async function fetchIntervals(apiKey: string, athleteId: string) {
  const id = athleteId.startsWith("i") ? athleteId : `i${athleteId}`
  const auth = "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64")
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
      return {
        error: "Invalid API key or athlete ID. Check your credentials in Settings.",
        status: 401,
      }
    }

    if (!activitiesRes.ok || !wellnessRes.ok) {
      return {
        error: `Connection error (${activitiesRes.status}/${wellnessRes.status}).`,
        status: 502,
      }
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
        name: a.name || a.type || "Activity",
        type: a.type || "Other",
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
        averagePace: a.average_pace ?? null,
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

    const dailyMetrics = (wellnessRaw || [])
      .filter((w) => w.date != null)
      .map((w) => ({
        id: `icu-daily-${w.date}`,
        date: (w.date || "").slice(0, 10),
        steps: w.steps ?? null,
        restingHeartRate: w.restingHR ?? null,
        hrv: w.hrv ?? null,
        temperature: w.temp ?? null,
        sleepHours: w.sleepSecs ? +(w.sleepSecs / 3600).toFixed(1) : null,
        sleepScore: w.sleepScore ?? null,
        source: "intervals.icu" as const,
      }))

    const todayWellness = wellnessRaw?.[wellnessRaw.length - 1] || null

    const fitnessMetrics = {
      ctl: athleteData?.ctl ?? null,
      atl: athleteData?.atl ?? null,
      tsb: athleteData?.tsb ?? null,
    }

    return {
      workouts,
      sleep,
      weights,
      dailyMetrics,
      fitnessMetrics,
      todayWellness: {
        steps: todayWellness?.steps ?? null,
        restingHeartRate: todayWellness?.restingHR ?? null,
        hrv: todayWellness?.hrv ?? null,
        sleepHours: todayWellness?.sleepSecs ? +(todayWellness.sleepSecs / 3600).toFixed(1) : null,
        sleepScore: todayWellness?.sleepScore ?? null,
      },
      syncedAt: new Date().toISOString(),
    }
  } catch (err) {
    return {
      error: "Failed to connect to Intervals.icu",
      status: 500,
    }
  }
}

export async function GET() {
  const apiKey = process.env.INTERVALS_ICU_API_KEY
  const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID

  if (!apiKey || !athleteId) {
    return NextResponse.json(
      {
        error: "No credentials configured. Add your Intervals.icu details in Settings.",
      },
      { status: 400 },
    )
  }

  const result = await fetchIntervals(apiKey, athleteId)

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { athleteId, apiKey } = body

  if (!apiKey || !athleteId) {
    return NextResponse.json(
      { error: "Missing athlete ID or API key" },
      { status: 400 },
    )
  }

  const result = await fetchIntervals(apiKey, athleteId)

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
