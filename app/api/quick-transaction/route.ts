import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

// Quick-add endpoint for the iPhone Shortcut: tap the shortcut right after
// seeing an Apple Wallet payment notification, type the amount, and it lands
// here as a transaction in Supabase.
//
// Auth: accepts the shared secret EITHER as an "Authorization: Bearer <secret>"
// header, OR as a plain "secret" field in the JSON body. The body option exists
// because typing header values inside iOS Shortcuts is error-prone (autocapitalize,
// stray spaces) — putting it in the JSON body alongside amount/description/category
// is much more reliable from the Shortcuts app.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const expectedSecret = process.env.QUICK_ADD_SECRET
  const authHeader = req.headers.get("authorization")
  const headerOk = !!expectedSecret && authHeader === `Bearer ${expectedSecret}`
  const bodySecret = typeof body.secret === "string" ? body.secret.trim() : ""
  const bodyOk = !!expectedSecret && bodySecret === expectedSecret

  if (!expectedSecret || (!headerOk && !bodyOk)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const amountRaw = Number(body.amount)
  if (!body.amount || Number.isNaN(amountRaw) || amountRaw === 0) {
    return NextResponse.json(
      { error: "amount is required and must be a non-zero number" },
      { status: 400 },
    )
  }

  // type: "ingreso" -> positive. Anything else (or missing) -> "gasto", negative.
  // This mirrors the automatic sign behaviour of the Economía form in the app.
  const type = body.type === "ingreso" ? "ingreso" : "gasto"
  const amount = type === "ingreso" ? Math.abs(amountRaw) : -Math.abs(amountRaw)

  const category =
    typeof body.category === "string" &&
    (TRANSACTION_CATEGORIES as readonly string[]).includes(body.category)
      ? body.category
      : "Otros"

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
