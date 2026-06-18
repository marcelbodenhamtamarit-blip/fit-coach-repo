import type { AppData } from "./types"
import { todayISO } from "./types"

type StoreLike = { data: AppData }

function avg(nums: number[]) {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Builds a compact, readable summary of the user's recent health data
 * that gets sent to the AI coach as system context.
 */
export function buildCoachContext({ data }: StoreLike): string {
  const { profile, workouts, routines, meals, sleep, metrics } = data
  const today = todayISO()

  // Recent workouts (last 5)
  const recentWorkouts = workouts.slice(0, 5).map((w) => {
    const volume = w.exercises.reduce(
      (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.reps * set.weight, 0),
      0,
    )
    return `- ${w.date}: ${w.name} (${w.durationMin} min, ${w.exercises.length} exercises, ${Math.round(volume)} kg total volume)`
  })

  // Today's nutrition
  const todayMeals = meals.filter((m) => m.date === today)
  const todayCals = todayMeals.reduce((s, m) => s + m.calories, 0)
  const todayProtein = todayMeals.reduce((s, m) => s + m.protein, 0)
  const todayCarbs = todayMeals.reduce((s, m) => s + m.carbs, 0)
  const todayFat = todayMeals.reduce((s, m) => s + m.fat, 0)

  // Recent sleep (last 7)
  const recentSleep = sleep.slice(0, 7)
  const avgSleep = avg(recentSleep.map((s) => s.hours))
  const avgQuality = avg(recentSleep.map((s) => s.quality))

  // Body metrics trend
  const latest = metrics[metrics.length - 1]
  const first = metrics[0]
  const weightChange =
    latest && first ? (latest.weight - first.weight).toFixed(1) : "n/a"

  const lines = [
    `## User Profile`,
    `Name: ${profile.name}`,
    `Goals: ${profile.calorieGoal} kcal/day, ${profile.proteinGoal}g protein/day, ${profile.sleepGoal}h sleep, target weight ${profile.weightGoal} kg`,
    ``,
    `## Routines (${routines.length})`,
    ...routines.map((r) => `- ${r.name} — ${r.focus} (${r.exercises.length} exercises)`),
    ``,
    `## Recent Workouts`,
    recentWorkouts.length ? recentWorkouts.join("\n") : "No workouts logged yet.",
    ``,
    `## Today's Nutrition`,
    `${todayCals}/${profile.calorieGoal} kcal, ${todayProtein}g protein, ${todayCarbs}g carbs, ${todayFat}g fat (${todayMeals.length} meals logged)`,
    ``,
    `## Sleep (last ${recentSleep.length} nights)`,
    `Average ${avgSleep.toFixed(1)}h/night, average quality ${avgQuality.toFixed(1)}/5`,
    ``,
    `## Body Metrics`,
    latest
      ? `Current: ${latest.weight} kg, ${latest.bodyFat}% body fat, ${latest.waist} cm waist. Weight change over tracked period: ${weightChange} kg.`
      : "No metrics logged yet.",
  ]

  return lines.join("\n")
}
