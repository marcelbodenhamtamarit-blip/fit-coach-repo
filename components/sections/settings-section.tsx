"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Check, Copy, Download, RefreshCw, Watch, Coins, Languages } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { TRANSACTION_CATEGORIES, CURRENCIES } from "@/lib/types"
import { useStore } from "@/lib/store"
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
      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold">{t("settings.about")}</h3>
        <p className="text-xs text-muted-foreground">ZentOS · {t("app.tagline")}</p>
      </Card>

      <HomeCurrencyCard />

      <LanguageCard />

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
    </div>
  )
}

// Divisa principal: en la que se suman y muestran todos los totales. Las
// transacciones se pueden registrar en cualquier otra divisa (útil de
// viaje) y se convierten automáticamente a esta al guardarlas.
function HomeCurrencyCard() {
  const { data, ready, setHomeCurrency, t } = useStore()
  const [saved, setSaved] = useState(false)

  function handleChange(code: string) {
    setHomeCurrency(code)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Coins className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("settings.homeCurrency")}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t("settings.homeCurrencyDesc")}</p>
      <select
        value={data.homeCurrency}
        disabled={!ready}
        onChange={(e) => handleChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} · {c.name}
          </option>
        ))}
      </select>
      {saved && <p className="mt-1.5 text-[11px] text-emerald-500">{t("settings.saved")}</p>}
    </Card>
  )
}

// Idioma de la app: se guarda por cuenta en user_preferences (igual que la
// divisa principal), así que sigue a la persona entre dispositivos.
function LanguageCard() {
  const { data, ready, setLanguage, t } = useStore()
  const [saved, setSaved] = useState(false)
  const lang = (data.language as Language) ?? "es"

  function handleChange(code: string) {
    setLanguage(code)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Languages className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">{t("settings.language")}</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{t("settings.languageDesc")}</p>
      <select
        value={lang}
        disabled={!ready}
        onChange={(e) => handleChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </select>
      {saved && <p className="mt-1.5 text-[11px] text-emerald-500">{t("settings.saved")}</p>}
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
// un archivo dentro de su iCloud Drive (compatible con iOS 26 y 27, a
// diferencia de "Almacenar contenido", que solo existe en iOS 27), así
// que un único enlace sirve para todo el mundo sin mezclar cuentas. Si alguna
// vez ese enlace deja de funcionar (o alguien prefiere construir su
// propia copia), las instrucciones manuales de abajo siguen siendo
// válidas como alternativa — ahí sí tiene sentido pegar el token fijo,
// porque esa copia la usa una sola persona.
const SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/c96f56de92fe4e27858c41358fd93489"

function QuickAddShortcutCard() {
  const { data, t } = useStore()
  const lang = (data.language as Language) ?? "es"
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedField, setCopiedField] = useState<"token" | "url" | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [origin, setOrigin] = useState("")
  const [showManual, setShowManual] = useState(false)

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
        .select("token")
        .eq("user_id", userId)
        .maybeSingle()

      if (cancelled) return

      if (data?.token) {
        setToken(data.token)
        setLoading(false)
        return
      }

      const { data: inserted } = await supabase
        .from("quick_add_tokens")
        .insert({ user_id: userId })
        .select("token")
        .single()

      if (!cancelled) {
        if (inserted?.token) setToken(inserted.token)
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

    const { data } = await supabase
      .from("quick_add_tokens")
      .update({ token: newToken })
      .eq("user_id", userId)
      .select("token")
      .single()

    setRegenerating(false)
    if (data?.token) setToken(data.token)
  }

  function copy(value: string, field: "token" | "url") {
    navigator.clipboard.writeText(value)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  const apiUrl = origin ? `${origin}/api/quick-transaction` : ""
  // Las opciones de categoría del atajo mandan siempre el nombre en
  // español (es el valor que compara la API), incluso con la app en
  // inglés — por eso aquí no se usa categoryLabel().
  const categoriesList = TRANSACTION_CATEGORIES.join(", ")

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
          <a
            href={SHORTCUT_ICLOUD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "default", className: "w-full sm:w-auto" })}
          >
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
              <li>{t("settings.manualStep2")}</li>
              <li>{t("settings.manualStep3")}</li>
              <li>
                {t("settings.manualStep4", {
                  count: TRANSACTION_CATEGORIES.length,
                  categories: categoriesList,
                })}
              </li>
              <li>{t("settings.manualStep5")}</li>
              <li>{t("settings.manualStep6")}</li>
            </ol>
            <p className="mt-3 font-medium text-foreground">{t("settings.watchTitle")}</p>
            <p className="mt-1">{t("settings.watchDesc")}</p>
          </div>
          )}
        </div>
      )}
    </Card>
  )
}
