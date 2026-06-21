export const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

// Map Catalan and Spanish variants to canonical category names
const CATEGORY_MAPPING: Record<string, string> = {
  "TRANSPORT": "Transporte",
  "TRANSPORTE": "Transporte",
  "UBER": "Transporte",
  "COMIDA FUERA": "Comida fuera",
  "MENJAR FORA": "Comida fuera",
  "MENJAR": "Comida fuera",
  "COMIDA": "Comida fuera",
  "MENJAR SUPER": "Supermercado",
  "COMIDA SUPER": "Supermercado",
  "SUPER": "Supermercado",
  "NECESSITATS": "Necesidades",
  "NECESITATS": "Necesidades",
  "HOSTEL": "Alojamiento",
  "SHOPPING": "Compras",
  "COMPRES": "Compras",
  "ROBA": "Compras",
  "CHEMIST": "Compras",
  "PELU": "Otros",
  "Nomina": "Salario",
  "NOMINA": "Salario",
  "Pagament mes": "Salario",
  "GADGETS": "Compras",
}

export function mapCategory(rawCategory: string): string | null {
  const trimmed = rawCategory.trim().toUpperCase()
  
  // Check direct mapping
  if (CATEGORY_MAPPING[trimmed]) {
    return CATEGORY_MAPPING[trimmed]
  }
  
  // Check case-insensitive match for original mapping
  for (const [key, value] of Object.entries(CATEGORY_MAPPING)) {
    if (key.toUpperCase() === trimmed) {
      return value
    }
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
  
  if (validCategories.includes(rawCategory.trim())) {
    return rawCategory.trim()
  }
  
  return null
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
