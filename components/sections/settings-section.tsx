"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Check, Copy, Download, RefreshCw, Watch, Coins } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { TRANSACTION_CATEGORIES, CURRENCIES } from "@/lib/types"
import { useStore } from "@/lib/store"

export function SettingsSection() {
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
      setError("No se pudo enviar. Inténtalo de nuevo en un momento.")
      return
    }
    setMessage("")
    setSent(true)
    setTimeout(() => setSent(false), 4000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold">Sobre esta app</h3>
        <p className="text-xs text-muted-foreground">ZentOS · Tu economía, a tu manera</p>
      </Card>

      <HomeCurrencyCard />

      <QuickAddShortcutCard />

      <Card className="p-6">
        <h3 className="mb-1 text-sm font-semibold">Enviar feedback</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          ¿Algo que arreglar, una idea o un problema? Escríbelo aquí y me llega directo.
        </p>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe tu mensaje..."
          rows={4}
          className="text-sm"
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        {sent && <p className="mt-2 text-xs text-emerald-500">¡Enviado! Gracias por avisar.</p>}
        <Button onClick={sendFeedback} disabled={sending || !message.trim()} className="mt-3">
          {sending ? "Enviando..." : "Enviar"}
        </Button>
      </Card>
    </div>
  )
}

// Divisa principal: en la que se suman y muestran todos los totales. Las
// transacciones se pueden registrar en cualquier otra divisa (útil de
// viaje) y se convierten automáticamente a esta al guardarlas.
function HomeCurrencyCard() {
  const { data, ready, setHomeCurrency } = useStore()
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
        <h3 className="text-sm font-semibold">Divisa principal</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Todos tus totales y resúmenes se muestran en esta divisa. Si registras un gasto en otra (por ejemplo,
        de viaje), se convierte automáticamente a esta usando el tipo de cambio del día.
      </p>
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
      {saved && <p className="mt-1.5 text-[11px] text-emerald-500">Guardado.</p>}
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

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Watch className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Atajo rápido (iPhone / Apple Watch)</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Un Shortcut de Apple que pide la cantidad, el tipo y la categoría a mano y los guarda directo en tu
        cuenta. Instálalo con un toque — la primera vez te pedirá tu código personal (lo tienes debajo) y lo
        recordará para siempre en este dispositivo.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Preparando tus datos...</p>
      ) : (
        <div className="space-y-4">
          <a
            href={SHORTCUT_ICLOUD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "default", className: "w-full sm:w-auto" })}
          >
            <Download className="size-4" />
            Instalar atajo (un toque)
          </a>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">URL de la API</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                  {apiUrl}
                </code>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => copy(apiUrl, "url")}
                  aria-label="Copiar URL"
                >
                  {copiedField === "url" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tu código personal</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                  {token}
                </code>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => token && copy(token, "token")}
                  aria-label="Copiar código"
                >
                  {copiedField === "token" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={regenerateToken}
                  disabled={regenerating}
                  aria-label="Regenerar código"
                >
                  <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Al instalarlo te pedirá pegar el código de arriba, solo la primera vez. Si crees que alguien más
            tiene tu código, regenéralo aquí — tendrás que abrir el atajo en la app Atajos, borrar el código
            guardado dentro (o reinstalarlo) y pegar el nuevo para que vuelva a funcionar en tu dispositivo.
          </p>

          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="text-xs font-medium text-primary underline underline-offset-2"
          >
            {showManual
              ? "Ocultar instrucciones manuales"
              : "¿Prefieres construirlo tú mismo (o el enlace no funciona)? Instrucciones manuales"}
          </button>

          {showManual && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">Cómo crearlo a mano en la app Atajos:</p>
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Abre <span className="text-foreground">Atajos</span> → toca <span className="text-foreground">+</span> para
                crear uno nuevo. Ponle de nombre &quot;ZentOS&quot;.
              </li>
              <li>
                Añade la acción <span className="text-foreground">Preguntar</span> (busca &quot;preguntar&quot; o
                &quot;ask&quot;): tipo <span className="text-foreground">Número</span>, pregunta{" "}
                <span className="text-foreground">&quot;¿Cuánto? (AUD)&quot;</span>.
              </li>
              <li>
                Añade <span className="text-foreground">Elegir de un menú</span> (&quot;choose from menu&quot;): pregunta{" "}
                <span className="text-foreground">&quot;¿Gasto o ingreso?&quot;</span>, con opciones{" "}
                <span className="text-foreground">Gasto</span> e <span className="text-foreground">Ingreso</span>. Dentro
                de cada opción añade la acción <span className="text-foreground">Texto</span> con &quot;gasto&quot; o
                &quot;ingreso&quot; (en minúscula) respectivamente.
              </li>
              <li>
                Añade otro <span className="text-foreground">Elegir de un menú</span>: pregunta{" "}
                <span className="text-foreground">&quot;Categoría&quot;</span>, con estas {TRANSACTION_CATEGORIES.length}{" "}
                opciones: {TRANSACTION_CATEGORIES.join(", ")}. Dentro de cada opción, un{" "}
                <span className="text-foreground">Texto</span> con ese mismo nombre.
              </li>
              <li>
                Añade <span className="text-foreground">Obtener contenido de URL</span>: método{" "}
                <span className="text-foreground">GET</span>, URL = la de arriba (pégala). Toca{" "}
                <span className="text-foreground">Mostrar más</span> → añade estos parámetros de consulta:{" "}
                <span className="text-foreground">token</span> (pega tu código), <span className="text-foreground">amount</span> (variable
                del paso 2), <span className="text-foreground">type</span> (resultado del menú del paso 3) y{" "}
                <span className="text-foreground">category</span> (resultado del menú del paso 4).
              </li>
              <li>
                Añade <span className="text-foreground">Mostrar notificación</span>: título &quot;ZentOS&quot;, texto
                &quot;Movimiento guardado&quot;. Guarda el atajo.
              </li>
            </ol>
            <p className="mt-3 font-medium text-foreground">Para usarlo en el Apple Watch:</p>
            <p className="mt-1">
              Ábrelo en Atajos en el iPhone → toca <span className="text-foreground">ⓘ</span> → activa{" "}
              <span className="text-foreground">&quot;Mostrar en Apple Watch&quot;</span>. Debería aparecer en la app
              Atajos del reloj a los pocos segundos.
            </p>
          </div>
          )}
        </div>
      )}
    </Card>
  )
}
