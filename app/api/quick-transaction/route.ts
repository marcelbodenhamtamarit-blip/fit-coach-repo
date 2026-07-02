import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

// Quick-add endpoint for the iPhone Shortcut: tap the shortcut right after
// seeing an Apple Wallet payment notification, type the amount, and it lands
// here as a transaction in Supabase.
//
// Auth: accepts the shared secret via (in order of preference):
//   1. Query string:  ?secret=xxx   <- simplest, recommended for iOS Shortcuts
//   2. JSON body field "secret" (any capitalisation)
//   3. "Authorization: Bearer xxx" header
//
// Field name matching is forgiving of both capitalisation AND stray
// whitespace in the key (iOS Shortcuts sometimes adds a trailing space to
// field names, e.g. "Amount " instead of "Amount").
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

  const amountRaw = Number(body.amount)
  if (!body.amount || Number.isNaN(amountRaw) || amountRaw === 0) {
    return NextResponse.json(
      {
        error: "amount is required and must be a non-zero number",
        debug: {
          receivedKeys: Object.keys(body),
          amountValue: body.amount === undefined ? "(missing)" : body.amount,
          amountType: typeof body.amount,
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

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : "Compra con tarjeta (Wallet)"

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
