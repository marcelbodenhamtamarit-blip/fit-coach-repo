"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Trash2, Refrigerator, CreditCard as Edit2, Check, X, Search, Loader as Loader2 } from "lucide-react"
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
import { todayISO, uid } from "@/lib/types"
import type { PantryItem } from "@/lib/types"
import { ShoppingCart } from "lucide-react"

const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

interface WooProduct {
  name: string
  price: number
  packageSize: string
  pricePerKg?: number
}

export function PantrySection() {
  const { data, addPantryItem, removePantryItem, weeklySupermarket } = useStore()
  const pantry: PantryItem[] = data.pantry ?? []

  const totalValue = pantry.reduce((sum, item) => {
    const cost = (item.pricePerKg * item.quantityGrams) / 1000
    return sum + cost
  }, 0)

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Valor total</p>
            <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Refrigerator className="size-8 text-muted-foreground" />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Items</p>
              <p className="text-lg font-semibold">{pantry.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Weekly Supermarket Total Card */}
      <Card className="p-4 bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="size-6 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Supermercado esta semana (W{weeklySupermarket.weekNumber})</p>
              <p className="text-xl font-bold">${weeklySupermarket.thisWeekTotal.toFixed(2)}</p>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {weeklySupermarket.lastSubmittedWeek === weeklySupermarket.weekNumber ? (
              <span className="text-emerald-500">Enviado</span>
            ) : (
              <span>Sábado 23:59 resumen</span>
            )}
          </div>
        </div>
      </Card>

      {/* Add item button */}
      <div className="flex justify-end">
        <AddPantryDialog onAdd={addPantryItem} />
      </div>

      {/* Pantry list */}
      {pantry.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 border-dashed py-12 text-center">
          <Refrigerator className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">La despensa está vacía</p>
          <p className="text-xs text-muted-foreground">Añade ingredientes para empezar</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {pantry.map((item) => (
            <Card key={item.id} className="flex-row items-center gap-3 p-3.5">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Refrigerator className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantityGrams}g · ${(item.pricePerKg / 1000 * item.quantityGrams).toFixed(2)}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{item.caloriesPer100g} kcal/100g</p>
                <p>{item.proteinPer100g}g prot/100g</p>
              </div>
              <button
                onClick={() => {
                  if (confirm("¿Eliminar este ingrediente?")) {
                    removePantryItem(item.id, item.quantityGrams)
                  }
                }}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Eliminar"
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

function AddPantryDialog({ onAdd }: { onAdd: (item: Omit<PantryItem, "id" | "dateAdded">) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("")
  const [quantityUnit, setQuantityUnit] = useState<"g" | "kg">("g")
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [price, setPrice] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<WooProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<WooProduct | null>(null)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  const selectProduct = (product: WooProduct) => {
    setSelectedProduct(product)
    setName(product.name)
    setSearchQuery("")
    setSearchResults([])
    if (product.pricePerKg) {
      setPrice(product.pricePerKg.toFixed(2))
    } else if (product.price) {
      setPrice(product.price.toFixed(2))
    }
  }

  const submit = async () => {
    if (!name.trim() || !quantity) return

    const quantityGrams = quantityUnit === "kg" ? Number(quantity) * 1000 : Number(quantity) || 0

    onAdd({
      name: name.trim(),
      quantityGrams,
      caloriesPer100g: Number(calories) || 0,
      proteinPer100g: Number(protein) || 0,
      carbsPer100g: Number(carbs) || 0,
      fatPer100g: Number(fat) || 0,
      pricePerKg: Number(price) || 0,
    })

    // Sync to Google Sheets Despensa tab
    try {
      await fetch(GOOGLE_SHEETS_WEBHOOK, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheet: "Despensa",
          action: "compra",
          product: name.trim(),
          quantityGrams,
          priceAUD: Number(price) || 0,
          date: todayISO(),
        }),
      })
    } catch {
      // Silent fail for sync
    }

    setName("")
    setQuantity("")
    setCalories("")
    setProtein("")
    setCarbs("")
    setFat("")
    setPrice("")
    setSearchQuery("")
    setSelectedProduct(null)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Añadir ingrediente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir a despensa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Product search */}
          <div className="space-y-1.5">
            <Label htmlFor="p-search">Buscar producto Woolworths</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="p-search"
                placeholder="Ej: Arroz, Pollo, Tomate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div
                ref={dropdownRef}
                className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
              >
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
              <p className="text-xs text-muted-foreground mt-1">
                No se encontraron productos en Woolworths
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nombre</Label>
            <Input
              id="p-name"
              placeholder="Ej: Arroz, Pollo, Tomate"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSelectedProduct(null)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-qty">Cantidad</Label>
            <div className="flex gap-2">
              <Input
                id="p-qty"
                type="number"
                placeholder="500"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="flex-1"
              />
              <select
                value={quantityUnit}
                onChange={(e) => setQuantityUnit(e.target.value as "g" | "kg")}
                className="flex h-9 w-20 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-cals">Calorías/100g</Label>
              <Input
                id="p-cals"
                type="number"
                placeholder="130"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-prot">Proteína/100g</Label>
              <Input
                id="p-prot"
                type="number"
                placeholder="2.7"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-carbs">Carbos/100g</Label>
              <Input
                id="p-carbs"
                type="number"
                placeholder="28"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-fat">Grasas/100g</Label>
              <Input
                id="p-fat"
                type="number"
                placeholder="0.3"
                value={fat}
                onChange={(e) => setFat(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-price">Precio por kg ($)</Label>
            <Input
              id="p-price"
              type="number"
              placeholder="3.50"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            {selectedProduct && selectedProduct.pricePerKg && (
              <p className="text-xs text-muted-foreground">
                Precio Woolworths: ${selectedProduct.pricePerKg.toFixed(2)}/kg (editable)
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Añadir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
