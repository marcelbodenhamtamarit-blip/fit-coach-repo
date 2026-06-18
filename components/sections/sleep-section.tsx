"use client"

import { useState } from "react"
import { Plus, Trash2, Moon, Star } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { useStore } from "@/lib/store"
import { todayISO } from "@/lib/types"
import { cn } from "@/lib/utils"

export function SleepSection() {
  const { data, deleteSleep } = useStore()
  const sorted = [...data.sleep].sort((a, b) => b.date.localeCompare(a.date))
  const last7 = [...data.sleep]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)

  const avg =
    last7.length > 0
      ? last7.reduce((s, e) => s + e.hours, 0) / last7.length
      : 0
  const avgQuality =
    last7.length > 0
      ? last7.reduce((s, e) => s + e.quality, 0) / last7.length
      : 0

  const chart = last7.map((s) => ({
    date: s.date.slice(5),
    hours: s.hours,
    quality: s.quality,
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="gap-0 p-4">
          <span className="text-xs text-muted-foreground">7-day average</span>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {avg.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              hrs
            </span>
          </p>
        </Card>
        <Card className="gap-0 p-4">
          <span className="text-xs text-muted-foreground">Avg quality</span>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {avgQuality.toFixed(1)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / 5
            </span>
          </p>
        </Card>
        <Card className="col-span-2 gap-0 p-4 sm:col-span-1">
          <span className="text-xs text-muted-foreground">Goal</span>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {data.profile.sleepGoal}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              hrs
            </span>
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Moon className="size-4 text-[var(--chart-2)]" />
          Sleep duration (7 days)
        </h2>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chart}
              margin={{ top: 5, right: 5, bottom: 0, left: -22 }}
            >
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                  color: "var(--popover-foreground)",
                }}
                formatter={(v: number) => [`${v} hrs`, "Sleep"]}
              />
              <Bar dataKey="hours" radius={[5, 5, 0, 0]}>
                {chart.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.hours >= data.profile.sleepGoal
                        ? "var(--chart-1)"
                        : "var(--chart-2)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sleep log</h3>
        <AddSleepDialog />
      </div>

      <div className="space-y-2.5">
        {sorted.map((s) => (
          <Card key={s.id} className="flex-row items-center gap-3 p-3.5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--chart-2)]/10 text-[var(--chart-2)]">
              <Moon className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium tabular-nums">
                {s.hours.toFixed(1)} hrs
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatDate(s.date)} · {s.bedtime} – {s.wakeTime}
              </p>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    "size-3.5",
                    i < s.quality
                      ? "fill-[var(--chart-3)] text-[var(--chart-3)]"
                      : "text-muted-foreground/40",
                  )}
                />
              ))}
            </div>
            <button
              onClick={() => deleteSleep(s.id)}
              className="text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Delete entry"
            >
              <Trash2 className="size-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}

function AddSleepDialog() {
  const { addSleep } = useStore()
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState("")
  const [quality, setQuality] = useState(4)
  const [bedtime, setBedtime] = useState("23:00")
  const [wakeTime, setWakeTime] = useState("07:00")

  const submit = () => {
    addSleep({
      date: todayISO(),
      hours: Number(hours) || 0,
      quality,
      bedtime,
      wakeTime,
    })
    setHours("")
    setQuality(4)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Log sleep
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log sleep</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-bed">Bedtime</Label>
              <Input
                id="s-bed"
                type="time"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-wake">Wake time</Label>
              <Input
                id="s-wake"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-hours">Hours slept</Label>
            <Input
              id="s-hours"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="7.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Quality</Label>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuality(i + 1)}
                  aria-label={`Quality ${i + 1}`}
                >
                  <Star
                    className={cn(
                      "size-7 transition-colors",
                      i < quality
                        ? "fill-[var(--chart-3)] text-[var(--chart-3)]"
                        : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}
