"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"

export function SettingsSection() {
  const { data, updateProfileGoals } = useStore()
  const [calorieGoal, setCalorieGoal] = useState(String(data.profile.calorieGoal))
  const [proteinGoal, setProteinGoal] = useState(String(data.profile.proteinGoal))
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    updateProfileGoals({
      calorieGoal: Math.max(1000, parseInt(calorieGoal) || 2200),
      proteinGoal: Math.max(0, parseInt(proteinGoal) || 180),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Mis objetivos</h2>
        <p className="mb-5 text-sm text-muted-foreground">Actualiza tus objetivos diarios de nutrición</p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="calorie-goal" className="text-sm font-medium">
              Objetivo de calorías (kcal/día)
            </Label>
            <p className="mb-2 text-xs text-muted-foreground">Ingesta calórica diaria recomendada</p>
            <Input
              id="calorie-goal"
              type="number"
              min="1000"
              step="50"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="protein-goal" className="text-sm font-medium">
              Objetivo de proteína (g/día)
            </Label>
            <p className="mb-2 text-xs text-muted-foreground">Ingesta de proteína diaria recomendada</p>
            <Input
              id="protein-goal"
              type="number"
              min="0"
              step="5"
              value={proteinGoal}
              onChange={(e) => setProteinGoal(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            {saved ? "Guardado" : "Guardar cambios"}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold">Sobre esta app</h3>
        <p className="text-xs text-muted-foreground">Fit Coach v2.0 • Tracking de nutrición y economía</p>
      </Card>
    </div>
  )
}
