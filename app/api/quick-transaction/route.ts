import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { TRANSACTION_CATEGORIES } from "@/lib/types"

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

const CATEGORY_KEYWORDS: Array<{ category: (typeof TRANSACTION_CATEGORIES)[number]; keywords: string[] }> = [
  { category: "Supermercado", keywords: ["woolworths", "coles", "aldi", "iga", "supermercado", "super"] },
  { category: "Comida fuera", keywords: ["uber eats", "menulog", "doordash", "restaurant", "restaurante", "cafe", "mcdonald", "kfc", "subway", "pizza", "sushi"] },
  { category: "Transporte", keywords: ["uber", "taxi", "myki", "opal", "translink", "gasolina", "combustible", "bp", "shell", "caltex", "parking", "estacionamiento"] },
  { category: "Alojamiento", keywords: ["rent", "alquiler", "airbnb", "hotel", "hostel"] },
  { category: "Ocio", keywords: ["netflix", "spotify", "cinema", "cine", "steam", "playstation", "xbox"] },
  { category: "Compras", keywords: ["amazon", "ebay", "kmart", "target", "big w", "jb hi-fi"] },
]

function inferCategory(text: string): (typeof TRANSACTION_CATEGORIES)[number] | null {
  const norm = normalize(text)
  for (const item of CATEGORY_KEYWORDS) {
    if (item.keywords.some((k) => norm.includes(normalize(k)))) return item.category
  }
  return null
}

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

  let amountRaw = Number(body.amount)
  let sourceText = ""

  if (!body.amount || Number.isNaN(amountRaw) || amountRaw === 0) {
    const notifTitle = typeof body.title === "string" ? body.title : ""
    const notifSubtitle = typeof body.subtitle === "string" ? body.subtitle : ""
    const notifBody = typeof body.body === "string" ? body.body : ""
    sourceText = `${notifBody} ${notifSubtitle} ${notifTitle}`.trim()

    const match = sourceText.match(/(-?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/)
    if (match) {
      const cleaned = match[1]
        .replace(/\$/g, "")
        .replace(/\s/g, "")
        .replace(/,(?=\d{2}$)/, ".")
        .replace(/,(?=\d{3})/g, "")
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

  const explicitDescription =
    typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : ""
  const notifDescription = [body.subtitle, body.title]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .join(" - ")
  const description = explicitDescription || notifDescription || "Compra con tarjeta (Wallet)"

  const categoryRaw = typeof body.category === "string" ? body.category.trim() : ""
  const matchedCategory = categoryRaw
    ? (TRANSACTION_CATEGORIES as readonly string[]).find(
        (c) => normalize(c) === normalize(categoryRaw),
      )
    : undefined

  const inferSource = [
    typeof body.description === "string" ? body.description : "",
    typeof body.subtitle === "string" ? body.subtitle : "",
    typeof body.title === "string" ? body.title : "",
    sourceText,
  ].join(" ")
  const category = matchedCategory ?? inferCategory(inferSource) ?? "Otros"

  const dateRaw = typeof body.date === "string" ? body.date.trim() : ""
  const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : new Date().toISOString().slice(0, 10)

  // Programación opcional:
  //   weekOffset -> mueve el gasto N semanas hacia adelante (pagado hoy, pero
  //                 pertenece a una semana posterior: weekOffset=1)
  //   weeks      -> divide el importe a partes iguales entre N semanas seguidas
  //                 (pagar 2 semanas de hostel por adelantado: weeks=2)
  // Ambos opcionales y combinables. Sin ellos, el comportamiento no cambia.
  const weeksRaw = Number(body.weeks)
  const weeks = Number.isFinite(weeksRaw) && weeksRaw >= 1 ? Math.floor(weeksRaw) : 1
  const offsetRaw = Number(body.weekoffset ?? body.weekOffset)
  const weekOffset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.floor(offsetRaw) : 0

  function addWeeks(iso: string, n: number): string {
    const d = new Date(iso + "T00:00:00")
    d.setDate(d.getDate() + n * 7)
    return d.toISOString().slice(0, 10)
  }

  // Divide manteniendo los céntimos exactos: el resto del redondeo va en la
  // primera fila, así las partes siempre suman el total original.
  const totalCents = Math.round(Math.abs(amount) * 100)
  const baseCents = Math.floor(totalCents / weeks)
  const remainder = totalCents - baseCents * weeks
  const sign = amount < 0 ? -1 : 1

  const rows = Array.from({ length: weeks }, (_, i) => {
    const cents = baseCents + (i === 0 ? remainder : 0)
    return {
      date: addWeeks(baseDate, weekOffset + i),
      description: weeks > 1 ? `${description} (${i + 1}/${weeks})` : description,
      category,
      amount: sign * (cents / 100),
    }
  })

  const { data, error } = await supabase.from("transactions").insert(rows).select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    transaction: data?.[0] ?? null,
    transactions: data,
  })
}
