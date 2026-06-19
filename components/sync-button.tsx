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
      // Fetch both Strava and intervals.icu in parallel
      const [stravaRes, intervalsRes] = await Promise.all([
        fetch("/api/strava").catch(() => null),
        fetch("/api/intervals"),
      ])

      let combined = { workouts: [], sleep: [], weights: [] }

      // Get Strava workouts (priority source)
      if (stravaRes?.ok) {
        const stravaData = await stravaRes.json()
        if (stravaData.workouts) combined.workouts = stravaData.workouts
      }

      // Get intervals.icu sleep and weights
      if (intervalsRes?.ok) {
        const intervalsData = await intervalsRes.json()
        if (intervalsData.sleep) combined.sleep = intervalsData.sleep
        if (intervalsData.weights) combined.weights = intervalsData.weights
        // Fallback: if no Strava workouts, use intervals.icu workouts
        if (!combined.workouts.length && intervalsData.workouts) {
          combined.workouts = intervalsData.workouts
        }
      } else {
        const intervalsData = await intervalsRes.json()
        setStatus("error")
        setMessage(intervalsData.error || "Error en intervals.icu")
        return
      }

      const counts = importFromIntervals(combined)
      setStatus("ok")
      setMessage(
        `${counts.workouts} entrenos, ${counts.sleep} sueño, ${counts.weights} peso`,
      )
      setTimeout(() => setStatus("idle"), 4000)
    } catch (err: any) {
      setStatus("error")
      setMessage(err.message || "No se pudo conectar")
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
        title="Sincronizar Strava + intervals.icu"
        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
      >
        <RefreshCw
          className={cn("size-4 text-primary", status === "syncing" && "animate-spin")}
        />
        <span className="hidden sm:inline">
          {status === "syncing" ? "Sincronizando..." : "Sync"}
        </span>
      </button>
    </div>
  )
}
