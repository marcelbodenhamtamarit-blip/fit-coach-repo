"use client"

import { useState, useEffect } from "react"
import {
  Activity,
  Settings,
  Dumbbell,
  Wallet,
  RotateCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { OverviewSection } from "@/components/sections/overview-section"
import { EconomySection } from "@/components/sections/economy-section"
import { SettingsSection } from "@/components/sections/settings-section"
import { useAuth } from "@/lib/use-auth"
import { LoginScreen } from "@/components/login-screen"
import { RecurringReviewDialog } from "@/components/recurring-review-dialog"
import { AutomationPopup } from "@/components/automation-popup"
import { LogOut } from "lucide-react"
import { isPushSupported, getNotificationPermission, subscribeToPush, needsHomeScreenInstall } from "@/lib/push"

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
  const { ready, t } = useStore()
  const { mode, user, signOut } = useAuth()

  // Fondo con degradado: en vez de "background-attachment: fixed" (poco
  // fiable en iOS Safari — muchas versiones lo ignoran y lo tratan como si
  // hiciera scroll normal) o un div "position: fixed" con z-index negativo
  // detrás del contenido (en iOS a veces no se pinta bien y solo aparece
  // durante el rebote del "tirar para recargar"), aquí toda la app vive
  // dentro de una caja "position: fixed" que cubre la pantalla (html/body
  // dejan de hacer scroll), con el degradado como capa de fondo y el
  // contenido en una capa hija que scrollea por dentro. Así el color de
  // fondo nunca depende de repintados raros del navegador: sencillamente no
  // se mueve nunca de sitio.
  // Verde más oscuro/intenso (antes empezaba en un verde lima muy claro):
  // ahora arranca en un verde bosque y se mantiene más rato antes de pasar
  // al degradado neutro oscuro de abajo.
  const BACKGROUND_GRADIENT =
    "linear-gradient(to bottom, oklch(0.68 0.17 145) 0%, oklch(0.56 0.15 148) 10%, oklch(0.40 0.10 152) 28%, oklch(0.26 0.05 190) 44%, oklch(0.16 0.012 250) 60%, oklch(0.16 0.012 250) 100%)"

  const TABS: Tab[] = [
    { id: "overview", label: t("nav.overview"), icon: Activity },
    { id: "economy", label: t("nav.economy"), icon: Wallet },
    { id: "settings", label: t("nav.settings"), icon: Settings },
  ]

  const TAB_TITLES: Record<string, string> = {
    overview: t("nav.overview"),
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

  const shellContent = (
    <>
      <AutoEnablePush />
      <RecurringReviewDialog />
      <AutomationPopup />

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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.98]",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {tab.label}
                <span
                  className={cn(
                    "ml-auto size-1.5 rounded-full bg-primary transition-all duration-200",
                    isActive ? "scale-100 opacity-100" : "scale-0 opacity-0",
                  )}
                />
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 bg-white/10 px-4 py-3.5 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-balance text-lg font-semibold sm:text-xl" style={{ color: "oklch(0.22 0.05 150)" }}>
                {TAB_TITLES[active] ?? active}
              </h1>
              <p className="hidden text-xs sm:block" style={{ color: "oklch(0.32 0.05 150 / 80%)" }}>
                {t(greetingKey())}, {displayName}. {t("dashboard.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex size-8 items-center justify-center rounded-lg bg-white/25 transition-colors hover:bg-white/35"
                style={{ color: "oklch(0.22 0.05 150)" }}
                title={t("dashboard.reload")}
              >
                <RotateCw className="size-4" />
              </button>
              <button
                onClick={signOut}
                className="flex size-8 items-center justify-center rounded-lg bg-white/25 transition-colors hover:bg-white/35"
                style={{ color: "oklch(0.22 0.05 150)" }}
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
            // key={active}: al cambiar de pestaña React desmonta y vuelve a
            // montar este div, lo que reinicia la animación de entrada
            // (tw-animate-css) cada vez — un fundido + deslizamiento sutil en
            // vez de un cambio seco.
            <div key={active} className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
              {active === "overview" && (
                <OverviewSection onNavigate={setActive} onAddExpense={goAddTransaction} />
              )}
              {active === "economy" && <EconomySection autoOpenSignal={addSignal} />}
              {active === "settings" && <SettingsSection />}
            </div>
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
                "flex flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[10px] font-medium transition-all duration-200 active:scale-95",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {tab.label}
            </button>
          )
        })}
      </nav>
    </>
  )

  return (
    <div className="fixed inset-0 overflow-hidden">
      <div aria-hidden className="absolute inset-0" style={{ background: BACKGROUND_GRADIENT }} />
      <div className="absolute inset-0 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {shellContent}
      </div>
    </div>
  )
}

