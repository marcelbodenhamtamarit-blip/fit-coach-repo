"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Send } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { currencySymbol } from "@/lib/types"
import type { CategoryBreakdown } from "@/lib/timmy-insights"
import type { PlanLine } from "@/components/tree-sheet"

type ChatMsg = { who: "user" | "timmy"; text: string }

export function TimmyDrawer({
  open,
  onClose,
  categories,
  income,
  expense,
  homeCurrency,
  planLines,
  planSummary,
  planLoading,
  onRequestPlan,
}: {
  open: boolean
  onClose: () => void
  categories: CategoryBreakdown[]
  income: number
  expense: number
  homeCurrency: string
  planLines: PlanLine[] | null
  planSummary: string | null
  planLoading: boolean
  onRequestPlan: () => void
}) {
  const symbol = currencySymbol(homeCurrency)
  const net = income - expense
  const reductionTotal = useMemo(() => planLines?.reduce((s, l) => s + l.reduction, 0) ?? null, [planLines])

  const greeting = useMemo<ChatMsg>(
    () => ({
      who: "timmy",
      text:
        expense > 0
          ? `¡Hola! Soy Timmy 🌳✨. Este mes van +${symbol}${income.toFixed(0)} de ingresos y -${symbol}${expense.toFixed(0)} de gastos. Pídeme un plan de reducción o pregúntame lo que quieras sobre tu economía.`
          : `¡Hola! Soy Timmy 🌳✨. Todavía no hay gastos registrados este mes, así que tu árbol está esperando su primera rama. Pregúntame lo que quieras.`,
    }),
    [income, expense, symbol],
  )

  const [messages, setMessages] = useState<ChatMsg[]>([greeting])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      onRequestPlan()
      setMessages((m) => (m.length === 1 && m[0].who === "timmy" ? [greeting] : m))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight })
  }, [messages, sending])

  if (!open) return null

  const send = async (preset?: string) => {
    const q = (preset ?? input).trim()
    if (!q || sending) return
    const nextMessages: ChatMsg[] = [...messages, { who: "user", text: q }]
    setMessages(nextMessages)
    setInput("")
    setSending(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error("no-session")
      const res = await fetch("/api/timmy", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: "chat",
          message: q,
          income,
          expense,
          categories: categories.map((c) => ({ category: c.category, amount: c.amount })),
          history: nextMessages.slice(-12),
        }),
      })
      const json = await res.json()
      setMessages((m) => [...m, { who: "timmy", text: json.reply ?? json.error ?? "No he podido responder." }])
    } catch {
      setMessages((m) => [...m, { who: "timmy", text: "No he podido conectar ahora mismo. Prueba otra vez en un momento." }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 ease-out flex h-[88vh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0c1115] shadow-2xl">
        <div className="flex justify-center pt-2">
          <div className="h-1.5 w-9 rounded-full bg-white/20" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 pb-3 pt-1">
          <div className="flex items-center gap-2.5">
            <div
              className="size-10 shrink-0 rounded-full"
              style={{
                background: "radial-gradient(circle at 32% 26%, #fff7cc, #facc15 48%, #b45309 100%)",
                boxShadow: "0 2px 5px rgba(0,0,0,0.35), inset 0 -3px 5px rgba(0,0,0,0.2), inset 0 2px 3px rgba(255,255,255,0.5)",
              }}
            />
            <div>
              <h3 className="text-[14px] font-extrabold text-white">Apartado IA: Timmy</h3>
              <p className="mt-0.5 text-[10.5px] text-[#8d8d96]">Balance y plan de reducción con Gemini</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar IA Timmy"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 px-4 py-2.5">
          <div className="rounded-xl border p-2 text-center" style={{ background: "#16241e", borderColor: "rgba(74,222,128,0.3)" }}>
            <span className="block text-[9px] font-bold uppercase text-[#86efac]">Ganado</span>
            <span className="text-[13px] font-extrabold text-[#4ade80]">+{symbol}{income.toFixed(0)}</span>
          </div>
          <div className="rounded-xl border border-[#2a333a] bg-[#171c21] p-2 text-center">
            <span className="block text-[9px] font-bold uppercase text-[#9aa5ad]">Gastos</span>
            <span className="text-[13px] font-extrabold text-white">-{symbol}{expense.toFixed(0)}</span>
          </div>
          <div className="rounded-xl border p-2 text-center" style={{ background: "#1a2317", borderColor: "rgba(163,230,53,0.3)" }}>
            <span className="block text-[9px] font-bold uppercase text-[#d9f99d]">Reducción</span>
            <span className="text-[13px] font-extrabold text-[#a3e635]">
              {planLoading ? "…" : reductionTotal != null ? `-${symbol}${reductionTotal}/mes` : "—"}
            </span>
          </div>
        </div>

        <div className="mx-4 mb-2.5 rounded-2xl border p-3" style={{ background: "linear-gradient(180deg,#1a1626,#140f1d)", borderColor: "rgba(168,85,247,0.25)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold text-white">🎯 Plan Timmy</span>
            <span className="text-[11px] font-extrabold text-[#a3e635]">
              {net > 0 ? `balance +${symbol}${net.toFixed(0)}/mes` : ""}
            </span>
          </div>
          {planLoading && <p className="mt-2 text-[11px] text-[#c9d6de]">Timmy está pensando un plan…</p>}
          {!planLoading && planLines && planLines.length > 0 && (
            <div className="mt-1.5 space-y-1.5">
              {planLines.slice(0, 4).map((l) => (
                <div key={l.category} className="flex items-center justify-between rounded-lg bg-[#19232a] px-2.5 py-1.5 text-[11.5px]">
                  <span className="text-[#c9d6de]">{l.category}</span>
                  <strong className="text-[#a3e635]">-{symbol}{l.reduction}</strong>
                </div>
              ))}
            </div>
          )}
          {!planLoading && (!planLines || planLines.length === 0) && (
            <p className="mt-2 text-[11px] text-[#c9d6de]">
              {categories.length === 0 ? "Registra algún gasto este mes para que Timmy pueda proponer un plan." : planSummary ?? "Sin plan todavía."}
            </p>
          )}
          {planSummary && planLines && planLines.length > 0 && (
            <p className="mt-2 text-[10.5px] text-[#9aa5ad]">{planSummary}</p>
          )}
        </div>

        <div ref={chatRef} className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[82%] rounded-2xl px-3 py-2.5 text-[12px] leading-relaxed ${
                m.who === "timmy"
                  ? "self-start rounded-bl-sm border border-[#26353e] bg-[#182228] text-[#dfe3e6]"
                  : "self-end rounded-br-sm text-white"
              }`}
              style={m.who === "user" ? { background: "#a855f7" } : undefined}
            >
              {m.text}
            </div>
          ))}
          {sending && (
            <div className="max-w-[60%] self-start rounded-2xl rounded-bl-sm border border-[#26353e] bg-[#182228] px-3 py-2.5 text-[12px] text-[#8d8d96]">
              Timmy está escribiendo…
            </div>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-4 pt-2">
          <button
            type="button"
            onClick={() => send("¿Cómo reduzco mi mayor gasto?")}
            className="shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[10.5px] font-bold"
            style={{ color: "#bef264", borderColor: "rgba(163,230,53,0.3)", background: "#1b262d" }}
          >
            🛒 Reducir mi mayor gasto
          </button>
          <button
            type="button"
            onClick={() => send("¿Cuál es mi balance de este mes?")}
            className="shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[10.5px] font-bold"
            style={{ color: "#d8b4fe", borderColor: "rgba(168,85,247,0.3)", background: "#1b262d" }}
          >
            ⚖️ Balance del mes
          </button>
        </div>

        <div className="flex gap-2 px-4 pb-4 pt-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Pregunta a Timmy..."
            className="h-10 flex-1 rounded-xl border border-[#27353e] bg-[#182126] px-3 text-[12px] text-white outline-none"
          />
          <button
            type="button"
            onClick={() => send()}
            disabled={sending}
            aria-label="Enviar"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#a855f7] text-white disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
