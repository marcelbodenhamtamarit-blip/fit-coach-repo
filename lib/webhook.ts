export const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

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
