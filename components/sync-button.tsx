"use client"

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"

export function SyncButton() {
  const { importFromIntervals } = useStore()
  const [status, setStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle")
  const [message, setMessage] = useState("")

  async function sync() {
    setStatus("syncing")
    setMessage("")
    try {
      const res = await fetch("/api/intervals")
      const json = await res.json()
      if (!res.ok) {
        setStatus("error")
        setMessage(json.error || "Error al sincronizar")
        return
      }
      const counts = importFromIntervals(json)
      setStatus("ok")
      setMessage(
        `${counts.workouts} entrenos, ${counts.sleep} sueño, ${counts.weights} peso`,
      )
      setTimeout(() => setStatus("idle"), 4000)
    } catch {
      setStatus("error")
      setMessage("No se pudo conectar")
    }
  }

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span
          className={cn(
            "hidden text-xs sm:inline",
            status === "error" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {message}
        </span>
      )}
      <button
        onClick={sync}
        disabled={status === "syncing"}
        title="Sincronizar con intervals.icu"
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
      >
        <RefreshCw
          className={cn("size-4 text-primary", status === "syncing" && "animate-spin")}
        />
        <span className="hidden sm:inline">
          {status === "syncing" ? "Sincronizando..." : "intervals.icu"}
        </span>
      </button>
    </div>
  )
}
