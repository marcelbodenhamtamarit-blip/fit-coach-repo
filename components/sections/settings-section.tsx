"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Check,
  Copy,
  Download,
  RefreshCw,
  Watch,
  SlidersHorizontal,
  Plane,
  Smartphone,
  Bell,
  BellOff,
  Link2,
  CheckCircle2,
  ChevronDown,
  Zap,
  MessageSquare,
  Banknote,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { CURRENCIES, SHIFT_RATE_MULTIPLIER, currencySymbol } from "@/lib/types"
import { useStore } from "@/lib/store"
import { useAuth } from "@/lib/use-auth"
import { LANGUAGES, weekdayLabel, type Language } from "@/lib/i18n"
import { RemindersCard } from "@/components/sections/automations-section"

export function SettingsSection() {
  const { t } = useStore()

  return (
    <div className="max-w-2xl space-y-3">
      <AccountCard />

      <TravelModeCard />

      <CollapsibleCard
        icon={SlidersHorizontal}
        title={t("settings.preferences")}
        description={t("settings.preferencesDesc")}
        color="#60a5fa"
      >
        <PreferencesCard />
      </CollapsibleCard>

      <CollapsibleCard
        icon={Zap}
        title={t("settings.remindersTitle")}
        description={t("automations.subtitle")}
        color="#fbbf24"
      >
        <RemindersCard />
      </CollapsibleCard>

      <CollapsibleCard
        icon={Banknote}
        title={t("settings.turnosTitle")}
        description={t("settings.turnosDesc")}
        color="#fb923c"
      >
        <TurnosSettingsCard />
      </CollapsibleCard>

      <CollapsibleCard
        icon={Watch}
        title={t("settings.shortcutTitle")}
        description={t("settings.shortcutDesc")}
        color="#a78bfa"
      >
        <QuickAddShortcutCard />
      </CollapsibleCard>

      <CollapsibleCard
        icon={MessageSquare}
        title={t("settings.feedback")}
        description={t("settings.feedbackDesc")}
        color="#34d399"
      >
        <FeedbackCard />
      </CollapsibleCard>

      <p className="pb-2 pt-1 text-center text-[11px] text-muted-foreground">
        ZentOS · {t("app.tagline")}
      </p>
    </div>
  )
}

// Apartado desplegable genérico de Ajustes: un título con icono (siempre
// visible, para saber qué hay dentro sin tener que abrirlo) que al tocarlo
// muestra/oculta su contenido. Casi todo Ajustes se construye encadenando
// varios de estos — la única excepción es AccountCard, que se deja siempre
// visible por ser corta y por servir de identificación de la cuenta activa,
// no un ajuste que haya que "abrir".
function CollapsibleCard({
  icon: Icon,
  title,
  description,
  color = "#7c6fff",
  defaultOpen = false,
  children,
}: {
  icon: typeof SlidersHorizontal
  title: string
  description?: string
  color?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/30"
      >
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: color + "26", color }}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>}
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </Card>
  )
}

// Caja de feedback: vive en su propio componente (igual que el resto de
// tarjetas de Ajustes) para llevar su propio estado, en vez de vivir suelta
// dentro de SettingsSection como antes.
function FeedbackCard() {
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
    <div>
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
  const { user } = useAuth()
  const { t } = useStore()
  const email = user?.email ?? "—"
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : "?"

  return (
    <div className="px-1 py-2">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{email}</p>
          <p className="text-xs text-muted-foreground">{t("settings.accountDesc")}</p>
        </div>
      </div>
    </div>
  )
}

// Divisa principal e idioma: dos cosas distintas pero de la misma
// naturaleza ("cómo se muestra la app"), así que van juntas en una lista
// dentro de una sola tarjeta en vez de dos tarjetas casi idénticas
// repitiendo icono + título + descripción.
function PreferencesCard() {
  const { data, ready, setHomeCurrency, setLanguage, setWeekStartDay, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const weekStartDay = data.weekStartDay ?? 0
  const [savedField, setSavedField] = useState<"currency" | "language" | "weekStartDay" | null>(null)

  function flash(field: "currency" | "language" | "weekStartDay") {
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

  function handleWeekStartDayChange(day: number) {
    setWeekStartDay(day)
    flash("weekStartDay")
  }

  return (
    <div>
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

        <div className="p-3">
          <p className="text-sm font-medium">{t("settings.weekStartDay")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{t("settings.weekStartDayDesc")}</p>
          <select
            value={weekStartDay}
            disabled={!ready}
            onChange={(e) => handleWeekStartDayChange(Number(e.target.value))}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <option key={d} value={d}>
                {weekdayLabel(d, lang)}
              </option>
            ))}
          </select>
          {savedField === "weekStartDay" && <p className="mt-1.5 text-[11px] text-emerald-500">{t("settings.saved")}</p>}
        </div>
      </div>
    </div>
  )
}

