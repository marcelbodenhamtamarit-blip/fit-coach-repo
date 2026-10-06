import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// El backup histórico a Google Sheets (ver README, "Historic transaction
// data") se mandaba con fetch(..., {mode:"no-cors"}) directo desde el
// navegador a una URL de Apps Script hardcodeada en economy-section.tsx /
// batch-add-dialog.tsx — visible en el JS servido a cualquiera, sin pasar
// por ninguna sesión. Este route hace la misma llamada best-effort pero
// desde el servidor, con la URL en una env var sin NEXT_PUBLIC_, y exige la
// sesión de Supabase del propio usuario (igual que /api/push/test).
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    return NextResponse.json({ error: "Falta la sesión (Authorization: Bearer <token>)" }, { status: 401 })
  }

  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: userData, error: userError } = await anonClient.auth.getUser(token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Sesión no válida" }, { status: 401 })
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK
  if (!webhookUrl) {
    // Sin la env var no hay backup configurado en este deploy — no es un
    // error del cliente, Supabase sigue siendo la fuente de verdad.
    return NextResponse.json({ ok: true, skipped: true })
  }

  // La hoja es la del dueño (#6: recibía los movimientos de TODOS los
  // usuarios). Solo se reenvía si el email de la sesión es el de
  // NEXT_PUBLIC_OWNER_EMAIL — la misma que usan lib/use-auth.tsx y el
  // coach. Sin esa env var no se reenvía nada (fail-closed).
  const owner = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").trim().toLowerCase()
  const email = (userData.user.email ?? "").trim().toLowerCase()
  if (!owner || email !== owner) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const body = await req.json().catch(() => null)
  const week = Number(body?.week)
  const category = typeof body?.category === "string" ? body.category.slice(0, 50) : ""
  const amount = typeof body?.amount === "string" ? body.amount.slice(0, 30) : ""
  const date = typeof body?.date === "string" ? body.date.slice(0, 20) : ""
  if (!Number.isFinite(week) || !category || !amount || !date) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week, category, amount, date }),
    })
    return NextResponse.json({ ok: true })
  } catch {
    // Best-effort: si Apps Script falla o no responde, no debe bloquear
    // nada en el cliente — cada llamador decide cómo avisarlo.
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
