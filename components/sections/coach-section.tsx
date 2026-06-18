"use client"

import type React from "react"

import { useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Send, Dumbbell, Apple, Moon, Scale } from "lucide-react"
import { useStore } from "@/lib/store"
import { buildCoachContext } from "@/lib/coach-context"

const SUGGESTIONS = [
  { icon: Dumbbell, label: "Plan my next workout", text: "Based on my recent training, what should my next workout be?" },
  { icon: Apple, label: "Review my nutrition", text: "How does my calorie and protein intake look this week?" },
  { icon: Moon, label: "Improve my sleep", text: "My sleep hasn't been great. How can I improve it?" },
  { icon: Scale, label: "Am I on track?", text: "Looking at my body metrics and trends, am I on track with my goals?" },
]

export function CoachSection() {
  const store = useStore()
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/coach" }),
  })

  const isBusy = status === "streaming" || status === "submitted"

  function submit(text: string) {
    if (!text.trim() || isBusy) return
    sendMessage(
      { text },
      { body: { context: buildCoachContext(store) } },
    )
    setInput("")
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit(input)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-balance">AI Coach</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your personal coach knows your workouts, meals, sleep, and metrics.
        </p>
      </div>

      <Card className="flex flex-col overflow-hidden p-0" style={{ height: "calc(100vh - 13rem)" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
          <div className="flex flex-col gap-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Sparkles className="size-7 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">How can I help today?</p>
                  <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
                    Ask anything about your training, nutrition, recovery, or progress.
                  </p>
                </div>
                <div className="grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => submit(s.text)}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent"
                    >
                      <s.icon className="size-4 shrink-0 text-primary" />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => {
                const text = m.parts
                  .filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("")
                const isUser = m.role === "user"
                return (
                  <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{text}</p>
                    </div>
                  </div>
                )
              })
            )}
            {status === "submitted" && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground rounded-2xl px-4 py-2.5 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-current" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach anything..."
            disabled={isBusy}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isBusy || !input.trim()}>
            <Send className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </Card>
    </div>
  )
}
