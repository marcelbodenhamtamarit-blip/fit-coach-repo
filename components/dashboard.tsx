"use client"

import { useState } from "react"
import {
  Activity,
  Dumbbell,
  UtensilsCrossed,
  Moon,
  Scale,
  Sparkles,
  Heart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { OverviewSection } from "@/components/sections/overview-section"
import { WorkoutsSection } from "@/components/sections/workouts-section"
import { NutritionSection } from "@/components/sections/nutrition-section"
import { SleepSection } from "@/components/sections/sleep-section"
import { MetricsSection } from "@/components/sections/metrics-section"
import { CoachSection } from "@/components/sections/coach-section"
import { DailyMetricsSection } from "@/components/sections/daily-metrics-section"
import { SyncButton } from "@/components/sync-button"

type Tab = {
  id: string
  label: string
  icon: typeof Activity
}

const TABS: Tab[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "workouts", label: "Workouts", icon: Dumbbell },
  { id: "nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { id: "sleep", label: "Sleep", icon: Moon },
  { id: "daily", label: "Daily", icon: Heart },
  { id: "metrics", label: "Body", icon: Scale },
  { id: "coach", label: "AI Coach", icon: Sparkles },
]

export function Dashboard() {
  const [active, setActive] = useState("overview")
  const { data, ready } = useStore()

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Marcel</p>
            <p className="text-xs text-muted-foreground">Fit Coach</p>
          </div>
        </div>

        <nav className="mt-8 flex flex-col gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = active === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
                {isActive && (
                  <span className="ml-auto size-1.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Daily calorie goal</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums" suppressHydrationWarning>
            {data.profile.calorieGoal.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              kcal
            </span>
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8">
          <div>
            <h1 className="text-balance text-lg font-semibold capitalize sm:text-xl">
              {active === "coach"
                ? "AI Coach"
                : active === "metrics"
                  ? "Body Metrics"
                  : active === "daily"
                    ? "Daily Metrics"
                    : active}
            </h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {greeting()}, {data.profile.name}. Let&apos;s keep the streak going.
            </p>
          </div>
          <SyncButton />
        </header>

        <main className="px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          {!ready ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Loading your data...
            </div>
          ) : (
            <>
              {active === "overview" && (
                <OverviewSection onNavigate={setActive} />
              )}
              {active === "workouts" && <WorkoutsSection />}
              {active === "nutrition" && <NutritionSection />}
              {active === "sleep" && <SleepSection />}
              {active === "daily" && <DailyMetricsSection />}
              {active === "metrics" && <MetricsSection />}
              {active === "coach" && <CoachSection />}
            </>
          )}
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-sidebar/95 px-1 py-1.5 backdrop-blur-md lg:hidden">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}
