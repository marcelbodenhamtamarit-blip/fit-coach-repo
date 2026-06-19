"use client"

import { useState } from "react"
import { Plus, Trash2, Dumbbell, Clock, Calendar, X, MapPin, Flame } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useStore } from "@/lib/store"
import { todayISO, uid } from "@/lib/types"
import type { WorkoutExercise } from "@/lib/types"

export function WorkoutsSection() {
  const { data } = useStore()

  return (
    <Tabs defaultValue="log" className="space-y-5">
      <TabsList>
        <TabsTrigger value="log">Workout Log</TabsTrigger>
        <TabsTrigger value="routines">
          Routines
          <Badge variant="secondary" className="ml-1.5">
            {data.routines.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="log" className="space-y-4">
        <LogTab />
      </TabsContent>
      <TabsContent value="routines" className="space-y-4">
        <RoutinesTab />
      </TabsContent>
    </Tabs>
  )
}

function LogTab() {
  const { data, deleteWorkout } = useStore()
  const sorted = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.workouts.length} sessions logged
        </p>
        <LogWorkoutDialog />
      </div>

      {sorted.length === 0 ? (
        <EmptyState text="No workouts yet. Log your first session." />
      ) : (
        <div className="space-y-3">
          {sorted.map((w) => {
            const totalSets = w.exercises.reduce(
              (s, e) => s + e.sets.length,
              0,
            )
            const volume = w.exercises.reduce(
              (s, e) =>
                s + e.sets.reduce((ss, set) => ss + set.reps * set.weight, 0),
              0,
            )
            const isImported = w.id.startsWith("icu-")
            return (
              <Card key={w.id} className="gap-0 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      <Dumbbell className="size-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">
                          {w.name}
                          {!w.durationMin && !w.distanceKm && !w.calories && isImported && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              (sin detalles)
                            </span>
                          )}
                        </p>
                        {w.type && w.type !== "Otro" && (
                          <Badge variant="outline" className="text-xs">
                            {w.type}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatDate(w.date)}
                        </span>
                        {w.durationMin > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {w.durationMin} min
                          </span>
                        )}
                        {w.distanceKm && w.distanceKm > 0 && (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" />
                            {w.distanceKm} km
                          </span>
                        )}
                        {w.calories && w.calories > 0 && (
                          <span className="flex items-center gap-1">
                            <Flame className="size-3" />
                            {w.calories} kcal
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isImported && (
                    <button
                      onClick={() => deleteWorkout(w.id)}
                      className="text-muted-foreground transition-colors hover:text-destructive flex-shrink-0"
                      aria-label="Delete workout"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
                {w.exercises.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {w.exercises.map((e) => (
                      <Badge key={e.id} variant="secondary">
                        {e.name} · {e.sets.length}×
                      </Badge>
                    ))}
                    <Badge variant="outline" className="ml-auto tabular-nums">
                      {totalSets} sets · {volume.toLocaleString()} kg vol
                    </Badge>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LogWorkoutDialog() {
  const { addWorkout } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [duration, setDuration] = useState("")
  const [exercises, setExercises] = useState<WorkoutExercise[]>([
    { id: uid(), name: "", sets: [{ reps: 0, weight: 0 }] },
  ])

  const addExercise = () =>
    setExercises((ex) => [
      ...ex,
      { id: uid(), name: "", sets: [{ reps: 0, weight: 0 }] },
    ])

  const updateExercise = (id: string, name: string) =>
    setExercises((ex) => ex.map((e) => (e.id === id ? { ...e, name } : e)))

  const updateSet = (
    exId: string,
    idx: number,
    field: "reps" | "weight",
    value: number,
  ) =>
    setExercises((ex) =>
      ex.map((e) =>
        e.id === exId
          ? {
              ...e,
              sets: e.sets.map((s, i) =>
                i === idx ? { ...s, [field]: value } : s,
              ),
            }
          : e,
      ),
    )

  const addSet = (exId: string) =>
    setExercises((ex) =>
      ex.map((e) =>
        e.id === exId
          ? { ...e, sets: [...e.sets, { reps: 0, weight: 0 }] }
          : e,
      ),
    )

  const removeExercise = (id: string) =>
    setExercises((ex) => ex.filter((e) => e.id !== id))

  const submit = () => {
    if (!name.trim()) return
    addWorkout({
      date: todayISO(),
      name: name.trim(),
      durationMin: Number(duration) || 0,
      exercises: exercises.filter((e) => e.name.trim()),
    })
    setName("")
    setDuration("")
    setExercises([{ id: uid(), name: "", sets: [{ reps: 0, weight: 0 }] }])
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Log workout
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a workout</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="w-name">Name</Label>
              <Input
                id="w-name"
                placeholder="Push Day"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-dur">Duration (min)</Label>
              <Input
                id="w-dur"
                type="number"
                inputMode="numeric"
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {exercises.map((ex) => (
              <div
                key={ex.id}
                className="space-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Exercise name"
                    value={ex.name}
                    onChange={(e) => updateExercise(ex.id, e.target.value)}
                  />
                  {exercises.length > 1 && (
                    <button
                      onClick={() => removeExercise(ex.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove exercise"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {ex.sets.map((set, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-10 text-xs text-muted-foreground">
                        Set {i + 1}
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        placeholder="reps"
                        className="h-8"
                        value={set.reps || ""}
                        onChange={(e) =>
                          updateSet(ex.id, i, "reps", Number(e.target.value))
                        }
                      />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        placeholder="kg"
                        className="h-8"
                        value={set.weight || ""}
                        onChange={(e) =>
                          updateSet(ex.id, i, "weight", Number(e.target.value))
                        }
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addSet(ex.id)}
                  >
                    <Plus className="size-3" /> Add set
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={addExercise}
            >
              <Plus className="size-4" /> Add exercise
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Save workout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoutinesTab() {
  const { data, addRoutine, deleteRoutine } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [focus, setFocus] = useState("")

  const submit = () => {
    if (!name.trim()) return
    addRoutine({ name: name.trim(), focus: focus.trim(), exercises: [] })
    setName("")
    setFocus("")
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reusable training templates
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> New routine
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New routine</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-name">Name</Label>
                <Input
                  id="r-name"
                  placeholder="Upper Body"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-focus">Focus</Label>
                <Input
                  id="r-focus"
                  placeholder="Chest, Back, Arms"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.routines.map((r) => (
          <Card key={r.id} className="gap-0 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">{r.focus}</p>
              </div>
              <button
                onClick={() => deleteRoutine(r.id)}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Delete routine"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            {r.exercises.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                {r.exercises.map((e) => (
                  <li
                    key={e.id}
                    className="flex justify-between text-sm tabular-nums"
                  >
                    <span>{e.name}</span>
                    <span className="text-muted-foreground">
                      {e.sets} × {e.reps}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-2 border-dashed py-12 text-center">
      <Dumbbell className="size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  )
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}
