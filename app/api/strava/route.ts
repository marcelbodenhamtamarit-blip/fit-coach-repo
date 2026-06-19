import { NextResponse } from "next/server"

const BASE = "https://www.strava.com/api/v3"

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return Math.floor(d.getTime() / 1000) // Strava uses Unix timestamp
}

export async function GET() {
  const token = process.env.STRAVA_ACCESS_TOKEN

  if (!token) {
    return NextResponse.json(
      {
        error: "Falta STRAVA_ACCESS_TOKEN. Agrega tu Personal Access Token en los ajustes del proyecto.",
      },
      { status: 400 },
    )
  }

  const after = isoDaysAgo(30)
  const before = isoDaysAgo(0)

  try {
    const activitiesRes = await fetch(
      `${BASE}/athlete/activities?after=${after}&before=${before}&per_page=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      },
    )

    if (!activitiesRes.ok) {
      throw new Error(`Strava API error: ${activitiesRes.status}`)
    }

    const activities = await activitiesRes.json()

    // Transform Strava activities to app format
    const workouts = activities.map((a: any) => ({
      id: `strava-${a.id}`,
      date: a.start_date.slice(0, 10),
      name: a.name,
      type: a.type,
      durationMin: Math.round(a.moving_time / 60),
      calories: a.calories || null,
      distanceKm: a.distance ? (a.distance / 1000).toFixed(2) : null,
    }))

    return NextResponse.json({ workouts, sleep: [], weights: [] })
  } catch (error: any) {
    console.error("[Strava API Error]:", error?.message)
    return NextResponse.json(
      { error: error?.message || "Error fetching Strava data" },
      { status: 500 },
    )
  }
}
