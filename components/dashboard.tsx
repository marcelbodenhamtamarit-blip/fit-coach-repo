"use client"

import { useState, useEffect } from "react"
import {
  Activity,
  Settings,
  Dumbbell,
  Wallet,
  CalendarDays,
  RotateCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { OverviewSection } from "@/components/sections/overview-section"
import { EconomySection } from "@/components/sections/economy-section"
import { SettingsSection } from "@/components/sections/settings-section"
// Diario desactivado (no se usa). Reactivar: descomentar estas 4 lineas marcadas "Diario".
// DIARIO desactivado: import { DiarioSection } from "@/components/sections/diario-section"
import { useAuth } from "@/lib/use-auth"
import { LoginScreen } from "@/components/login-screen"
import { RecurringReviewDialog } from "@/components/recurring-review-dialog"
import { LogOut } from "lucide-react"
import { useDesignPreview } from "@/lib/design-preview"



type Tab = {
  id: string
  label: string
  icon: typeof Activity
}

export function Dashboard() {
  const [active, setActive] = useState("overview")
  // Señal para abrir el formulario de "añadir gasto/ingreso" desde el botón
  // que ahora también vive en Resumen: al pulsarlo navegamos a Economía y
  // subimos este contador, que EconomySection escucha para auto-abrirse.
  const [addSignal, setAddSignal] = useState(0)
  const goAddTransaction = () => {
    setActive("economy")
    setAddSignal((n) => n + 1)
  }
  useEffect(() => {
    const stored = localStorage.getItem("marcel-fit-coach:active-tab")
    if (stored) setActive(stored)
  }, [])
  useEffect(() => {
    localStorage.setItem("marcel-fit-coach:active-tab", active)
  }, [active])
  const { data, ready, t } = useStore()
  const { mode, user, signOut } = useAuth()
  const preview = useDesignPreview()

  const TABS: Tab[] = [
    { id: "overview", label: t("nav.overview"), icon: Activity },
    // DIARIO desactivado:  // Diario: { id: "diario", label: "Diario", icon: CalendarDays },
    { id: "economy", label: t("nav.economy"), icon: Wallet },
    { id: "settings", label: t("nav.settings"), icon: Settings },
  ]

  const TAB_TITLES: Record<string, string> = {
    overview: t("nav.overview"),
    // DIARIO desactivado:  // Diario: diario: "Diario",
    economy: t("nav.economy"),
    settings: t("nav.settings"),
  }

  if (mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    )
  }

  if (mode === "out") {
    return <LoginScreen />
  }

  // Nombre a mostrar en el saludo: antes venía de un profile compartido
  // (siempre "Marcel"), lo que se filtraba a cualquier cuenta nueva. Ahora
  // usamos el propio usuario logueado.
  const displayName =
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    t("dashboard.greetingName.fallback")

  return (
    <div className="relative min-h-screen">
      {/* Fondo fijo (no se mueve al hacer scroll, es un elemento "fixed"
          independiente del contenido). En preview: verde de marca arriba,
          se transforma hacia el gris oscuro habitual de la app hacia la
          mitad de la pantalla — ver lib/design-preview.ts. Fuera de
          preview, degradado sutil de siempre. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background: preview
            ? "linear-gradient(to bottom, oklch(0.85 0.19 135) 0%, oklch(0.78 0.17 138) 8%, oklch(0.55 0.10 150) 24%, oklch(0.30 0.03 220) 40%, oklch(0.16 0.012 250) 56%, oklch(0.16 0.012 250) 100%)"
            : "linear-gradient(to bottom, oklch(0.26 0.02 250) 0%, oklch(0.16 0.012 250) 45%, oklch(0.1 0.01 250) 100%)",
        }}
      />
      <RecurringReviewDialog />

      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Dumbbell className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">ZentOS</p>
            <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
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
      </aside>

      {/* Main */}
      <div className="lg:pl-60">
        <header
          className={cn(
            "sticky top-0 z-20 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8",
            preview ? "bg-white/10" : "border-b border-border bg-background/80",
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-balance text-lg font-semibold sm:text-xl"
                style={preview ? { color: "oklch(0.22 0.05 150)" } : undefined}
              >
                {TAB_TITLES[active] ?? active}
              </h1>
              <p
                className={cn("hidden text-xs sm:block", !preview && "text-muted-foreground")}
                style={preview ? { color: "oklch(0.32 0.05 150 / 80%)" } : undefined}
              >
                {t(greetingKey())}, {displayName}. {t("dashboard.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  preview
                    ? "bg-white/25 hover:bg-white/35"
                    : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                style={preview ? { color: "oklch(0.22 0.05 150)" } : undefined}
                title={t("dashboard.reload")}
              >
                <RotateCw className="size-4" />
              </button>
              <button
                onClick={signOut}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  preview
                    ? "bg-white/25 hover:bg-white/35"
                    : "border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                style={preview ? { color: "oklch(0.22 0.05 150)" } : undefined}
                title={t("dashboard.signOut")}
              >
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
          {!ready ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              {t("common.loadingData")}
            </div>
          ) : (
            <>
              {active === "overview" && (
                <OverviewSection onNavigate={setActive} onAddExpense={goAddTransaction} />
              )}
              {/* DIARIO desactivado: activeTab === "diario" && <DiarioSection /> */}
              {active === "economy" && <EconomySection autoOpenSignal={addSignal} />}
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

function greetingKey(): "dashboard.greeting.morning" | "dashboard.greeting.afternoon" | "dashboard.greeting.evening" {
  const h = new Date().getHours()
  if (h < 12) return "dashboard.greeting.morning"
  if (h < 18) return "dashboard.greeting.afternoon"
  return "dashboard.greeting.evening"
}
