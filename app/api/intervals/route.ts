import { NextResponse, NextRequest } from "next/server"

const BASE = "https://intervals.icu/api/v1"

function isoDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function formatMovingTime(seconds: number | null): string {
  if (!seconds) return "--"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatSleepTime(seconds: number | null): string {
  if (!seconds) return "--"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function formatDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
}

function formatDayShort(iso: string): string {
  if (!iso) return ""
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("es-ES", { weekday: "short" })
}

function makeAuth(apiKey: string) {
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64")
}

function makeHeaders(apiKey: string) {
  return {
    Authorization: makeAuth(apiKey),
    Accept: "application/json",
    "Content-Type": "application/json",
  }
}

async function fetchIntervals(apiKey: string, athleteId: string) {
  const id = athleteId.startsWith("i") ? athleteId : `i${athleteId}`
  const headers = makeHeaders(apiKey)
  const newest = isoDaysAgo(0)
  const oldest14 = isoDaysAgo(14)
  const oldest7 = isoDaysAgo(7)

  try {
    const profileRes = await fetch(`${BASE}/athlete/${id}/profile`, {
      headers,
      cache: "no-store",
    })

    if (profileRes.status === 401 || profileRes.status === 403) {
      return {
        error: "Clave API o ID de atleta incorrectos. Comprueba tus credenciales en Ajustes.",
        status: 401,
      }
    }

    if (!profileRes.ok) {
      return {
        error: `Error al conectar con Intervals.icu (${profileRes.status}). Comprueba tus credenciales.`,
        status: profileRes.status,
      }
    }

    const [activitiesRes, wellnessRes] = await Promise.all([
      fetch(
        `${BASE}/athlete/${id}/activities?oldest=${oldest14}&newest=${newest}`,
        { headers, cache: "no-store" },
      ),
      fetch(
        `${BASE}/athlete/${id}/wellness?oldest=${oldest7}&newest=${newest}`,
        { headers, cache: "no-store" },
      ),
    ])

    if (!activitiesRes.ok || !wellnessRes.ok) {
      return {
        error: `Error al obtener datos (${activitiesRes.status}/${wellnessRes.status}).`,
        status: 502,
      }
    }

    const activitiesRaw = (await activitiesRes.json()) as any[]
    const wellnessRaw = (await wellnessRes.json()) as any[]

    // Running AND walking activities (used for "km corridos y caminados")
    const relevantActivities = (activitiesRaw || [])
      .filter((a) => {
        const t = (a.type || "").toLowerCase()
        return t.includes("run") || t === "virtualrun" || t.includes("walk") || t.includes("hike")
      })
      .slice(0, 10)

    const activities = relevantActivities.map((a) => {
      const distM = a.distance || 0
      const distKm = distM > 0 ? +(distM / 1000).toFixed(1) : null
      const movingSec = a.moving_time || null
      const t = (a.type || "").toLowerCase()
      const isRun = t.includes("run")

      let avgPace = "--"
      if (movingSec && distKm && distKm > 0) {
        const paceSecPerKm = movingSec / distKm
        const paceMin = Math.floor(paceSecPerKm / 60)
        const paceSec = Math.round(paceSecPerKm % 60)
        avgPace = `${paceMin}:${String(paceSec).padStart(2, "0")}/km`
      }

      return {
        id: `icu-${a.id}`,
        name: a.name || (isRun ? "Running" : "Caminata"),
        type: isRun ? "run" : "walk",
        dateDisplay: formatDate((a.start_date_local || a.start_date || "").slice(0, 10)),
        dateISO: (a.start_date_local || a.start_date || "").slice(0, 10),
        distanceDisplay: distKm ? `${distKm} km` : "--",
        distanceKm: distKm ?? 0,
        durationDisplay: formatMovingTime(movingSec),
        movingSec,
        heartRateAvg: a.average_heartrate ? `${Math.round(a.average_heartrate)} bpm` : "--",
        heartRateMax: a.max_heartrate ? `${Math.round(a.max_heartrate)} bpm` : "--",
        elevation: a.total_elevation_gain != null ? `${Math.round(a.total_elevation_gain)} m` : "--",
        calories: a.calories ? `${Math.round(a.calories)} kcal` : "--",
        trainingLoad: a.training_load ? String(Math.round(a.training_load)) : "--",
        avgPace,
        source: "intervals.icu" as const,
      }
    })

    const kmRun = activities.filter((a) => a.type === "run").reduce((s, a) => s + a.distanceKm, 0)
    const kmWalked = activities.filter((a) => a.type === "walk").reduce((s, a) => s + a.distanceKm, 0)

    const sortedWellness = [...(wellnessRaw || [])].sort((a, b) =>
      (b.id || b.date || "").localeCompare(a.id || a.date || ""),
    )

    const findLatest = (field: string) => {
      const entry = sortedWellness.find((w) => w[field] != null)
      return entry ? entry[field] : null
    }

    const ctl = findLatest("ctl")
    const atl = findLatest("atl")
    const tsb = findLatest("tsb")
    const restingHR = findLatest("restingHR")
    const stepsRaw = findLatest("steps")
    const sleepSecsRaw = findLatest("sleepSecs")
    const sleepScore = findLatest("sleepScore")
    const hrv = findLatest("hrv")

    const wellness = {
      ctl: ctl != null ? Math.round(ctl) : null,
      atl: atl != null ? Math.round(atl) : null,
      tsb: tsb != null ? Math.round(tsb) : null,
      restingHR: restingHR != null ? Math.round(restingHR) : null,
      steps: stepsRaw != null ? stepsRaw : null,
      stepsDisplay: stepsRaw != null ? stepsRaw.toLocaleString("es-ES") : "--",
      sleepSecs: sleepSecsRaw,
      sleepDisplay: formatSleepTime(sleepSecsRaw),
      sleepScore: sleepScore != null ? Math.round(sleepScore) : null,
      hrv: hrv != null ? Math.round(hrv) : null,
    }

    // Daily sleep for the past week (ascending by date), for tables/charts
    const dailySleep = (wellnessRaw || [])
      .filter((w) => w.sleepSecs != null)
      .map((w) => {
        const dateISO = (w.id || w.date || "").slice(0, 10)
        return {
          date: dateISO,
          dayLabel: formatDayShort(dateISO),
          dateDisplay: formatDate(dateISO),
          hours: +(w.sleepSecs / 3600).toFixed(1),
          hoursDisplay: formatSleepTime(w.sleepSecs),
          score: w.sleepScore ?? null,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    // Daily steps for the past week (ascending by date)
    const dailySteps = (wellnessRaw || [])
      .filter((w) => w.steps != null)
      .map((w) => {
        const dateISO = (w.id || w.date || "").slice(0, 10)
        return {
          date: dateISO,
          dayLabel: formatDayShort(dateISO),
          dateDisplay: formatDate(dateISO),
          steps: w.steps,
          stepsDisplay: Number(w.steps).toLocaleString("es-ES"),
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))

    // Legacy shape used elsewhere
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

    return {
      activities,
      kmRun: +kmRun.toFixed(1),
      kmWalked: +kmWalked.toFixed(1),
      wellness,
      dailySleep,
      dailySteps,
      sleep,
      weights,
      syncedAt: new Date().toISOString(),
    }
  } catch (err) {
    return {
      error: "No se pudo conectar con Intervals.icu. Comprueba tu conexión a internet.",
      status: 500,
    }
  }
}

export async function GET() {
  const apiKey = process.env.INTERVALS_ICU_API_KEY
  const athleteId = process.env.INTERVALS_ICU_ATHLETE_ID

  if (!apiKey || !athleteId) {
    return NextResponse.json(
      { error: "Sin credenciales. Añade tu ID de atleta y clave API en Ajustes." },
      { status: 400 },
    )
  }

  const result = await fetchIntervals(apiKey, athleteId)

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: (result as any).status ?? 500 })
  }

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { athleteId, apiKey } = body

  if (!apiKey || !athleteId) {
    return NextResponse.json({ error: "Faltan el ID de atleta o la clave API." }, { status: 400 })
  }

  const result = await fetchIntervals(apiKey, athleteId)

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: (result as any).status ?? 500 })
  }

  return NextResponse.json(result)
}
