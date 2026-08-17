"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Check, Copy, RefreshCw, Watch } from "lucide-react"
import { supabase } from "@/lib/supabase"

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

// Atajo de iOS personal: pide cantidad, tipo y categoría a mano (nada de
// leer notificaciones) y manda un GET a /api/quick-transaction con tu
// token propio ya incrustado en el archivo. Cada usuario tiene el suyo,
// generado (o regenerado) aquí. El .shortcut se genera al vuelo en
// /api/quick-transaction/shortcut a partir de lib/build-quick-add-shortcut.ts.
function QuickAddShortcutCard() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [origin, setOrigin] = useState("")

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

  function copyToken() {
    if (!token) return
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const shortcutFileUrl = token && origin
    ? `${origin}/api/quick-transaction/shortcut/ZentOS-Anadir-gasto.shortcut?token=${token}`
    : ""
  const importUrl = shortcutFileUrl
    ? `shortcuts://import-shortcut?url=${encodeURIComponent(shortcutFileUrl)}&name=${encodeURIComponent("ZentOS - Añadir gasto")}`
    : ""

  return (
    <Card className="p-6">
      <div className="mb-1 flex items-center gap-2">
        <Watch className="size-4 text-primary" />
        <h3 className="text-sm font-semibold">Atajo rápido (iPhone / Apple Watch)</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Un Shortcut de Apple, personal tuyo, que pide la cantidad, el tipo y la categoría a mano y los guarda
        directo en tu cuenta. Funciona desde el iPhone y, una vez instalado, también desde el Apple Watch.
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">Preparando tu atajo...</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <a
              href={importUrl || undefined}
              className={`flex-1 min-w-[10rem] ${buttonVariants({ variant: "default" })}`}
            >
              Instalar en iPhone
            </a>
            <a
              href={shortcutFileUrl || undefined}
              download="ZentOS - Anadir gasto.shortcut"
              className={`flex-1 min-w-[10rem] ${buttonVariants({ variant: "outline" })}`}
            >
              Descargar archivo
            </a>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">La primera vez, iOS pedirá un paso extra:</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Al abrirlo, Atajos puede avisar de &quot;Atajo no confiable&quot;. Ve a Ajustes → Atajos → activa
                &quot;Permitir atajos no confiables&quot; y vuelve a intentarlo.</li>
              <li>Debería aparecer también en el Apple Watch. Si no, ábrelo en Atajos en el iPhone → toca ⓘ →
                activa &quot;Mostrar en Apple Watch&quot;.</li>
            </ol>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tu código personal</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                {token}
              </code>
              <Button size="icon-sm" variant="outline" onClick={copyToken} aria-label="Copiar código">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
              <Button size="icon-sm" variant="outline" onClick={regenerateToken} disabled={regenerating} aria-label="Regenerar código">
                <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Va incrustado en el archivo del atajo. Si crees que alguien más lo tiene, regenéralo — el atajo
              viejo dejará de funcionar y tendrás que instalar el nuevo.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
