"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
