"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle, Loader2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useStore } from "@/lib/store"
import { TRANSACTION_CATEGORIES, type Transaction } from "@/lib/types"

const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbzZN7UFMDOaHjPrYe6x4C9Q9EPytiaPq6Wmw5oWx5kAYbI7Z4O_oj-fWK149KCvgqeT/exec"

export function SettingsSection() {
  const { importTransactions } = useStore()
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ status: "success" | "error"; message: string } | null>(null)

  const handleImport = async () => {
    setImporting(true)
    setImportResult(null)
    try {
      const res = await fetch(SHEETS_URL)
      const json = await res.json()

      const rows: Omit<Transaction, "id">[] = []
      const raw: any[] = Array.isArray(json) ? json : json.data ?? []

      // Skip header row (first row)
      for (let i = 1; i < raw.length; i++) {
        const row = raw[i]
        
        // Column A (week)
        const weekRaw = Array.isArray(row) ? row[0] : row.week ?? row.A
        const weekStr = String(weekRaw || "").trim()
        
        // Skip if contains "WEEK" or "Bali" or is empty
        if (
          weekStr === "" ||
          weekStr.toUpperCase().includes("WEEK") ||
          weekStr.toUpperCase().includes("BALI")
        ) {
          continue
        }

        // Column B (category)
        const categoryRaw = Array.isArray(row) ? row[1] : row.category ?? row.B
        const categoryStr = String(categoryRaw || "").trim()
        
        // Skip if empty or undefined
        if (!categoryStr) {
          continue
        }

        // Column C (amount)
        const amountRaw = Array.isArray(row) ? row[2] : row.amount ?? row.C
        const amount = parseFloat(String(amountRaw || ""))
        
        // Skip if not a number, is 0, or empty
        if (isNaN(amount) || amount === 0) {
          continue
        }

        // Column D (date)
        const dateRaw = Array.isArray(row) ? row[3] : row.date ?? row.D
        let dateStr = String(dateRaw || "").trim()
        
        // Try to parse date — support formats like "22/06/2026" or "2026-06-22"
        let date = ""
        if (dateStr) {
          if (dateStr.includes("/")) {
            // "DD/MM/YYYY" -> "YYYY-MM-DD"
            const parts = dateStr.split("/")
            if (parts.length === 3) {
              const [day, month, year] = parts
              date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
            }
          } else if (dateStr.includes("-")) {
            // Already in "YYYY-MM-DD" format or similar
            date = dateStr.slice(0, 10)
          }
        }
        
        // Default to today if date parsing failed
        if (!date || isNaN(new Date(date).getTime())) {
          date = new Date().toISOString().slice(0, 10)
        }

        // Validate category
        const validCategory = TRANSACTION_CATEGORIES.includes(categoryStr as any)
          ? (categoryStr as Transaction["category"])
          : "Otros"

        rows.push({
          description: categoryStr,
          category: validCategory,
          amount,
          date,
        })
      }

      const count = importTransactions(rows)
      setImportResult({
        status: "success",
        message: `Se han importado ${count} transacción${count !== 1 ? "es" : ""} nuevas.`,
      })
    } catch {
      setImportResult({
        status: "error",
        message: "No se pudieron importar los datos. Comprueba la conexión.",
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Google Sheets import */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-semibold">Datos económicos</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Importa las transacciones existentes desde Google Sheets. Se omiten filas duplicadas y filas mal formadas.
        </p>

        {importResult && (
          <div
            className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
              importResult.status === "success"
                ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {importResult.status === "success" ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{importResult.message}</span>
          </div>
        )}

        <Button onClick={handleImport} disabled={importing} variant="outline" className="w-full">
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Importar datos
            </>
          )}
        </Button>
      </Card>

      {/* Instructions */}
      <Card className="p-6">
        <h3 className="mb-3 text-sm font-semibold">Formato de Google Sheets</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Columna A (Semana):</span> Número de semana o dejar vacío para omitir.
          </li>
          <li>
            <span className="font-medium text-foreground">Columna B (Categoría):</span> Categoría de la transacción (obligatorio).
          </li>
          <li>
            <span className="font-medium text-foreground">Columna C (Cantidad):</span> Monto en AUD, negativo para gastos, positivo para ingresos (obligatorio).
          </li>
          <li>
            <span className="font-medium text-foreground">Columna D (Fecha):</span> Fecha en formato DD/MM/YYYY o YYYY-MM-DD (opcional, usa hoy por defecto).
          </li>
          <li>
            Se omiten filas con "WEEK" o "Bali" en la columna A, así como filas con valores 0 o vacíos en cantidad.
          </li>
        </ul>
      </Card>
    </div>
  )
}
