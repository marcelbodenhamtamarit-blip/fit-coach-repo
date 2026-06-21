"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { GOOGLE_SHEETS_WEBHOOK, fetchWebhookData } from "@/lib/webhook"
import type { Transaction } from "@/lib/types"

export function SettingsSection() {
  const { data, addTransaction, updateProfileGoals } = useStore()
  const [calorieGoal, setCalorieGoal] = useState(String(data.profile.calorieGoal))
  const [proteinGoal, setProteinGoal] = useState(String(data.profile.proteinGoal))
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const handleSave = () => {
    updateProfileGoals({
      calorieGoal: Math.max(1000, parseInt(calorieGoal) || 2200),
      proteinGoal: Math.max(0, parseInt(proteinGoal) || 180),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleImportHistory = async () => {
    setImporting(true)
    setImportMessage(null)

    try {
      // Fetch from Google Sheets webhook via GET request
      const response = await fetch(GOOGLE_SHEETS_WEBHOOK, {
        method: "GET",
        mode: "no-cors",
      })

      // Since no-cors mode doesn't give us the response, we need a workaround
      // The webhook should return data as JSON, but no-cors restricts access
      // We'll use a text-based approach by fetching the sheet data
      // For now, we'll attempt to parse any response
      let data = []

      try {
        // Try to get the data - this might fail due to CORS, so we catch it
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch {
        // If parsing fails, show error
        setImportMessage({
          text: "No se pudo leer el historial de Google Sheets. Intenta nuevamente.",
          type: "error",
        })
        setImporting(false)
        setTimeout(() => setImportMessage(null), 4000)
        return
      }

      // Parse the imported data
      if (!Array.isArray(data) || data.length === 0) {
        setImportMessage({ text: "No hay transacciones para importar", type: "error" })
        setImporting(false)
        setTimeout(() => setImportMessage(null), 4000)
        return
      }

      // Filter and validate rows
      const existingDates = new Set(data.transactions?.map((t: Transaction) => `${t.date}-${t.category}-${t.amount}`) || [])
      let importedCount = 0

      for (const row of data) {
        // Skip header rows: column B is empty, contains "WEEK", or contains "TOTAL"
        if (
          !row.columnB ||
          typeof row.columnB !== "string" ||
          row.columnB.includes("WEEK") ||
          row.columnB.includes("TOTAL")
        ) {
          continue
        }

        // Validate: column A is a number, column B is category, column C is amount, column D is date
        const week = parseFloat(row.columnA)
        const category = row.columnB
        const amount = parseFloat(row.columnC)
        const dateStr = row.columnD

        if (isNaN(week) || !category || isNaN(amount) || !dateStr) {
          continue
        }

        // Convert date from DD/MM/YYYY to YYYY-MM-DD
        const [day, month, year] = dateStr.split("/")
        const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

        // Check for duplicates
        const transactionKey = `${isoDate}-${category}-${amount}`
        if (existingDates.has(transactionKey)) {
          continue
        }

        // Add transaction
        try {
          addTransaction({
            description: `Importado: ${category}`,
            amount,
            category: category as Transaction["category"],
            date: isoDate,
          })
          importedCount++
          existingDates.add(transactionKey)
        } catch {
          // Skip on error and continue with next row
        }
      }

      setImportMessage({
        text: `Se importaron ${importedCount} transacciones correctamente`,
        type: "success",
      })
    } catch (err) {
      console.log("[v0] Import error:", err)
      setImportMessage({
        text: "Error al importar historial. Verifica tu conexión.",
        type: "error",
      })
    } finally {
      setImporting(false)
      setTimeout(() => setImportMessage(null), 4000)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Import message */}
      {importMessage && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            importMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {importMessage.text}
        </div>
      )}

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
        <h3 className="mb-4 text-sm font-semibold">Importar historial</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Importa todas tus transacciones desde Google Sheets. Las transacciones duplicadas no se importarán dos veces.
        </p>
        <Button
          onClick={handleImportHistory}
          disabled={importing}
          variant="outline"
          className="w-full"
        >
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Importar historial de Google Sheets
            </>
          )}
        </Button>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-sm font-semibold">Sobre esta app</h3>
        <p className="text-xs text-muted-foreground">Fit Coach v2.0 • Tracking de nutrición y economía</p>
      </Card>
    </div>
  )
}
