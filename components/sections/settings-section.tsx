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
      const fetchedData = await fetchWebhookData()

      if (!Array.isArray(fetchedData) || fetchedData.length === 0) {
        setImportMessage({ text: "No hay transacciones para importar", type: "error" })
        setImporting(false)
        setTimeout(() => setImportMessage(null), 4000)
        return
      }

      // Filter and validate rows
      const existingDates = new Set(
        (data.transactions || []).map((t: Transaction) => `${t.date}-${t.category}-${t.amount}`),
      )
      let importedCount = 0
      let skippedCount = 0

      // Helper to parse date from string
      const parseDate = (dateStr: string | undefined): string | null => {
        if (!dateStr || typeof dateStr !== "string" || dateStr.trim() === "") return null
        
        if (dateStr.includes("/")) {
          const dateParts = dateStr.split("/")
          if (dateParts.length === 3) {
            const [day, month, year] = dateParts
            return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          }
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return dateStr
        }
        return null
      }

      // Helper to find date from nearby rows in same week
      const findDateInWeek = (weekNum: number, startIdx: number): string | null => {
        // Look forward and backward from current position to find a date in the same week
        for (let j = Math.max(0, startIdx - 10); j < Math.min(fetchedData.length, startIdx + 10); j++) {
          const checkRow = fetchedData[j]
          if (!Array.isArray(checkRow)) continue
          const checkWeek = checkRow[0]
          const checkDate = parseDate(checkRow[3])
          if (checkWeek === weekNum && checkDate) {
            return checkDate
          }
        }
        return null
      }

      for (let i = 0; i < fetchedData.length; i++) {
        const row = fetchedData[i]
        
        if (!Array.isArray(row)) {
          skippedCount++
          continue
        }

        // Array format: [week, category, amount, date, ...]
        const week = row[0]
        const category = (row[1] || "").trim()
        const amount = row[2]
        const dateStr = row[3]

        // Skip header rows: category is empty, "Week", "Category", "WEEK", "TOTAL", or "SUMMARY"
        if (
          !category ||
          category === "Category" ||
          category === "Week" ||
          category.includes("WEEK") ||
          category.includes("TOTAL") ||
          category.includes("SUMMARY")
        ) {
          skippedCount++
          continue
        }

        // Validate: amount must be a number
        const amountNum = typeof amount === "number" ? amount : parseFloat(amount)
        
        if (isNaN(amountNum)) {
          skippedCount++
          continue
        }

        // Parse date - try row's date first, then look for date in same week
        let isoDate = parseDate(dateStr)
        
        if (!isoDate && typeof week === "number") {
          // Try to find date from nearby rows in the same week
          isoDate = findDateInWeek(week, i)
        }

        // If still no date, skip this row (don't use current date as fallback)
        if (!isoDate) {
          skippedCount++
          continue
        }

        // Check for duplicates
        const transactionKey = `${isoDate}-${category.trim()}-${amountNum}`
        if (existingDates.has(transactionKey)) {
          skippedCount++
          continue
        }

        // Add transaction
        try {
          addTransaction({
            description: category.trim(),
            amount: amountNum,
            category: category.trim() as Transaction["category"],
            date: isoDate,
          })
          importedCount++
          existingDates.add(transactionKey)
        } catch (err) {
          skippedCount++
        }
      }

      setImportMessage({
        text: `Se encontraron ${fetchedData.length} filas. Importadas: ${importedCount}, Saltadas: ${skippedCount}`,
        type: "success",
      })
    } catch (err) {
      setImportMessage({
        text: "Error al importar historial. Verifica tu conexión.",
        type: "error",
      })
    } finally {
      setImporting(false)
      setTimeout(() => setImportMessage(null), 5000)
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
