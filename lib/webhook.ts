export const GOOGLE_SHEETS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbyA7cBEfe1vrWkclk4fKInoSa0hhenbC5iaCAzwl-rqOMEcOp1GLchAeeCstE1foBsx/exec"

export async function fetchWebhookData(sheet?: string): Promise<any> {
  try {
    const url = sheet
      ? `${GOOGLE_SHEETS_WEBHOOK}?sheet=${encodeURIComponent(sheet)}`
      : GOOGLE_SHEETS_WEBHOOK

    const response = await fetch(url, {
      method: "GET",
      mode: "no-cors",
    })

    // Try to parse response text
    try {
      const text = await response.text()
      if (text) {
        return JSON.parse(text)
      }
    } catch {
      // If parsing fails, return null
      return null
    }

    return null
  } catch (err) {
    console.log("[v0] Webhook fetch error:", err)
    return null
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
