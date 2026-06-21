"use client"

import { useState } from "react"
import { Plus, Trash2, Edit2, Check, X, Loader2 } from "lucide-react"
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
} from "@/components/ui/dialog"
import { useStore } from "@/lib/store"
import { todayISO, uid } from "@/lib/types"
import type { Ingredient, Meal } from "@/lib/types"

export function NutritionSection() {
  const { data, addMeal } = useStore()
  const today = todayISO()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [toastError, setToastError] = useState<string | null>(null)

  const todaysMeals = data.meals.filter((m) => m.date === today)

  // Totals from all today's meals
  const mealsTotals = todaysMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.totalCalories,
      protein: acc.protein + m.totalProtein,
      carbs: acc.carbs + m.totalCarbs,
      fat: acc.fat + m.totalFat,
      cost: acc.cost + m.totalCost,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, cost: 0 },
  )

  // Totals from current ingredients being added
  const ingredientsTotals = {
    calories: ingredients.reduce((s, i) => s + (i.caloriesPer100g * i.quantity) / 100, 0),
    protein: ingredients.reduce((s, i) => s + (i.proteinPer100g * i.quantity) / 100, 0),
    carbs: ingredients.reduce((s, i) => s + (i.carbsPer100g * i.quantity) / 100, 0),
    fat: ingredients.reduce((s, i) => s + (i.fatPer100g * i.quantity) / 100, 0),
    cost: ingredients.reduce((s, i) => s + (i.pricePerKg * i.quantity) / 1000, 0),
  }

  const totals = {
    calories: mealsTotals.calories + ingredientsTotals.calories,
    protein: mealsTotals.protein + ingredientsTotals.protein,
    carbs: mealsTotals.carbs + ingredientsTotals.carbs,
    fat: mealsTotals.fat + ingredientsTotals.fat,
  }

  const calPct = Math.min(
    100,
    Math.round((totals.calories / data.profile.calorieGoal) * 100),
  )
  const proteinPct = Math.min(
    100,
    Math.round((totals.protein / data.profile.proteinGoal) * 100),
  )

  const handleSaveMeal = () => {
    if (ingredients.length === 0) {
      setToastError("Añade al menos un ingrediente")
      setTimeout(() => setToastError(null), 3000)
      return
    }

    addMeal({
      date: today,
      ingredients,
      totalCalories: ingredientsTotals.calories,
      totalProtein: ingredientsTotals.protein,
      totalCarbs: ingredientsTotals.carbs,
      totalFat: ingredientsTotals.fat,
      totalCost: ingredientsTotals.cost,
    })

    setIngredients([])
  }

  const handleDeleteIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id))
  }

  return (
    <div className="space-y-5">
      {/* Error toast */}
      {toastError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {toastError}
        </div>
      )}

      {/* Add ingredient form */}
      <AddIngredientForm
        onAdd={(ing) => setIngredients((prev) => [...prev, ing])}
        onError={(msg) => {
          setToastError(msg)
          setTimeout(() => setToastError(null), 3000)
        }}
      />

      {/* Current ingredients */}
      {ingredients.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Ingredientes en esta comida</h3>
          <div className="space-y-2">
            {ingredients.map((ing) => {
              const ingCals = (ing.caloriesPer100g * ing.quantity) / 100
              const ingProt = (ing.proteinPer100g * ing.quantity) / 100
              const ingCarbs = (ing.carbsPer100g * ing.quantity) / 100
              const ingFat = (ing.fatPer100g * ing.quantity) / 100
              const ingCost = (ing.pricePerKg * ing.quantity) / 1000

              return (
                <div
                  key={ing.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"
                >
                  <div className="flex-1">
                    <p className="font-medium">{ing.name}</p>
                    <p className="text-muted-foreground">{ing.quantity}g</p>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-right font-mono text-xs">
                    <span title="Calorías">{ingCals.toFixed(0)}</span>
                    <span title="Proteína">{ingProt.toFixed(1)}g</span>
                    <span title="Carbos">{ingCarbs.toFixed(1)}g</span>
                    <span title="Grasas">{ingFat.toFixed(1)}g</span>
                  </div>
                  <span className="w-12 text-right font-mono text-xs">${ingCost.toFixed(2)}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={() => handleDeleteIngredient(ing.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Running totals */}
      {ingredients.length > 0 && (
        <Card className="bg-primary/5 p-5">
          <h3 className="mb-3 text-sm font-semibold">Total de ingredientes</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground">Calorías</p>
              <p className="text-lg font-bold">{ingredientsTotals.calories.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">kcal</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Proteína</p>
              <p className="text-lg font-bold">{ingredientsTotals.protein.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Carbos</p>
              <p className="text-lg font-bold">{ingredientsTotals.carbs.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grasas</p>
              <p className="text-lg font-bold">{ingredientsTotals.fat.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Costo</p>
              <p className="text-lg font-bold">${ingredientsTotals.cost.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">AUD</p>
            </div>
          </div>
          <Button onClick={handleSaveMeal} className="mt-4 w-full">
            Guardar comida
          </Button>
        </Card>
      )}

      {/* Daily summary */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Consumo de hoy</h3>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Calorías</span>
              <span className="tabular-nums">
                {totals.calories.toFixed(0)} / {data.profile.calorieGoal}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${calPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">Proteína</span>
              <span className="tabular-nums">
                {totals.protein.toFixed(1)} / {data.profile.proteinGoal}g
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${proteinPct}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Today's meals */}
      {todaysMeals.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Comidas registradas</h3>
          <div className="space-y-2">
            {todaysMeals.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                <div className="flex-1 grid grid-cols-4 gap-1 text-xs">
                  <div>
                    <p className="text-muted-foreground">Cal</p>
                    <p className="font-bold">{meal.totalCalories.toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pro</p>
                    <p className="font-bold">{meal.totalProtein.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Carbs</p>
                    <p className="font-bold">{meal.totalCarbs.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gras</p>
                    <p className="font-bold">{meal.totalFat.toFixed(1)}</p>
                  </div>
                </div>
                <span className="font-mono text-xs">${meal.totalCost.toFixed(2)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  disabled
                  title="Editar funcionalidad en desarrollo"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function AddIngredientForm({
  onAdd,
  onError,
}: {
  onAdd: (ing: Ingredient) => void
  onError: (msg: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState("")
  const [priceOverride, setPriceOverride] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [editingPrice, setEditingPrice] = useState(false)

  const handleSearch = async (term: string) => {
    if (!term.trim() || term.length < 2) {
      setResults([])
      return
    }

    setSearching(true)
    try {
      const res = await fetch(
        `https://www.woolworths.com.au/apis/ui/Search/products?searchTerm=${encodeURIComponent(term)}&pageNumber=1&pageSize=5`,
      )
      const data = await res.json()
      setResults(data.products || [])
    } catch {
      onError("No se pudo buscar en Woolworths")
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSelectProduct = (product: any) => {
    setSelected(product)
    setSearch("")
    setResults([])
    setPrice(product.price?.toFixed(2) || "")
    setPriceOverride("")
    setEditingPrice(false)
  }

  const handleAdd = () => {
    if (!selected || !quantity) {
      onError("Completa ingrediente y cantidad")
      return
    }

    const qty = parseFloat(quantity)
    const pricePerKg = parseFloat(priceOverride || price || "0")

    if (!pricePerKg) {
      onError("Se requiere precio por kg")
      return
    }

    const ing: Ingredient = {
      id: uid(),
      name: selected.name,
      quantity: qty,
      caloriesPer100g: selected.caloriesPer100g || 0,
      proteinPer100g: selected.proteinPer100g || 0,
      carbsPer100g: selected.carbsPer100g || 0,
      fatPer100g: selected.fatPer100g || 0,
      pricePerKg,
    }

    onAdd(ing)
    setSelected(null)
    setQuantity("")
    setPrice("")
    setPriceOverride("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="flex cursor-pointer items-center justify-between p-4 border-dashed hover:bg-muted/50">
          <span className="text-sm text-muted-foreground">Añadir ingrediente...</span>
          <Plus className="h-5 w-5 text-muted-foreground" />
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selected ? selected.name : "Buscar ingrediente"}
          </DialogTitle>
        </DialogHeader>

        {!selected ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="search">Buscar producto Woolworths</Label>
              <Input
                id="search"
                placeholder="Arroz, pollo, aceite..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  handleSearch(e.target.value)
                }}
                disabled={searching}
              />
            </div>

            {searching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {results.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {results.map((product) => (
                  <button
                    key={product.code}
                    onClick={() => handleSelectProduct(product)}
                    className="w-full rounded-lg border border-border p-2 text-left hover:bg-accent"
                  >
                    <div className="text-sm font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      ${product.price?.toFixed(2) || "N/A"} - {product.weight || ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-semibold">{selected.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selected.weight || ""} - ${selected.price?.toFixed(2) || "N/A"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quantity">Cantidad (gramos)</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Precio por kg</Label>
                {!editingPrice && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-5 w-5 p-0"
                    onClick={() => setEditingPrice(true)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {editingPrice ? (
                <div className="flex gap-1">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={priceOverride}
                    onChange={(e) => setPriceOverride(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => setEditingPrice(false)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
                  ${parseFloat(priceOverride || price || "0").toFixed(2)}/kg
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelected(null)
                  setQuantity("")
                  setEditingPrice(false)
                }}
              >
                Volver
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                Añadir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