// Tarifa por hora (turno normal) e impuestos estimados para Turnos. La
// tarifa de sábado/domingo no se pide aparte: se muestra ya calculada
// (SHIFT_RATE_MULTIPLIER, x1.5/x2) para que quede claro de dónde sale, pero
// solo hay un número que editar si cambia el sueldo. El % de impuestos no
// tiene un valor exacto único para todo el mundo (depende de si trabajas
// con visa Work and Holiday o Student, y de tu residencia fiscal real ante
// la ATO) — por eso se explica en el aviso de abajo en vez de calcularse
// solo por tipo de visa.
function TurnosSettingsCard() {
  const { data, ready, setShiftHourlyRate, setShiftTaxPct, t } = useStore()
  const symbol = currencySymbol(data.homeCurrency)
  const [rateInput, setRateInput] = useState(String(data.shiftHourlyRate ?? 34.6))
  const [taxInput, setTaxInput] = useState(String(data.shiftTaxPct ?? 15))
  const [savedField, setSavedField] = useState<"rate" | "tax" | null>(null)

  function flash(field: "rate" | "tax") {
    setSavedField(field)
    setTimeout(() => setSavedField((f) => (f === field ? null : f)), 1500)
  }

  function saveRate() {
    const parsed = parseFloat(rateInput)
    if (isNaN(parsed) || parsed <= 0) return
    setShiftHourlyRate(parsed)
    flash("rate")
  }

  function saveTax() {
    const parsed = parseFloat(taxInput)
    if (isNaN(parsed) || parsed < 0) return
    setShiftTaxPct(parsed)
    flash("tax")
  }

  const rate = parseFloat(rateInput) || 0

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium">{t("settings.turnosHourlyRate")}</p>
        <p className="mb-2 text-xs text-muted-foreground">{t("settings.turnosHourlyRateDesc")}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={rateInput}
            disabled={!ready}
            onChange={(e) => setRateInput(e.target.value)}
            onBlur={saveRate}
            className="max-w-32"
          />
          <Button size="sm" variant="outline" onClick={saveRate} disabled={!ready}>
            {t("common.save")}
          </Button>
        </div>
        {savedField === "rate" && <p className="mt-1.5 text-[11px] text-emerald-500">{t("settings.saved")}</p>}

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-muted-foreground">{t("settings.turnosSaturdayRate")}</p>
            <p className="font-semibold tabular-nums">
              {symbol}
              {(rate * SHIFT_RATE_MULTIPLIER.sabado).toFixed(2)}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-muted-foreground">{t("settings.turnosSundayRate")}</p>
            <p className="font-semibold tabular-nums">
              {symbol}
              {(rate * SHIFT_RATE_MULTIPLIER.domingo).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium">{t("settings.turnosTaxPct")}</p>
        <p className="mb-2 text-xs text-muted-foreground">{t("settings.turnosTaxPctDesc")}</p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.5"
            min="0"
            value={taxInput}
            disabled={!ready}
            onChange={(e) => setTaxInput(e.target.value)}
            onBlur={saveTax}
            className="max-w-32"
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Button size="sm" variant="outline" onClick={saveTax} disabled={!ready}>
            {t("common.save")}
          </Button>
        </div>
        {savedField === "tax" && <p className="mt-1.5 text-[11px] text-emerald-500">{t("settings.saved")}</p>}
      </div>
    </div>
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
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#2dd4bf26", color: "#2dd4bf" }}
        >
          <Plane className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t("settings.travelMode")}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {active ? t("settings.travelModeOn") : t("settings.travelModeOff")}
          </p>
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

      {active && (
        <div className="mt-4 border-t border-border pt-4">
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
// El disparador automático que de verdad se usa (ver NOTIFICATION_AUTO_STEPS
// más abajo) es una Automatización Personal aparte, por notificación del
// banco/Wallet — Apple no permite compartir ese tipo de automatización por
// enlace (solo atajos sueltos), así que se monta a mano, una vez, siguiendo
// esa guía. Las versiones anteriores de esto (disparador "al tocar la
// tarjeta" con Apple Pay, en blanco, pre-rellenado, o con "Si" + IA) se
// quitaron el 29 sep 2026: al ser una app de un solo usuario y no depender
// de que Apple Pay entregue el importe a tiempo, el camino por notificación
// es el único que hace falta documentar aquí.
//
// Antes había dos copias del mismo Shortcut (una en español, otra en
// inglés — solo cambiaba el nombre/descripción que Atajos muestra en la
// pantalla de "Obtener atajo" antes de instalarlo), pensadas para que
// alguien no hispanohablante pudiera instalar la suya sin verse un atajo en
// español. Solo tiene sentido si de verdad hay más gente que tú usando
// ZentOS — al ser solo para ti, se quitó la copia en inglés y el botón de
// abajo usa siempre esta.
const SHORTCUT_ICLOUD_URL_ES = "https://www.icloud.com/shortcuts/8942dbe1aa364ad29198997fa1146015"

// Disparador "Notificación" de Atajos (iOS 27+): lee el aviso de pago del
// banco/Wallet solo y registra el gasto sin abrir nada en pantalla — el
// único camino de automatización que se documenta aquí (ver el comentario
// largo junto a SHORTCUT_ICLOUD_URL_ES arriba). No necesita ninguna tarjeta
// añadida a Apple Pay/Wallet, solo que el banco mande notificaciones.
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
  const [token, setToken] = useState<string | null>(null)
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedField, setCopiedField] = useState<"token" | "url" | "notifUrl" | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [origin, setOrigin] = useState("")
  const [showManual, setShowManual] = useState(false)
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
    <div>
      {loading ? (
        <p className="text-xs text-muted-foreground">{t("settings.preparing")}</p>
      ) : (
        <div className="space-y-4">
          <a href={SHORTCUT_ICLOUD_URL_ES} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "default", className: "w-full sm:w-auto" })}>
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
            onClick={() => setShowNotificationAuto((v) => !v)}
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            {showNotificationAuto ? t("settings.hideNotifAuto") : t("settings.showNotifAuto")}
          </button>

          {showNotificationAuto && (
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
          </div>
          )}
        </div>
      )}
    </div>
  )
}
