"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Edit2, Check, X, Loader2, RotateCw } from "lucide-react"
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
import { GOOGLE_SHEETS_WEBHOOK, fetchWebhookData, postWebhookData } from "@/lib/webhook"
import type { PantryItem } from "@/lib/types"

export function PantrySection() {
  const { data, addPantryItem, updatePantryItem, deletePantryItem } = useStore()
  const [toastError, setToastError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [useOpen, setUseOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshToast, setRefreshToast] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await fetchWebhookData("Despensa")
      if (data && Array.isArray(data)) {
        for (const row of data) {
          if (
            row.columnB &&
            typeof row.columnB === "string" &&
            !row.columnB.includes("WEEK") &&
            !row.columnB.includes("TOTAL")
          ) {
            const name = row.columnA
            const quantity = parseFloat(row.columnB)
            const pricePerKg = parseFloat(row.columnC)

            if (name && !isNaN(quantity) && !isNaN(pricePerKg)) {
              const exists = (data.pantry || []).some(
                (p: PantryItem) =>
                  p.name === name && p.quantityGrams === quantity,
              )

              if (!exists) {
                addPantryItem({
                  name,
                  quantityGrams: quantity,
                  pricePerKg,
                })
              }
            }
          }
        }
      }
    } catch (err) {
      console.log("[v0] Pantry refresh error:", err)
    } finally {
      setRefreshing(false)
      setRefreshToast(true)
      setTimeout(() => setRefreshToast(false), 2000)
    }
  }

  return (
    <div className="space-y-5">
      {/* Refresh toast */}
      {refreshToast && (
        <div className="flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Actualizado
        </div>
      )}

      {/* Error toast */}
      {toastError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {toastError}
        </div>
      )}

      {/* Top buttons */}
      <div className="flex gap-3">
        <AddPantryDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdd={(item) => {
            addPantryItem(item)
            syncToDespensa("compra", item)
            setAddOpen(false)
          }}
          onError={(msg) => {
            setToastError(msg)
            setTimeout(() => setToastError(null), 3000)
          }}
        />
        <UsePantryDialog
          open={useOpen}
          onOpenChange={setUseOpen}
          pantryItems={data.pantry}
          onUse={(item, quantityUsed) => {
            const newQuantity = item.quantityGrams - quantityUsed
            if (newQuantity <= 0) {
              deletePantryItem(item.id)
            } else {
              updatePantryItem(item.id, { quantityGrams: newQuantity })
            }
            syncToDespensa("uso", {
              ...item,
              quantityGrams: quantityUsed,
            })
            setUseOpen(false)
          }}
          onError={(msg) => {
            setToastError(msg)
            setTimeout(() => setToastError(null), 3000)
          }}
        />
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="icon"
          title="Sincronizar con Google Sheets"
        >
          <RotateCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stock list */}
      {data.pantry.length === 0 ? (
        <Card className="flex flex-col items-center justify-center border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No hay productos en la despensa</p>
        </Card>
      ) : (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Stock actual</h2>
          <div className="space-y-2">
            {data.pantry.map((item) => {
              const remainingValue = (item.pricePerKg * item.quantityGrams) / 1000
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.quantityGrams}g</p>
                  </div>
                  <div className="text-right font-mono text-sm">
                    ${remainingValue.toFixed(2)}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => deletePantryItem(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )

  async function syncToDespensa(
    action: "compra" | "uso",
    item: Partial<PantryItem>,
  ) {
    try {
      const cost = (item.pricePerKg! * item.quantityGrams!) / 1000
      const date = todayISO().split("-").reverse().join("/")
      
      await postWebhookData({
        sheet: "Despensa",
        action,
        product: item.name,
        quantity: item.quantityGrams,
        price: cost,
        date,
      })
    } catch (err) {
      console.log("[v0] Despensa sync error:", err)
    }
  }
}

function AddPantryDialog({
  open,
  onOpenChange,
  onAdd,
  onError,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onAdd: (item: PantryItem) => void
  onError: (msg: string) => void
}) {
  const [search, setSearch] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unit, setUnit] = useState<"g" | "kg">("g")
  const [price, setPrice] = useState("")
  const [priceUnit, setPriceUnit] = useState<"kg" | "unit">("kg")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)

  const handleSearch = async (term: string) => {
    if (!term.trim() || term.length < 2) {
      setResults([])
      return
    }
    
    setSearching(true)
    try {
      const res = await fetch(
        `https://www.woolworths.com.au/apis/ui/Search/products?searchTerm=${encodeURIComponent(term)}&pageNumber=1&pageSize=3`,
      )
      const data = await res.json()
      setResults(data.products || [])
    } catch (err) {
      onError("No se pudo buscar en Woolworths")
    } finally {
      setSearching(false)
    }
  }

  const handleAdd = () => {
    if (!selected || !quantity || !price) {
      onError("Completa todos los campos")
      return
    }

    let quantityGrams = parseFloat(quantity)
    if (unit === "kg") quantityGrams *= 1000

    const pricePerKg =
      priceUnit === "unit"
        ? parseFloat(price)
        : parseFloat(price) / (quantityGrams / 1000)

    const item: PantryItem = {
      id: uid(),
      name: selected.name,
      quantityGrams,
      caloriesPer100g: selected.caloriesPer100g || 0,
      proteinPer100g: selected.proteinPer100g || 0,
      carbsPer100g: selected.carbsPer100g || 0,
      fatPer100g: selected.fatPer100g || 0,
      pricePerKg,
      dateAdded: todayISO(),
    }

    onAdd(item)
    setSearch("")
    setQuantity("")
    setPrice("")
    setSelected(null)
    setResults([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Añadir a despensa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selected ? selected.name : "Añadir a despensa"}
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

            {results.length > 0 && (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {results.map((product) => (
                  <button
                    key={product.code}
                    onClick={() => setSelected(product)}
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
                ${selected.price?.toFixed(2) || "N/A"}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Cantidad comprada</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="flex-1"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as "g" | "kg")}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Precio</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="flex-1"
                />
                <select
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value as "kg" | "unit")}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="kg">$/kg</option>
                  <option value="unit">$total</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelected(null)
                  setSearch("")
                }}
              >
                Volver
              </Button>
              <Button onClick={handleAdd} className="flex-1">
                Guardar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function UsePantryDialog({
  open,
  onOpenChange,
  pantryItems,
  onUse,
  onError,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pantryItems: PantryItem[]
  onUse: (item: PantryItem, quantityUsed: number) => void
  onError: (msg: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState("")

  const selected = pantryItems.find((i) => i.id === selectedId)

  const handleUse = () => {
    if (!selected || !quantity) {
      onError("Selecciona producto y cantidad")
      return
    }

    const qty = parseFloat(quantity)
    if (qty > selected.quantityGrams) {
      onError("No hay suficiente cantidad")
      return
    }

    onUse(selected, qty)
    setSelectedId(null)
    setQuantity("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4" /> Usar de despensa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Usar de despensa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Producto</Label>
            <select
              value={selectedId || ""}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setQuantity("")
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecciona producto...</option>
              {pantryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.quantityGrams}g)
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="space-y-1.5">
              <Label>Cantidad a usar (g)</Label>
              <Input
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                max={selected.quantityGrams}
              />
              <p className="text-xs text-muted-foreground">
                Disponible: {selected.quantityGrams}g
              </p>
            </div>
          )}

          <Button
            onClick={handleUse}
            disabled={!selected || !quantity}
            className="w-full"
          >
            Usar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
