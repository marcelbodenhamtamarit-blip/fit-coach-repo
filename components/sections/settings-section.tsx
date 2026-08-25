"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Check,
  Copy,
  Download,
  RefreshCw,
  Watch,
  SlidersHorizontal,
  LogOut,
  Plane,
  Smartphone,
  Plus,
  CreditCard,
  PlayCircle,
  BellOff,
  Bell,
  Link2,
  CheckCircle2,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { CURRENCIES } from "@/lib/types"
import { useStore } from "@/lib/store"
import { useAuth } from "@/lib/use-auth"
import { isBetaUser } from "@/lib/beta"
import { LANGUAGES, type Language } from "@/lib/i18n"

export function SettingsSection() {
  const { t } = useStore()
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  async function sendFeedback() {
    const trimmed = message.trim()
    if (!trimmed) return
    setSending(true)
    setError("")
    const { error } = await supabase.from("feedback").insert({ message: trimmed })
    setSending(false)
    if (error) {
      setError(t("settings.feedbackError"))
      return
    }
    setMessage("")
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <AccountCard />

      <PreferencesCard />

      <TravelModeCard />

      <QuickAddShortcutCard />

      <Card className="p-6">
        <h3 className="mb-1 text-sm font-semibold">{t("settings.feedback")}</h3>
        <p className="mb-3 text-xs text-muted-foreground">{t("settings.feedbackDesc")}</p>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("settings.feedbackPlaceholder")}
          rows={4}
          className="text-sm"
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        {sent && <p className="mt-2 text-xs text-emerald-500">{t("settings.feedbackSent")}</p>}
        <Button onClick={sendFeedback} disabled={sending || !message.trim()} className="mt-3">
          {sending ? t("settings.sending") : t("settings.send")}
        </Button>
      </Card>

      <p className="pb-2 text-center text-[11px] text-muted-foreground">
        ZentOS · {t("app.tagline")}
      </p>
    </div>
  )
}

// Muestra con qué cuenta está logueada la persona ahora mismo, con un
// pequeño avatar (la inicial del email) para que se sienta como el perfil
// de quien ha entrado, no como un ajuste más suelto. Antes no había forma
// de ver esto en ningún sitio de la app — si te registrabas con un email al
// vuelo, no había manera de recordar cuál era. También sirve de acceso
// rápido para cerrar sesión.
function AccountCard() {
  const { user, signOut } = useAuth()
  const { t } = useStore()
  const email = user?.email ?? "—"
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "?"

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{email}</p>
          <p className="text-xs text-muted-foreground">{t("settings.accountDesc")}</p>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={signOut}
          className="shrink-0 text-muted-foreground"
          aria-label={t("settings.signOut")}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

// Divisa principal e idioma: dos cosas distintas pero de la misma
// naturaleza ("cómo se muestra la app"), así que van juntas en una lista
// dentro de una sola tarjeta en vez de dos tarjetas casi idénticas
// repitiendo icono + título + descripción.
function PreferencesCard() {
  const { data, ready, setHomeCurrency, setLanguage, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const [savedField, setSavedField] = useState<"currency" | "language" | null>(null)

  function flash(field: "currency" | "language") {
    setSavedField(field)
    setTimeout(() => setSavedField((f) => (f === field ? null : f)), 1500)
  }

  function handleCurrencyChange(code: string) {
    setHomeCurrency(code)
    flash("currency")
  }

  function handleLanguageChange(code: string) {
    setLanguage(code)
    flash("language")
  }

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("settings.preferences")}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t("settings.preferencesDesc")}</p>

      <div className="divide-y divide-border rounded-lg border border-border">
        <div className="p-3">
          <p className="text-sm font-medium">{t("settings.homeCurrency")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t("settings.homeCurrencyDesc")}</p>
          <select
            value={data.homeCurrency}
            disabled={!ready}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
          {savedField === "currency" && <p className="mt-1.5 text-[11px] text-emerald-500">{t("settings.saved")}</p>}
        </div>

        <div className="p-3">
          <p className="text-sm font-medium">{t("settings.language")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t("settings.languageDesc")}</p>
          <select
            value={lang}
            disabled={!ready}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          {savedField === "language" && <p className="mt-1.5 text-[11px] text-emerald-500">{t("settings.saved")}</p>}
        </div>
      </div>
    </Card>
  )
}

