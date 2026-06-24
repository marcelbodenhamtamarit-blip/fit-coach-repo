"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Trash2, Flame, CreditCard as Edit2, Check, X, Search, Loader } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { todayISO, uid } from "@/lib/types"
import type { Ingredient } from "@/lib/types"

interface WooProduct {
  name: string
  price: number
  packageSize: string
  pricePerKg?: number
}

export function NutritionSection() {
  const { data, addMeal } = useStore()
  const today = todayISO()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [input, setInput] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<WooProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<WooProduct | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  const todaysMeals = data.meals.filter((m) => m.date === today)

  // Search Woolworths products when user types
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }

    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/woolworths?searchTerm=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.products || [])
        } else {
          setSearchResults([])
        }
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current)
      }
    }
  }, [searchQuery])

  // Calculate totals from all today's meals
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

  // Calculate totals from current ingredients being added
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

  const selectProduct = (product: WooProduct) => {
    setSelectedProduct(product)
    setInput(product.name)
    setSearchQuery("")
    setSearchResults([])
    setShowSearch(false)
  }

  const handleAddIngredient = () => {
    if (!input.trim()) return

    // Parse input like "300g arroz" or "200 pollo" or "2 tomates"
    const match = input.match(/^(\d+(?:\.\d+)?)\s*(g|kg)?\s+(.+)$/i)

    let quantity = 100
    let productName = input.trim()

    if (match) {
      quantity = parseFloat(match[1])
      if (match[2]?.toLowerCase() === "kg") quantity *= 1000
      productName = match[3]
    }

    // Use selected product or create manual entry
    const newIngredient: Ingredient = {
      id: uid(),
      name: selectedProduct?.name || productName,
      quantity,
      caloriesPer100g: 0,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 0,
      pricePerKg: selectedProduct?.pricePerKg || selectedProduct?.price || 0,
    }

    setIngredients((prev) => [...prev, newIngredient])
    setInput("")
    setSelectedProduct(null)
  }

  const handleUpdatePrice = (id: string, newPrice: number) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, pricePerKg: newPrice } : ing)),
    )
    setEditingId(null)
  }

  const handleDeleteIngredient = (id: string) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id))
  }

  const handleSaveMeal = () => {
    if (ingredients.length === 0) {
      alert("Añade al menos un ingrediente")
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
    alert("Comida guardada")
  }

  return (
    <div className="space-y-5">
      {/* Input form */}
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Registrar comida</h2>

        {/* Woolworths search */}
        <div className="space-y-1.5 mb-3">
          <Label>Buscar en Woolworths</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="pasta, arroz, pollo, leche..."
              className="pl-9"
            />
            {searching && (
              <Loader className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
              {searchResults.map((product, idx) => (
                <button
                  key={idx}
                  onClick={() => selectProduct(product)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.packageSize}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">${product.price.toFixed(2)}</p>
                    {product.pricePerKg && (
                      <p className="text-xs text-muted-foreground">${product.pricePerKg.toFixed(2)}/kg</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* No results message */}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-muted-foreground">No se encontraron productos en Woolworths</p>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="300g arroz, 200g pollo..."
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddIngredient()
            }}
          />
          <Button onClick={handleAddIngredient} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Ej: 300g arroz, 200g pollo, 2 tomates</p>
      </Card>

      {/* Ingredients added */}
      {ingredients.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Ingredientes</h3>
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
                  <div className="grid grid-cols-4 gap-1 text-right font-mono">
                    <span>{ingCals.toFixed(0)}</span>
                    <span>{ingProt.toFixed(1)}</span>
                    <span>{ingCarbs.toFixed(1)}</span>
                    <span>{ingFat.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {editingId === ing.id ? (
                      <>
                        <Input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="h-7 w-16 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => handleUpdatePrice(ing.id, parseFloat(editPrice))}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="w-12 text-right">${ingCost.toFixed(2)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setEditingId(ing.id)
                            setEditPrice(ing.pricePerKg.toString())
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={() => handleDeleteIngredient(ing.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
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
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4" />
          Consumo de hoy
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Calorías</span>
            <span className="font-mono">
              {totals.calories.toFixed(0)} / {data.profile.calorieGoal} kcal
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${calPct}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-muted-foreground">Proteína</span>
            <span className="font-mono">
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
      </Card>

      {/* Today's meals */}
      {todaysMeals.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Comidas registradas</h3>
          <div className="space-y-2">
            {todaysMeals.map((meal) => (
              <div key={meal.id} className="rounded-lg border border-border p-3 text-xs">
                <div className="grid grid-cols-4 gap-1">
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
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
