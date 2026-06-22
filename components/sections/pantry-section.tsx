"use client"

import { useState } from "react"
import { Plus, Trash2, Refrigerator, CreditCard as Edit2, Check, X } from "lucide-react"
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

export function PantrySection() {
  const { data, addPantryItem, removePantryItem } = useStore()
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
  const [calories, setCalories] = useState("")
  const [protein, setProtein] = useState("")
  const [carbs, setCarbs] = useState("")
  const [fat, setFat] = useState("")
  const [price, setPrice] = useState("")

  const submit = () => {
    if (!name.trim() || !quantity) return

    onAdd({
      name: name.trim(),
      quantityGrams: Number(quantity) || 0,
      caloriesPer100g: Number(calories) || 0,
      proteinPer100g: Number(protein) || 0,
      carbsPer100g: Number(carbs) || 0,
      fatPer100g: Number(fat) || 0,
      pricePerKg: Number(price) || 0,
    })

    setName("")
    setQuantity("")
    setCalories("")
    setProtein("")
    setCarbs("")
    setFat("")
    setPrice("")
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
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nombre</Label>
            <Input
              id="p-name"
              placeholder="Ej: Arroz, Pollo, Tomate"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-qty">Cantidad (gramos)</Label>
            <Input
              id="p-qty"
              type="number"
              placeholder="500"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
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
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit}>Añadir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
