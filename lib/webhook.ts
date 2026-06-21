export const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

// Map Catalan and Spanish variants to canonical category names
const CATEGORY_MAPPING: Record<string, string> = {
  // Transporte
  "TRANSPORTE": "Transporte",
  "TRANSPORT": "Transporte",
  "UBER": "Transporte",
  
  // Compras / Shopping
  "GADGETS": "Compras",
  "CARGADOR MVL": "Compras",
  "SHOPPING": "Compras",
  "COMPRAS": "Compras",
  "COMPRES": "Compras",
  
  // Supermercado / Comida
  "COMIDA": "Supermercado",
  "MENJAR": "Supermercado",
  "MENJAR SUPER": "Supermercado",
  "MENJAR FORA": "Comida fuera",
  "COMIDA FUERA": "Comida fuera",
  "COMIDA SUPER": "Supermercado",
  "SUPER": "Supermercado",
  
  // Necesidades
  "NECESSITATS": "Necesidades",
  "NECESIDADES": "Necesidades",
  "WHITE CARD": "Necesidades",
  "CHEMIST": "Necesidades",
  "PANTALONES FEINA": "Necesidades",
  
  // Alojamiento
  "HOSTEL": "Alojamiento",
  
  // Salario
  "NOMINA": "Salario",
  "PAGAMENT MES": "Salario",
  
  // Ocio
  "ENTRETENIMIENTO": "Ocio",
  
  // Otros
  "BALI": "Otros",
}

export function mapCategory(rawCategory: string): string | null {
  const trimmed = rawCategory.trim().toUpperCase()
  
  // Check direct mapping
  if (CATEGORY_MAPPING[trimmed]) {
    return CATEGORY_MAPPING[trimmed]
  }
  
  // If already matches a valid category, return as-is
  const validCategories = [
    "Alojamiento",
    "Supermercado",
    "Comida fuera",
    "Transporte",
    "Salario",
    "Compras",
    "Necesidades",
    "Ocio",
    "Otros",
  ]
  
  const trimmedOriginal = rawCategory.trim()
  if (validCategories.includes(trimmedOriginal)) {
    return trimmedOriginal
  }
  
  return null
}

// Parse amount with comma as decimal separator
export function parseAmount(amountStr: string | number): number | null {
  if (typeof amountStr === "number") {
    return isNaN(amountStr) ? null : amountStr
  }
  
  const str = String(amountStr).trim()
  if (!str) return null
  
  // Replace comma with dot for decimal parsing
  const normalized = str.replace(",", ".")
  const num = parseFloat(normalized)
  
  return isNaN(num) ? null : num
}

// Parse date from DD/MM/YYYY format to YYYY-MM-DD
export function parseGoogleSheetsDate(dateStr: string | number): string | null {
  if (!dateStr) return null
  
  const str = String(dateStr).trim()
  if (!str) return null
  
  // Try DD/MM/YYYY format
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, day, month, year] = match
    const d = String(day).padStart(2, "0")
    const m = String(month).padStart(2, "0")
    return `${year}-${m}-${d}`
  }
  
  return null
}

// Get date fallback for week number
export function getWeekDateFallback(week: number): string {
  const fallbacks: Record<number, string> = {
    1: "2026-04-16",   // 16/04/2026
    13: "2026-06-28",  // 28/06/2026
    10: "2026-06-10",  // 10/06/2026 for Bali
  }
  
  if (week in fallbacks) {
    return fallbacks[week]
  }
  
  return null as any
}

export async function fetchWebhookData(sheet?: string): Promise<any[]> {
  try {
    const url = sheet
      ? `${GOOGLE_SHEETS_WEBHOOK}?sheet=${encodeURIComponent(sheet)}`
      : GOOGLE_SHEETS_WEBHOOK

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    })

    const text = await response.text()

    if (!text) {
      return []
    }

    try {
      const parsed = JSON.parse(text)
      
      if (Array.isArray(parsed)) {
        return parsed
      } else if (parsed && typeof parsed === "object") {
        return [parsed]
      }
      return []
    } catch (parseErr) {
      return []
    }
  } catch (err) {
    return []
  }
}

export async function postWebhookData(data: any): Promise<boolean> {
  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {})

    return true
  } catch {
    return false
  }
}