// Antes las notificaciones push eran 100% opt-in: había que entrar en
// Ajustes > Recordatorios y darle a "Activar notificaciones" a mano, y casi
// nadie llegaba hasta ahí. Ahora se intenta activarlas solas, nada más
// entrar con sesión iniciada — así todo el mundo las recibe sin tener que
// buscarlas.
//
// En vez de guardar una marca propia en localStorage para saber si "ya se
// intentó" (lo que se probó primero y tenía un fallo: la marca se quedaba
// puesta en el primer montaje SIN comprobar antes si de verdad se había
// podido preguntar algo — así que una sola visita en un contexto donde
// push no estaba disponible, p.ej. abrir la web en Safari normal en vez de
// la PWA instalada, dejaba la marca puesta para siempre y la app nunca
// volvía a intentarlo, ni siquiera abriéndola después desde el icono de la
// PWA), usamos directamente el propio permiso del navegador como memoria:
//   - "default" = nunca se ha preguntado -> es el único caso en el que
//     merece la pena intentarlo.
//   - "granted" o "denied" = ya se preguntó alguna vez (por aquí o por el
//     botón manual de Ajustes > Recordatorios) y el navegador se acuerda
//     para siempre — no hay forma de volver a "default" desde JS, así que
//     no hace falta (ni serviría de nada) reintentarlo.
//   - Si alguien desactiva las notificaciones a mano desde Ajustes, eso
//     borra la suscripción guardada pero el permiso del navegador se queda
//     en "granted" — por eso ese botón (ahora dice "Desactivar") sigue
//     siendo la forma de apagarlas, esto no las vuelve a encender solo.
//   - Si el navegador no soporta push (p.ej. Safari fuera de una PWA
//     instalada) o falta la clave VAPID, tampoco se intenta nada — y como
//     no dejamos ninguna marca puesta, en cuanto la persona la abra desde
//     un contexto donde sí esté disponible, se prueba entonces.
function AutoEnablePush() {
  useEffect(() => {
    if (typeof window === "undefined") return

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey || !isPushSupported()) return
    if (getNotificationPermission() !== "default") return
    // En iPhone abierto desde Safari (no desde el icono de la pantalla de
    // inicio), pedir permiso aquí no muestra ningún aviso y se queda
    // colgado en "default" para siempre — mejor no gastarlo en silencio y
    // dejar que la tarjeta de Ajustes explique qué hacer cuando la persona
    // entre ahí (ver needsHomeScreenInstall en automations-section.tsx).
    if (needsHomeScreenInstall()) return

    // Pequeño respiro antes de lanzar el aviso nativo del sistema, para que
    // no compita con el popup de revisión de recurrentes (que también
    // puede aparecer justo al entrar) ni se sienta como un muro nada más
    // abrir la app.
    const timer = setTimeout(() => {
      subscribeToPush(vapidKey)
    }, 1500)
    return () => clearTimeout(timer)
  }, [])

  return null
}

function greetingKey(): "dashboard.greeting.morning" | "dashboard.greeting.afternoon" | "dashboard.greeting.evening" {
  const h = new Date().getHours()
  if (h < 12) return "dashboard.greeting.morning"
  if (h < 18) return "dashboard.greeting.afternoon"
  return "dashboard.greeting.evening"
}
