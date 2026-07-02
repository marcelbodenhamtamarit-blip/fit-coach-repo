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
export async function POST(req: NextRequest) {
  let rawBody: Record<string, unknown> = {}
  try {
    rawBody = await req.json()
  } catch {
    rawBody = {}
  }

  const body: Record<string, unknown> = {}
  for (const key of Object.keys(rawBody)) {
    body[key.toLowerCase()] = rawBody[key]
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
      { error: "amount is required and must be a non-zero number" },
      { status: 400 },
    )
  }

  const typeVal = typeof body.type === "string" ? body.type.toLowerCase() : ""
  const type = typeVal === "ingreso" ? "ingreso" : "gasto"
  const amount = type === "ingreso" ? Math.abs(amountRaw) : -Math.abs(amountRaw)

  const categoryRaw = typeof body.category === "string" ? body.category : ""
  const matchedCategory = (TRANSACTION_CATEGORIES as readonly string[]).find(
    (c) => c.toLowerCase() === categoryRaw.toLowerCase(),
  )
  const category = matchedCategory ?? "Otros"

  const description =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : "Compra con tarjeta (Wallet)"

  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
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
