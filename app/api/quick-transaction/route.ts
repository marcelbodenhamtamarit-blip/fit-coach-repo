import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

// Quick-add endpoint for the iPhone Shortcut.
//
// Two ways to call it:
//   A) Manual: body has "amount" (a number) directly — used by the
//      "ask the user" style shortcut.
//   B) Automatic (iOS 27+): body has raw "title"/"subtitle"/"body" text
//      straight from the Notification automation trigger (Apple Wallet
//      payment notification). The server extracts the amount from that
//      text with a regex, no user interaction required.
//
// Auth: shared secret via ?secret=xxx (preferred), a "secret" field in the
// JSON body, or an "Authorization: Bearer xxx" header.
export async function POST(req: NextRequest) {
  let rawBody: Record<string, unknown> = {}
  let rawText = ""
  try {
    rawText = await req.text()
    rawBody = rawText ? JSON.parse(rawText) : {}
  } catch {
    rawBody = {}
  }

  const body: Record<string, unknown> = {}
  for (const key of Object.keys(rawBody)) {
    body[key.trim().toLowerCase()] = rawBody[key]
  }

  const expectedSecret = process.env.QUICK_ADD_SECRET
  const querySecret = req.nextUrl.searchParams.get("secret")
  const authHeader = req.headers.get("authorization")
  const bodySecret = typeof body.secret === "string" ? body.secret.trim() : ""

  const queryOk = !!expectedSecret && querySecret === expectedSecret
  const headerOk = !!expectedSecret && authHeader === `Bearer ${expectedSecret}`
  const bodyOk = !!expectedSecret && bodySecret === expectedSecret

  if (!expectedSecret || (!queryOk && !headerOk && !bodyOk)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // --- Try direct "amount" field first (manual flow) ---
  let amountRaw = Number(body.amount)
  let sourceText = ""

  // --- Otherwise, try to extract an amount from raw notification text ---
  if (!body.amount || Number.isNaN(amountRaw) || amountRaw === 0) {
    const notifTitle = typeof body.title === "string" ? body.title : ""
    const notifSubtitle = typeof body.subtitle === "string" ? body.subtitle : ""
    const notifBody = typeof body.body === "string" ? body.body : ""
    sourceText = `${notifBody} ${notifSubtitle} ${notifTitle}`.trim()

    // Matches "$12.50", "12.50 AUD", "-$12.50", "$1,234.56", "12,50" (comma decimal), etc.
    const match = sourceText.match(/(-?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/)
    if (match) {
      const cleaned = match[1]
        .replace(/\$/g, "")
        .replace(/\s/g, "")
        .replace(/,(?=\d{2}$)/, ".") // trailing comma as decimal separator -> dot
        .replace(/,(?=\d{3})/g, "") // thousands comma -> remove
      amountRaw = Number(cleaned)
    }
  }

  if (!amountRaw || Number.isNaN(amountRaw) || amountRaw === 0) {
    return NextResponse.json(
      {
        error: "amount is required and must be a non-zero number",
        debug: {
          receivedKeys: Object.keys(body),
          amountValue: body.amount === undefined ? "(missing)" : body.amount,
          amountType: typeof body.amount,
          sourceTextTried: sourceText || null,
          rawBodyText: rawText.slice(0, 300),
        },
      },
      { status: 400 },
    )
  }

  const typeVal = typeof body.type === "string" ? body.type.trim().toLowerCase() : ""
  const type = typeVal === "ingreso" ? "ingreso" : "gasto"
  const amount = type === "ingreso" ? Math.abs(amountRaw) : -Math.abs(amountRaw)

  const categoryRaw = typeof body.category === "string" ? body.category.trim() : ""
  const matchedCategory = (TRANSACTION_CATEGORIES as readonly string[]).find(
    (c) => c.toLowerCase() === categoryRaw.toLowerCase(),
  )
  const category = matchedCategory ?? "Otros"

  // Description: prefer explicit "description", else build from notification
  // subtitle/title (typically the merchant / card name), else a generic fallback.
  const explicitDescription =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : ""
  const notifDescription = [body.subtitle, body.title]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" — ")
  const description = explicitDescription || notifDescription || "Compra con tarjeta (Wallet)"

  const dateRaw = typeof body.date === "string" ? body.date.trim() : ""
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("transactions")
    .insert({ date, description, category, amount })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, transaction: data })
}
