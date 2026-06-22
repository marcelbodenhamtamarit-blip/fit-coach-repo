"use client"

import { useState } from "react"
import {
  Activity,
  UtensilsCrossed,
  Settings,
  Dumbbell,
  Wallet,
  Refrigerator,
  RotateCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { OverviewSection } from "@/components/sections/overview-section"
import { NutritionSection } from "@/components/sections/nutrition-section"
import { EconomySection } from "@/components/sections/economy-section"
import { SettingsSection } from "@/components/sections/settings-section"
import { PantrySection } from "@/components/sections/pantry-section"

type Tab = {
  id: string
  label: string
  icon: typeof Activity
}

const TABS: Tab[] = [
  { id: "overview", label: "Resumen", icon: Activity },
  { id: "nutrition", label: "Comida", icon: UtensilsCrossed },
  { id: "pantry", label: "Despensa", icon: Refrigerator },
  { id: "economy", label: "Economía", icon: Wallet },
  { id: "settings", label: "Ajustes", icon: Settings },
]

const TAB_TITLES: Record<string, string> = {
  overview: "Resumen",
  nutrition: "Comida",
  pantry: "Despensa",
  economy: "Economía",
  settings: "Ajustes",
}

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
          <p className="text-xs text-muted-foreground">Objetivo calórico diario</p>
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
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-balance text-lg font-semibold sm:text-xl">
                {TAB_TITLES[active] ?? active}
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                {greeting()}, {data.profile.name}. Sigamos con la racha.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Recargar"
            >
              <RotateCw className="size-4" />
            </button>
          </div>
        </header>

        <main className="px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          {!ready ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Cargando datos...
            </div>
          ) : (
            <>
              {active === "overview" && (
                <OverviewSection onNavigate={setActive} />
              )}
              {active === "nutrition" && <NutritionSection />}
              {active === "pantry" && <PantrySection />}
              {active === "economy" && <EconomySection />}
              {active === "settings" && <SettingsSection />}
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
  if (h < 12) return "Buenos días"
  if (h < 18) return "Buenas tardes"
  return "Buenas noches"
}