// Modo viaje: mientras está activo, el formulario de nueva transacción (y
// el de recurrentes) usan travelCurrency como divisa por defecto en vez de
// homeCurrency, para no tener que cambiarla a mano en cada gasto durante un
// viaje. Es un interruptor explícito (no detección automática de ubicación
// ni "recordar la última usada") para que quede claro cuándo está activo y
// se pueda desactivar al volver.
function TravelModeCard() {
  const { data, ready, setTravelMode, t } = useStore()
  const active = data.travelMode
  const currency = data.travelCurrency ?? data.homeCurrency

  function toggle() {
    setTravelMode(!active, currency)
  }

  function handleCurrencyChange(code: string) {
    setTravelMode(true, code)
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Plane className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{t("settings.travelMode")}</h3>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-label={t("settings.travelMode")}
          onClick={toggle}
          disabled={!ready}
          className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            active ? "justify-end bg-primary" : "justify-start bg-muted"
          }`}
        >
          <span className="size-5 rounded-full bg-white shadow" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("settings.travelModeDesc")}</p>

      {active && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("settings.travelCurrency")}</p>
          <select
            value={currency}
            disabled={!ready}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </Card>
  )
}

// Atajo de iOS/Apple Watch: pide cantidad, tipo y categoría a mano (nada
// de leer notificaciones) y manda la petición a /api/quick-transaction.
//
// Nota importante: los archivos .shortcut generados por nuestro servidor
// nunca pueden llevar la firma de Apple que iOS exige desde la versión 15
// para importarlos, así que un botón de "descargar .shortcut" propio
// falla siempre con "La dirección URL del atajo proporcionada no es
// válida". Un enlace de iCloud sí la lleva (Apple lo firma al alojarlo),
// así que en vez de generar el archivo nosotros, compartimos un atajo
// real creado una vez en la app Atajos y distribuido por su enlace de
// iCloud — instalable con un toque para cualquier usuario.
//
// Ese atajo compartido no lleva el token de nadie incrustado: en su
// primera ejecución en cada dispositivo pregunta el código (que cada
// persona copia de su propia tarjeta de abajo) y lo guarda localmente en
// un archivo ZentOSToken.txt dentro de una carpeta "ZentOS" en su iCloud
// Drive. Esa carpeta NO es una carpeta marcada/bookmarked a nuestra cuenta
// (eso fue justo el bug original: una marca fija solo existe en el iCloud
// de quien construyó el atajo, así que revienta para cualquier otra
// persona) — en vez de eso, el atajo busca una carpeta llamada "ZentOS" por
// nombre dentro de iCloud Drive y, si no existe todavía en ese dispositivo,
// la crea una única vez (no se repite en ejecuciones siguientes, porque la
// búsqueda ya la encuentra a partir de la segunda vez). Así un único enlace
// sirve para todo el mundo sin mezclar cuentas. Si alguna vez ese enlace
// deja de funcionar (o alguien prefiere construir su propia copia), las
// instrucciones manuales de abajo siguen siendo válidas como alternativa —
// ahí sí tiene sentido pegar el token fijo, porque esa copia la usa una
// sola persona.
//
// El disparador de "al usar tarjeta" (Apple Pay) es harina de otro costal:
// Apple no permite compartir Automatizaciones Personales por enlace (solo
// se comparten atajos, no automatizaciones) — es una restricción de
// privacidad a propósito, no un descuido, así que cada persona tiene que
// crear ese disparador ella misma, una única vez, en su propio dispositivo.
// Por eso existe el bloque TAP_TO_PAY_STEPS de abajo: una guía visual (con
// iconos en vez de un muro de texto) para que ese único paso de ~30
// segundos se perciba como rápido en vez de como "trabajo".
const SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/8942dbe1aa364ad29198997fa1146015"

const TAP_TO_PAY_STEPS = [
  { icon: Smartphone, titleKey: "settings.tapToPayStep1Title", descKey: "settings.tapToPayStep1" },
  { icon: Plus, titleKey: "settings.tapToPayStep2Title", descKey: "settings.tapToPayStep2" },
  { icon: CreditCard, titleKey: "settings.tapToPayStep3Title", descKey: "settings.tapToPayStep3" },
  { icon: PlayCircle, titleKey: "settings.tapToPayStep4Title", descKey: "settings.tapToPayStep4" },
  { icon: BellOff, titleKey: "settings.tapToPayStep5Title", descKey: "settings.tapToPayStep5" },
] as const

// Disparador "Notificación" de Atajos (iOS 27+): lee el aviso de pago del
// banco/Wallet solo y registra el gasto sin abrir nada en pantalla — el
// paso siguiente natural del Tap-to-Pay de arriba, para quien ya tenga
// acceso a este disparador. Quien siga en iOS 26 o anterior no lo verá en
// la app Atajos todavía; para esas cuentas sigue siendo mejor el atajo de
// Apple Pay de arriba (pide un toque, pero funciona en cualquier versión).
const NOTIFICATION_AUTO_STEPS = [
  { icon: Smartphone, titleKey: "settings.notifAutoStep1Title", descKey: "settings.notifAutoStep1" },
  { icon: Bell, titleKey: "settings.notifAutoStep2Title", descKey: "settings.notifAutoStep2" },
  { icon: Link2, titleKey: "settings.notifAutoStep3Title", descKey: "settings.notifAutoStep3" },
  { icon: BellOff, titleKey: "settings.notifAutoStep4Title", descKey: "settings.notifAutoStep4" },
  { icon: CheckCircle2, titleKey: "settings.notifAutoStep5Title", descKey: "settings.notifAutoStep5" },
] as const

// Formato relativo simple ("hace 5 min", "hace 3 h", "hace 2 días") para el
// aviso de "último uso" — no hace falta más precisión que esa para que
// alguien note un uso raro de su código.
function formatRelativeTime(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (diffMin < 1) return rtf.format(0, "minute")
  if (diffMin < 60) return rtf.format(-diffMin, "minute")
  const diffHours = Math.round(diffMin / 60)
  if (diffHours < 24) return rtf.format(-diffHours, "hour")
  const diffDays = Math.round(diffHours / 24)
  return rtf.format(-diffDays, "day")
}

function QuickAddShortcutCard() {
  const { t, data } = useStore()
  const lang = (data.language as string) ?? "es"
  const { user } = useAuth()
  // Guía de detección automática al pagar: en pruebas, ver lib/beta.ts.
  const notifAutoBetaEnabled = isBetaUser(user?.email)
  const [token, setToken] = useState<string | null>(null)
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedField, setCopiedField] = useState<"token" | "url" | "notifUrl" | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [origin, setOrigin] = useState("")
  const [showManual, setShowManual] = useState(false)
  const [showTapToPay, setShowTapToPay] = useState(false)
  const [showNotificationAuto, setShowNotificationAuto] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadOrCreateToken() {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) return

      const { data } = await supabase
        .from("quick_add_tokens")
        .select("token, last_used_at")
        .eq("user_id", userId)
        .maybeSingle()

      if (cancelled) return

      if (data?.token) {
        setToken(data.token)
        setLastUsedAt(data.last_used_at ?? null)
        setLoading(false)
        return
      }

      const { data: inserted } = await supabase
        .from("quick_add_tokens")
        .insert({ user_id: userId })
        .select("token, last_used_at")
        .single()

      if (!cancelled) {
        if (inserted?.token) setToken(inserted.token)
        setLastUsedAt(inserted?.last_used_at ?? null)
        setLoading(false)
      }
    }

    loadOrCreateToken()
    return () => {
      cancelled = true
    }
  }, [])

  async function regenerateToken() {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    setRegenerating(true)
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    const newToken = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    // last_used_at se resetea a mano: es un código nuevo, así que el
    // "último uso" del anterior ya no pinta nada aquí.
    const { data } = await supabase
      .from("quick_add_tokens")
      .update({ token: newToken, last_used_at: null })
      .eq("user_id", userId)
      .select("token, last_used_at")
      .single()

    setRegenerating(false)
    if (data?.token) {
      setToken(data.token)
      setLastUsedAt(data.last_used_at ?? null)
    }
  }

  function copy(value: string, field: "token" | "url" | "notifUrl") {
    navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  // Antes esta tarjeta mostraba /api/quick-transaction (para pegar en
  // "Obtener contenido de URL" con varios parámetros de consulta a mano).
  // Ahora el atajo solo tiene que abrir esta página con el token pegado al
  // final — ella sola pide la cantidad/categoría con una pantalla propia
  // de ZentOS en vez de encadenar varios popups nativos de Atajos.
  const apiUrl = origin ? `${origin}/quick-confirm` : ""

  // Para el disparador "Notificación" de Atajos (iOS 27+): el atajo llama
  // directo a la API con GET, pasando el texto de la notificación como
  // título/subtítulo/cuerpo — nada de abrir /quick-confirm, así que no hay
  // pantalla que confirmar a mano. /api/quick-transaction ya sabe extraer
  // el importe de ese texto con una expresión regular (ver el código) y,
  // si lo consigue, manda una notificación push de confirmación sola.
  const notifAutoUrl = origin
    ? `${origin}/api/quick-transaction?token=TU_CODIGO&title=[Título]&subtitle=[Subtítulo]&body=[Cuerpo]`
    : ""

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Watch className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("settings.shortcutTitle")}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t("settings.shortcutDesc")}</p>

      {loading ? (
        <p className="text-xs text-muted-foreground">{t("settings.preparing")}</p>
      ) : (
               <div className="space-y-4">
          <a href={SHORTCUT_ICLOUD_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "default", className: "w-full sm:w-auto" })}>
            <Download className="size-4" />
            {t("settings.installShortcut")}
          </a>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("settings.apiUrl")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                  {apiUrl}
                </code>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => copy(apiUrl, "url")}
                  aria-label={t("settings.copyUrl")}
                >
                  {copiedField === "url" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("settings.yourCode")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                  {token}
                </code>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => token && copy(token, "token")}
                  aria-label={t("settings.copyCode")}
                >
                  {copiedField === "token" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={regenerateToken}
                  disabled={regenerating}
                  aria-label={t("settings.regenCode")}
                >
                  <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("settings.regenHint")}</p>
          <p className="text-[11px] text-muted-foreground">
            {lastUsedAt ? t("settings.lastUsed", { when: formatRelativeTime(lastUsedAt, lang) }) : t("settings.lastUsedNever")}
          </p>

          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            {showManual ? t("settings.hideManual") : t("settings.showManual")}
          </button>

          {showManual && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">{t("settings.manualTitle")}</p>
            <ol className="list-decimal space-y-2 pl-4">
              <li>{t("settings.manualStep1")}</li>
              <li>{t("settings.manualStep2", { url: apiUrl })}</li>
            </ol>
            <p className="mt-3 font-medium text-foreground">{t("settings.watchTitle")}</p>
            <p className="mt-1">{t("settings.watchDesc")}</p>
          </div>
          )}

          <button
            type="button"
            onClick={() => setShowTapToPay((v) => !v)}
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            {showTapToPay ? t("settings.hideTapToPay") : t("settings.showTapToPay")}
          </button>

          {showTapToPay && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">{t("settings.tapToPayTitle")}</p>
            <p className="mb-4">{t("settings.tapToPayNote")}</p>
            <div>
              {TAP_TO_PAY_STEPS.map((step, i) => (
                <div key={step.titleKey} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <step.icon className="size-4" />
                    </div>
                    {i < TAP_TO_PAY_STEPS.length - 1 && <div className="my-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className={i < TAP_TO_PAY_STEPS.length - 1 ? "pb-4" : ""}>
                    <p className="text-xs font-semibold text-foreground">{t(step.titleKey)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t(step.descKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {notifAutoBetaEnabled && (
          <button
            type="button"
            onClick={() => setShowNotificationAuto((v) => !v)}
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            {showNotificationAuto ? t("settings.hideNotifAuto") : t("settings.showNotifAuto")}
          </button>
          )}

          {notifAutoBetaEnabled && showNotificationAuto && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">{t("settings.notifAutoTitle")}</p>
            <p className="mb-4">{t("settings.notifAutoNote")}</p>
            <div>
              {NOTIFICATION_AUTO_STEPS.map((step, i) => (
                <div key={step.titleKey} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <step.icon className="size-4" />
                    </div>
                    {i < NOTIFICATION_AUTO_STEPS.length - 1 && <div className="my-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className={i < NOTIFICATION_AUTO_STEPS.length - 1 ? "pb-4" : ""}>
                    <p className="text-xs font-semibold text-foreground">{t(step.titleKey)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {step.titleKey === "settings.notifAutoStep3Title" ? (
                        <>
                          {t(step.descKey)}
                          <span className="mt-2 flex items-center gap-2">
                            <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-[10px]">
                              {notifAutoUrl}
                            </code>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              onClick={() => copy(notifAutoUrl, "notifUrl")}
                              aria-label={t("settings.copyUrl")}
                            >
                              {copiedField === "notifUrl" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            </Button>
                          </span>
                        </>
                      ) : (
                        t(step.descKey)
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-md bg-amber-500/10 p-2.5 text-[11px] text-amber-500">
              {t("settings.notifAutoOlderIos")}
            </p>
          </div>
          )}
        </div>
      )}
    </Card>
  )
}
