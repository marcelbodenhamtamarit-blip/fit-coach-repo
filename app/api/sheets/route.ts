import { NextResponse } from "next/server"

const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

interface ImportedTransaction {
  week: number
  category: string
  amount: number
  date: string
  description: string
}

// Parse DD/MM/YYYY to YYYY-MM-DD
function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
}

// Get fallback date for a week number (Marcel's week calendar)
function getWeekFallbackDate(weekNum: number): string {
  const weekDates: Record<number, string> = {
    1: "2026-04-09",
    2: "2026-04-16",
    3: "2026-04-23",
    4: "2026-04-30",
    5: "2026-05-07",
    6: "2026-05-14",
    7: "2026-05-21",
    8: "2026-05-28",
    9: "2026-06-04",
    10: "2026-06-11",
    11: "2026-06-18",
    12: "2026-06-25",
    13: "2026-07-02",
  }
  return weekDates[weekNum] || "2026-04-09"
}

export async function GET() {
  try {
    const response = await fetch(WEBHOOK_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const text = await response.text()
    const transactions = parseData(text)
    return NextResponse.json({
      transactions,
      summary: calculateSummary(transactions),
    })
  } catch (error: any) {
    console.error("[Sheets Import Error]:", error)
    return NextResponse.json({
      transactions: [],
      summary: { totalIncome: 0, totalExpenses: 0, savings: 0, transactionCount: 0 },
      error: error.message,
    })
  }
}

function parseData(text: string): ImportedTransaction[] {
  // Try JSON first (2D array from Google Sheets)
  try {
    const json = JSON.parse(text)
    if (Array.isArray(json)) {
      return parseSheetsArray(json as any[][])
    }
    if (json.data && Array.isArray(json.data)) {
      return parseSheetsArray(json.data)
    }
    if (json.transactions && Array.isArray(json.transactions)) {
      return parseSheetsArray(json.transactions)
    }
  } catch {
    // Not JSON, parse as CSV
  }
  return parseCSV(text)
}

// Parse 2D array from Google Sheets
// Format: [week, category, amount, date, ...]
function parseSheetsArray(rows: any[][]): ImportedTransaction[] {
  const transactions: ImportedTransaction[] = []
  const seenKeys = new Set<string>()
  let currentWeek = 0

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 3) continue

    const col0 = String(row[0] || "").trim()
    const col1 = String(row[1] || "").trim()
    const col2 = String(row[2] || "").trim()
    const col3 = String(row[3] || "").trim()

    // Check if this is a week header row (column B contains "WEEK X...")
    if (/^WEEK\s*\d+/i.test(col1)) {
      continue
    }

    // Skip summary/header rows
    if (/^WEEK/i.test(col0) || /^WEEK/i.test(col1)) continue
    if (/^TOTAL/i.test(col0) || /^TOTAL/i.test(col1)) continue
    if (/^SUMMARY/i.test(col0) || /^SUMMARY/i.test(col1)) continue
    if (col1.toUpperCase() === "CATEGORY" || col1.toUpperCase() === "CATEGORIA") continue

    // Get week number from column A
    const weekNumRaw = parseInt(col0, 10)
    const weekNum = weekNumRaw > 0 ? weekNumRaw : currentWeek

    // Determine category
    const categoryRaw = col1
    if (!categoryRaw) continue

    // Parse amount - try column C or D
    let amount: number | null = null

    // Special case: Bali row (col1="Bali", col3 has the amount)
    if (categoryRaw.toLowerCase() === "bali") {
      const baliAmount = parseFloat(col3.replace(",", "."))
      if (!isNaN(baliAmount) && baliAmount !== 0) {
        const key = `2026-06-10-Otros-${baliAmount}`
        if (!seenKeys.has(key)) {
          seenKeys.add(key)
          transactions.push({
            week: 10,
            category: "Otros",
            amount: baliAmount,
            date: "2026-06-10",
            description: "Bali",
          })
        }
      }
      continue
    }

    // Normal parsing: amount is in column C
    const amountParsed = parseFloat(col2.replace(",", "."))
    if (!isNaN(amountParsed) && amountParsed !== 0) {
      amount = amountParsed
    } else {
      // Try column D for amount
      const altAmount = parseFloat(col3.replace(",", "."))
      if (!isNaN(altAmount) && altAmount !== 0) {
        amount = altAmount
      }
    }
    if (amount === null) continue

    // Determine date
    let finalDate: string
    const dateRaw = col3

    // Special case: Week 1 rows - use 09/04/2026
    if (weekNum === 1) {
      finalDate = "2026-04-09"
    }
    // Parse ISO date (contains "T")
    else if (dateRaw.includes("T")) {
      finalDate = dateRaw.slice(0, 10)
    }
    // Try DD/MM/YYYY format
    else if (dateRaw.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      const parsed = parseDate(dateRaw)
      finalDate = parsed || getWeekFallbackDate(weekNum)
    }
    // Use fallback date
    else {
      finalDate = getWeekFallbackDate(weekNum)
    }

    // Create unique key for deduplication
    const key = `${finalDate}-${categoryRaw}-${amount}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    transactions.push({
      week: weekNum,
      category: categoryRaw,
      amount,
      date: finalDate,
      description: categoryRaw,
    })
  }

  return transactions
}

function parseCSV(csv: string): ImportedTransaction[] {
  const lines = csv.split("\n").map(line => line.trim()).filter(Boolean)
  const transactions: ImportedTransaction[] = []
  const seenKeys = new Set<string>()
  let currentWeek = 0

  for (const line of lines) {
    // Parse CSV line handling quoted fields
    const parts: string[] = []
    let current = ""
    let inQuotes = false
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        parts.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    parts.push(current.trim())

    if (parts.length < 4) continue

    const [weekCol, categoryCol, amountCol, dateCol] = parts

    // Detect week header rows
    const weekMatch = weekCol.match(/WEEK\s*(\d+)/i)
    if (weekMatch) {
      currentWeek = parseInt(weekMatch[1], 10)
      continue
    }

    // Skip empty rows or header rows
    if (!categoryCol || /^WEEK/i.test(categoryCol) || /^TOTAL/i.test(categoryCol) || /^SUMMARY/i.test(categoryCol)) {
      continue
    }
    if (categoryCol.toUpperCase() === "CATEGORY" || categoryCol.toUpperCase() === "CATEGORIA") {
      continue
    }

    // Parse amount - replace comma with dot for decimal
    const amountStr = amountCol.replace(/\s/g, "").replace(",", ".")
    const amount = parseFloat(amountStr)
    if (isNaN(amount)) continue

    // Determine date
    let finalDate: string

    // Special case: Week 1 rows have no date - use 09/04/2026
    if (currentWeek === 1 && (!dateCol || dateCol.trim() === "")) {
      finalDate = "2026-04-09"
    }
    // Special case: Bali row - use 10/06/2026, category Otros, week 10
    else if (categoryCol.toLowerCase().includes("bali") && Math.abs(amount) >= 400) {
      const key = "2026-06-10-Otros-" + amount
      if (!seenKeys.has(key)) {
        seenKeys.add(key)
        transactions.push({
          week: 10,
          category: "Otros",
          amount,
          date: "2026-06-10",
          description: "Bali",
        })
      }
      continue
    }
    // Parse normal date
    else {
      const parsed = parseDate(dateCol)
      finalDate = parsed || getWeekFallbackDate(currentWeek)
    }

    // Create unique key for deduplication
    const key = `${finalDate}-${categoryCol}-${amount}`
    if (seenKeys.has(key)) continue
    seenKeys.add(key)

    transactions.push({
      week: currentWeek,
      category: categoryCol,
      amount,
      date: finalDate,
      description: categoryCol,
    })
  }

  return transactions
}

function calculateSummary(transactions: ImportedTransaction[]) {
  const totalIncome = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const savings = totalIncome - totalExpenses

  return {
    totalIncome,
    totalExpenses,
    savings,
    transactionCount: transactions.length,
  }
}
