"use client"

// Tarjeta del coach IA dentro de Winter Arc: consejo del día (se genera una
// vez al día en /api/coach y queda guardado), chat corto y "lo que sabe de
// ti" (la memoria que la IA va actualizando). Los mensajes y la memoria se
// leen directamente de Supabase (RLS: solo tu usuario); generar respuestas
// pasa por /api/coach, que es quien tiene la clave de la API de Claude.

import { useEffect, useRef, useState } from "react"
import { Brain, ChevronDown, Send, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/use-auth"
import { todayISO } from "@/lib/types"

type Msg = { id: string; role: "user" | "coach"; kind: "daily" | "chat"; day: string; content: string }

async function callCoach(body: Record<string, unknown>): Promise<{ reply?: string; error?: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: "Sesión caducada. Vuelve a entrar." }
  try {
    const res = await fetch("/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, today: todayISO(), hour: new Date().getHours() }),
    })
    const json = (await res.json()) as { reply?: string; error?: string }
    if (!res.ok) return { error: json.error ?? "Error del coach" }
    return json
  } catch {
    return { error: "Sin conexión con el coach." }
  }
}

export function CoachCard() {
  const { user } = useAuth()
  const today = todayISO()
  const [daily, setDaily] = useState<string | null>(null)
  const [dailyLoading, setDailyLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chat, setChat] = useState<Msg[]>([])
  const [memory, setMemory] = useState("")
  const [open, setOpen] = useState<"chat" | "memory" | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      const [msgs, mem] = await Promise.all([
        supabase.from("winter_arc_coach_messages").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("winter_arc_coach_memory").select("notes").maybeSingle(),
      ])
      if (cancelled) return
      if (msgs.error) {
        setError("Falta crear las tablas del coach: ejecuta supabase-migrations/winter_arc_coach.sql en Supabase.")
        setDailyLoading(false)
        return
      }
      const list = ((msgs.data ?? []) as Msg[]).reverse()
      setChat(list.filter((m) => m.kind === "chat"))
      setMemory((mem.data?.notes as string | undefined) ?? "")
      const todays = list.find((m) => m.kind === "daily" && m.day === today)
      if (todays) {
        setDaily(todays.content)
        setDailyLoading(false)
        return
      }
      const res = await callCoach({ mode: "daily" })
      if (cancelled) return
      if (res.reply) setDaily(res.reply)
      else setError(res.error ?? "Error del coach")
      setDailyLoading(false)
      refreshMemory()
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, today])

  useEffect(() => {
    if (open === "chat") bottomRef.current?.scrollIntoView({ block: "nearest" })
  }, [chat, open])

  async function refreshMemory() {
    const { data } = await supabase.from("winter_arc_coach_memory").select("notes").maybeSingle()
    setMemory((data?.notes as string | undefined) ?? "")
  }

  async function send() {
    const message = draft.trim()
    if (!message || sending) return
    setDraft("")
    setSending(true)
    const tmp: Msg = { id: `tmp-${Date.now()}`, role: "user", kind: "chat", day: today, content: message }
    setChat((c) => [...c, tmp])
    const res = await callCoach({ mode: "chat", message })
    setChat((c) => [
      ...c,
      {
        id: `tmp-r-${Date.now()}`,
        role: "coach",
        kind: "chat",
        day: today,
        content: res.reply ?? `⚠️ ${res.error ?? "Error del coach"}`,
      },
    ])
    setSending(false)
    refreshMemory()
  }

  async function resetMemory() {
    await callCoach({ mode: "reset_memory" })
    setMemory("")
  }

  return (
    <Card className="overflow-hidden border-orange-500/30 bg-black/35 p-0 backdrop-blur-md">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-red-600 text-white">
            <Sparkles className="size-4" />
          </div>
          <p className="text-sm font-semibold">Tu coach</p>
        </div>
        <div className="mt-3 text-sm leading-relaxed">
          {dailyLoading ? (
            <p className="animate-pulse text-muted-foreground">Tu coach está mirando tus datos…</p>
          ) : daily ? (
            <p className="whitespace-pre-line">{daily}</p>
          ) : (
            <p className="text-amber-500">{error}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-white/10 text-xs">
        <button
          onClick={() => setOpen(open === "chat" ? null : "chat")}
          className={cn("flex items-center justify-center gap-1.5 py-2.5", open === "chat" && "bg-white/5 text-orange-400")}
        >
          Hablar con el coach
          <ChevronDown className={cn("size-3.5 transition-transform", open === "chat" && "rotate-180")} />
        </button>
        <button
          onClick={() => setOpen(open === "memory" ? null : "memory")}
          className={cn(
            "flex items-center justify-center gap-1.5 border-l border-white/10 py-2.5",
            open === "memory" && "bg-white/5 text-orange-400",
          )}
        >
          <Brain className="size-3.5" />
          Lo que sabe de ti
        </button>
      </div>

      {open === "chat" && (
        <div className="border-t border-white/10 p-3">
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {chat.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Pregúntale lo que quieras: cómo ajustar la semana, qué comer, cómo no fallar mañana…
              </p>
            )}
            {chat.slice(-20).map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm",
                  m.role === "user" ? "ml-auto bg-orange-500/80 text-white" : "bg-white/10",
                )}
              >
                {m.content}
              </div>
            ))}
            {sending && <div className="w-16 animate-pulse rounded-2xl bg-white/10 px-3 py-2 text-sm">…</div>}
            <div ref={bottomRef} />
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={draft}
              placeholder="Escribe al coach…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send()
              }}
            />
            <Button size="icon" disabled={sending || !draft.trim()} onClick={send} className="bg-orange-500 text-white hover:bg-orange-600">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {open === "memory" && (
        <div className="border-t border-white/10 p-3 text-xs">
          {memory ? (
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{memory}</p>
          ) : (
            <p className="text-muted-foreground">Todavía no ha apuntado nada. Irá aprendiendo con tus datos y lo que le cuentes.</p>
          )}
          {memory && (
            <Button size="xs" variant="outline" className="mt-2" onClick={resetMemory}>
              Borrar memoria
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
