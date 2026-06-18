"use client"

import { useState } from "react"
import { Plus, Trash2, Scale, TrendingDown, TrendingUp } from "lucide-react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
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

export function MetricsSection() {
  const { data, deleteMetric } = useStore()
  const sorted = [...data.metrics].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const first = sorted[0]

  const weightDelta = latest && first ? latest.weight - first.weight : 0
  const fatDelta = latest && first ? latest.bodyFat - first.bodyFat : 0

  const chart = sorted.map((m) => ({
    date: m.date.slice(5),
    weight: m.weight,
    bodyFat: m.bodyFat,
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DeltaCard
          label="Weight"
          value={latest ? `${latest.weight.toFixed(1)} kg` : "--"}
          delta={weightDelta}
          unit="kg"
          goodWhenDown
        />
        <DeltaCard
          label="Body fat"
          value={latest ? `${latest.bodyFat.toFixed(1)} %` : "--"}
          delta={fatDelta}
          unit="%"
          goodWhenDown
        />
        <Card className="gap-0 p-4">
          <span className="text-xs text-muted-foreground">Waist</span>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {latest ? latest.waist.toFixed(1) : "--"}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              cm
            </span>
          </p>
        </Card>
        <Card className="gap-0 p-4">
          <span className="text-xs text-muted-foreground">Goal weight</span>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {data.profile.weightGoal}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              kg
            </span>
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Scale className="size-4 text-[var(--chart-5)]" />
          Weight &amp; body fat trend
        </h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
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
                domain={["dataMin - 2", "dataMax + 2"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                  color: "var(--popover-foreground)",
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                name="Weight (kg)"
                stroke="var(--chart-5)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="bodyFat"
                name="Body fat (%)"
                stroke="var(--chart-4)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">History</h3>
        <AddMetricDialog />
      </div>

      <div className="space-y-2.5">
        {[...sorted].reverse().map((m) => (
          <Card key={m.id} className="flex-row items-center gap-3 p-3.5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--chart-5)]/10 text-[var(--chart-5)]">
              <Scale className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium tabular-nums">
                {m.weight.toFixed(1)} kg
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(m.date)}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground tabular-nums">
              <p>{m.bodyFat.toFixed(1)}% fat</p>
              <p>{m.waist.toFixed(1)} cm waist</p>
            </div>
            <button
              onClick={() => deleteMetric(m.id)}
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

function DeltaCard({
  label,
  value,
  delta,
  unit,
  goodWhenDown,
}: {
  label: string
  value: string
  delta: number
  unit: string
  goodWhenDown?: boolean
}) {
  const isDown = delta < 0
  const isGood = goodWhenDown ? isDown : !isDown
  const Icon = isDown ? TrendingDown : TrendingUp
  return (
    <Card className="gap-0 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {delta !== 0 && (
        <span
          className="mt-1 flex items-center gap-1 text-xs tabular-nums"
          style={{ color: isGood ? "var(--chart-1)" : "var(--destructive)" }}
        >
          <Icon className="size-3" />
          {Math.abs(delta).toFixed(1)} {unit}
        </span>
      )}
    </Card>
  )
}

function AddMetricDialog() {
  const { addMetric } = useStore()
  const [open, setOpen] = useState(false)
  const [weight, setWeight] = useState("")
  const [bodyFat, setBodyFat] = useState("")
  const [waist, setWaist] = useState("")

  const submit = () => {
    if (!weight) return
    addMetric({
      date: todayISO(),
      weight: Number(weight),
      bodyFat: Number(bodyFat) || 0,
      waist: Number(waist) || 0,
    })
    setWeight("")
    setBodyFat("")
    setWaist("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Add entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add body metrics</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="b-weight">Weight (kg)</Label>
            <Input
              id="b-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="83.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-fat">Body fat (%)</Label>
              <Input
                id="b-fat"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="17.5"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-waist">Waist (cm)</Label>
              <Input
                id="b-waist"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="84"
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
              />
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
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
