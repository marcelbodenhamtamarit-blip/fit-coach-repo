import { GarminConnect } from "@flow-js/garmin-connect"
import { supabase } from "@/lib/supabase"

type RawActivity = {
  activityId: number
  activityName?: string
  activityType?: { typeKey?: string }
  startTimeLocal?: string
  startTimeGMT?: string
  distance?: number
  duration?: number
  movingDuration?: number
  elevationGain?: number
  averageHR?: number
  maxHR?: number
  calories?: number
  trainingStressScore?: number
  averageSpeed?: number
  avgPower?: number
  normPower?: number
  averageRunningCadenceInStepsPerMinute?: number
  averageBikingCadenceInRevPerMinute?: number
  vO2MaxValue?: number
  aerobicTrainingEffect?: number
  anaerobicTrainingEffect?: number
  averageSwolf?: number
}

const SPORT_MAP: Record<string, string> = {
  running: "running",
  trail_running: "running",
  treadmill_running: "running",
  cycling: "cycling",
  road_cycling: "cycling",
  indoor_cycling: "cycling",
  virtual_ride: "cycling",
  mountain_biking: "cycling",
  swimming: "swimming",
  open_water_swimming: "swimming",
  pool_swimming: "swimming",
}

function sportFromActivity(activity: RawActivity): string {
  const raw = (activity.activityType?.typeKey || "other").toLowerCase()
  return SPORT_MAP[raw] || "other"
}

function normalizeActivity(activity: RawActivity, hrZonesRaw: unknown, splitsRaw: unknown) {
  const sport = sportFromActivity(activity)
  const avgSpeed = activity.averageSpeed || 0
  const avgPace = avgSpeed > 0 ? Math.round(1000 / avgSpeed) : null

let hrZones: unknown[] | null = null
  if (Array.isArray(hrZonesRaw)) {
    hrZones = hrZonesRaw
  }

let laps: unknown[] | null = null
  if (splitsRaw && typeof splitsRaw === "object") {
    const s = splitsRaw as Record<string, unknown>
    const lapsData = s.lapDTOs || s.splits
    if (Array.isArray(lapsData)) laps = lapsData
  }

return {
  id: activity.activityId,
  title: activity.activityName || "Untitled",
  sport,
  start_time: activity.startTimeLocal || activity.startTimeGMT || new Date().toISOString(),
  distance_km: Math.round(((activity.distance || 0) / 1000) * 100) / 100,
  duration_seconds: Math.round(activity.duration || 0),
  moving_time_seconds: Math.round(activity.movingDuration || activity.duration || 0),
  elevation_gain: Math.round(activity.elevationGain || 0),
  avg_hr: activity.averageHR ? Math.round(activity.averageHR) : null,
  max_hr: activity.maxHR ? Math.round(activity.maxHR) : null,
  calories: activity.calories ? Math.round(activity.calories) : null,
  tss: activity.trainingStressScore ?? null,
  avg_pace: avgPace,
  avg_speed: avgSpeed ? Math.round(avgSpeed * 3.6 * 10) / 10 : null,
  avg_power: activity.avgPower ? Math.round(activity.avgPower) : null,
  normalized_power: activity.normPower ? Math.round(activity.normPower) : null,
  avg_cadence: activity.averageRunningCadenceInStepsPerMinute
  ? Math.round(activity.averageRunningCadenceInStepsPerMinute)
    : activity.averageBikingCadenceInRevPerMinute
  ? Math.round(activity.averageBikingCadenceInRevPerMinute)
    : null,
  vo2max: activity.vO2MaxValue ?? null,
  aerobic_te: activity.aerobicTrainingEffect ?? null,
  anaerobic_te: activity.anaerobicTrainingEffect ?? null,
  swolf: sport === "swimming" ? (activity.averageSwolf ?? null) : null,
  laps,
  hr_zones: hrZones,
  gpx_coords: null,
}
}

async function updateSyncState(fields: Record<string, unknown>) {
  await supabase.from("garmin_sync_state").update(fields).eq("id", 1)
}

export type GarminSyncResult =
  | { ok: true; synced: number; activities: number[] }
| { ok: false; status: number; error: string; message?: string }

export async function runGarminSync(): Promise<GarminSyncResult> {
  const email = process.env.GARMIN_EMAIL
  const password = process.env.GARMIN_PASSWORD
  if (!email || !password) {
    return { ok: false, status: 500, error: "GARMIN_EMAIL or GARMIN_PASSWORD not configured" }
  }

const GCClient = new GarminConnect({ username: email, password })

try {
  await GCClient.login()
} catch (err) {
  const message = err instanceof Error ? err.message : "Unknown login error"
  await updateSyncState({ last_sync_status: "error", last_sync_error: message })
  return { ok: false, status: 500, error: "Garmin login failed", message }
}

const { data: stateRow } = await supabase
  .from("garmin_sync_state")
  .select("last_activity_id")
  .eq("id", 1)
  .maybeSingle()

const lastActivityId: number | null = stateRow?.last_activity_id ?? null

let rawActivities: RawActivity[]
  try {
    rawActivities = (await GCClient.getActivities(0, 20)) as unknown as RawActivity[]
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error fetching activities"
    await updateSyncState({ last_sync_status: "error", last_sync_error: message })
    return { ok: false, status: 500, error: "Failed to fetch activities", message }
  }

const newActivities = (rawActivities || [])
  .filter((a) => lastActivityId == null || a.activityId > lastActivityId)
  .sort((a, b) => a.activityId - b.activityId)

if (newActivities.length === 0) {
  await updateSyncState({ last_synced_at: new Date().toISOString(), last_sync_status: "ok", last_sync_count: 0 })
  return { ok: true, synced: 0, activities: [] }
}

const syncedIds: number[] = []

  for (const activity of newActivities) {
    const activityId = activity.activityId

  let hrZonesRaw: unknown = null
    try {
      hrZonesRaw = await GCClient.get(`/activity-service/activity/${activityId}/hrTimeInZones`)
    } catch {
      hrZonesRaw = null
    }

  let splitsRaw: unknown = null
    try {
      splitsRaw = await GCClient.get(`/activity-service/activity/${activityId}/splits`)
    } catch {
      splitsRaw = null
    }

  const normalized = normalizeActivity(activity, hrZonesRaw, splitsRaw)

  const { error: upsertError } = await supabase.from("garmin_activities").upsert(normalized)
    if (upsertError) {
      console.error(`[garmin-sync] failed to upsert activity ${activityId}:`, upsertError.message)
    } else {
      syncedIds.push(activityId)
    }

  await new Promise((r) => setTimeout(r, 500))
  }

const highestId = syncedIds.length > 0 ? Math.max(...syncedIds) : lastActivityId

await updateSyncState({
  last_synced_at: new Date().toISOString(),
  last_activity_id: highestId,
  last_sync_status: "ok",
  last_sync_count: syncedIds.length,
})

return { ok: true, synced: syncedIds.length, activities: syncedIds }
}
