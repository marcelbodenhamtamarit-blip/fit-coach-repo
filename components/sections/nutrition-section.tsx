"use client"

import { useState } from "react"
import { Plus, Trash2, Flame } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStore } from "@/lib/store"
import { todayISO } from "@/lib/types"
import type { Meal } from "@/lib/types"

const MEAL_TYPES: Meal["mealType"][] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]

export function NutritionSection() {
  const { data, deleteMeal } = useStore()
  const today = todayISO()
  const todaysMeals = data.meals.filter((m) => m.date === today)

  const totals = todaysMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )

  const calPct = Math.min(
    100,
    Math.round((totals.calories / data.profile.calorieGoal) * 100),
  )
  const proPct = Math.min(
    100,
    Math.round((totals.protein / data.profile.proteinGoal) * 100),
  )

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Today&apos;s intake</h2>
            <p className="text-xs text-muted-foreground">
              {data.profile.calorieGoal - totals.calories > 0
                ? `${(data.profile.calorieGoal - totals.calories).toLocaleString()} kcal left`
                : "Goal reached"}
            </p>
          </div>
          <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--chart-3)]/10 text-[var(--chart-3)]">
            <Flame className="size-5" />
          </span>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Calories</span>
              <span className="tabular-nums">
                {totals.calories.toLocaleString()} /{" "}
                {data.profile.calorieGoal.toLocaleString()} kcal
              </span>
            </div>
            <Progress value={calPct} className="h-2" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Protein</span>
              <span className="tabular-nums">
                {totals.protein} / {data.profile.proteinGoal} g
              </span>
            </div>
            <Progress value={proPct} className="h-2" />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
          <MacroBox label="Protein" value={totals.protein} color="var(--chart-1)" />
          <MacroBox label="Carbs" value={totals.carbs} color="var(--chart-2)" />
          <MacroBox label="Fat" value={totals.fat} color="var(--chart-3)" />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Meals today</h3>
        <AddMealDialog />
      </div>

      {todaysMeals.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed py-12 text-center">
          <Flame className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No meals logged today.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {todaysMeals.map((m) => (
            <Card key={m.id} className="flex-row items-center gap-3 p-3.5">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{m.name}</p>
                  <Badge variant="secondary" className="capitalize">
                    {m.mealType}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  P {m.protein}g · C {m.carbs}g · F {m.fat}g
                </p>
              </div>
              <span className="text-right font-semibold tabular-nums">
                {m.calories}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  kcal
                </span>
              </span>
              <button
                onClick={() => deleteMeal(m.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete meal"
              >
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function MacroBox({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-1.5 h-1.5 w-8 rounded-full"
        style={{ background: color }}
      />
      <p className="text-lg font-semibold tabular-nums">{value}g</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function AddMealDialog() {
  const { addMeal } = useStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    mealType: "breakfast" as Meal["mealType"],
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  })

  const submit = () => {
    if (!form.name.trim()) return
    addMeal({
      date: todayISO(),
      name: form.name.trim(),
      mealType: form.mealType,
      calories: Number(form.calories) || 0,
      protein: Number(form.protein) || 0,
      carbs: Number(form.carbs) || 0,
      fat: Number(form.fat) || 0,
    })
    setForm({
      name: "",
      mealType: "breakfast",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Add meal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a meal</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-name">Meal</Label>
            <Input
              id="m-name"
              placeholder="Chicken & rice"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.mealType}
              onValueChange={(v) =>
                setForm({ ...form, mealType: v as Meal["mealType"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Calories"
              value={form.calories}
              onChange={(v) => setForm({ ...form, calories: v })}
            />
            <Field
              label="Protein (g)"
              value={form.protein}
              onChange={(v) => setForm({ ...form, protein: v })}
            />
            <Field
              label="Carbs (g)"
              value={form.carbs}
              onChange={(v) => setForm({ ...form, carbs: v })}
            />
            <Field
              label="Fat (g)"
              value={form.fat}
              onChange={(v) => setForm({ ...form, fat: v })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Add meal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
