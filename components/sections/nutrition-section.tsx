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
import {
  searchWoolworthsProducts,
  calculateNutrients,
} from "@/lib/woolworths-products"
import type { WoolworthsProduct } from "@/lib/woolworths-products"

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
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProduct, setSelectedProduct] = useState<WoolworthsProduct | null>(
    null,
  )
  const [grams, setGrams] = useState("100")
  const [mealType, setMealType] = useState<Meal["mealType"]>("breakfast")

  const searchResults = searchWoolworthsProducts(searchQuery)

  const handleSelectProduct = (product: WoolworthsProduct) => {
    setSelectedProduct(product)
    setSearchQuery("")
  }

  const submit = () => {
    if (!selectedProduct || !grams.trim()) return

    const nutrients = calculateNutrients(selectedProduct, Number(grams))
    const portionText = `${grams}g de ${selectedProduct.name}`

    addMeal({
      date: todayISO(),
      name: portionText,
      mealType,
      calories: nutrients.calories,
      protein: nutrients.protein,
      carbs: nutrients.carbs,
      fat: nutrients.fat,
    })

    setSelectedProduct(null)
    setGrams("100")
    setMealType("breakfast")
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
          <DialogTitle>
            {selectedProduct ? selectedProduct.name : "Add meal from Woolworths"}
          </DialogTitle>
        </DialogHeader>

        {!selectedProduct ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="search">Search Woolworths products</Label>
              <Input
                id="search"
                placeholder="Chicken, rice, protein..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {searchQuery && (
              <div className="max-h-60 space-y-1 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className="w-full rounded-lg border border-border p-2 text-left hover:bg-accent"
                    >
                      <div className="text-sm font-medium">{product.name}</div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{product.calories} kcal</span>
                        <span>|</span>
                        <span>{product.protein}g protein</span>
                        <span>|</span>
                        <span>{product.category}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No products found
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-semibold">{selectedProduct.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedProduct.category} • {selectedProduct.brand}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Meal type</Label>
              <Select value={mealType} onValueChange={(v) => setMealType(v as Meal["mealType"])}>
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

            <div className="space-y-1.5">
              <Label htmlFor="grams">Portion size (grams)</Label>
              <Input
                id="grams"
                type="number"
                inputMode="numeric"
                placeholder="100"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
            </div>

            {grams && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Nutrient info for {grams}g:
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  {(() => {
                    const nutrients = calculateNutrients(
                      selectedProduct,
                      Number(grams),
                    )
                    return (
                      <>
                        <div>
                          <span className="text-muted-foreground">Calories:</span>
                          <p className="font-semibold">
                            {nutrients.calories} kcal
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Protein:</span>
                          <p className="font-semibold">{nutrients.protein}g</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Carbs:</span>
                          <p className="font-semibold">{nutrients.carbs}g</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fat:</span>
                          <p className="font-semibold">{nutrients.fat}g</p>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedProduct(null)
                  setSearchQuery("")
                  setGrams("100")
                }}
              >
                Back
              </Button>
              <Button onClick={submit} className="flex-1">
                Add meal
              </Button>
            </div>
          </div>
        )}
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
