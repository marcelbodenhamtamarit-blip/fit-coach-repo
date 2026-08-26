import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Cliente con service_role: salta RLS, solo se usa en servidor.
// La request se autentica con QUICK_ADD_SECRET (atajo antiguo, un solo
// dueño) o con un token personal por usuario (tabla quick_add_tokens) más
// abajo.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

import { TRANSACTION_CATEGORIES } from "@/lib/types"
import { convertAmount } from "@/lib/exchange-rates"
import { sendPushToUser } from "@/lib/send-push.server"
import { resolveUserIdByQuickAddToken, touchQuickAddTokenLastUsed } from "@/lib/quick-add-token.server"

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

// Tope de seguridad por movimiento: si este endpoint quedara expuesto con
// un token filtrado, limita cuanto puede mover una sola peticion (en la
// divisa que sea, antes de cualquier conversion). 20.000 cubre con margen
// cualquier gasto/ingreso real de este grupo, asi que un valor por encima
// es casi con toda seguridad un error o un abuso, no un movimiento legitimo.
const MAX_AMOUNT = 20_000

// Mismo espiritu que MAX_AMOUNT, para otros campos que tambien podrian
// usarse para inundar la cuenta de datos basura si el token se filtrase:
// weeks (cuantas filas genera una sola llamada), weekOffset (cuanto se
// puede programar hacia el futuro) y el texto libre que llega en el body
// (titulo/cuerpo de notificacion, descripcion...).
const MAX_WEEKS = 52
const MAX_WEEK_OFFSET = 208 // ~4 anos vista, de sobra para programar un pago futuro
const MAX_TEXT_LEN = 300

// Cuantas filas puede insertar un mismo usuario en una ventana de tiempo,
// via este endpoint. No hace falta infraestructura nueva: se cuenta contra
// las filas que ya existen en `transactions` (columna created_at). Si un
// token se filtrase, esto acota el dano de una rafaga de peticiones
// ademas del tope por importe/semanas de arriba.
const RATE_LIMIT_WINDOW_MINUTES = 10
const RATE_LIMIT_MAX_INSERTS = 40

function clampText(v: unknown, max = MAX_TEXT_LEN): string {
  return typeof v === "string" ? v.slice(0, max) : ""
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

// Palabras que indican que el dinero entró (no salió). Solo se usa cuando el
// importe salió de leer el texto de una notificación sola (disparador
// "Notificación" de Atajos) — nunca pisa un `type` explícito que ya venga en
// la petición (atajo manual, Wallet automation antiguo). Sin esto, todo lo
// detectado por notificación se registraba siempre como gasto, incluso un
// ingreso (una transferencia recibida, un reembolso...).
const INCOME_KEYWORDS = [
  "recibido", "has recibido", "recibiste", "te han enviado", "te han pagado",
  "abonado", "abono", "depositado", "reembolso", "reembolsado",
  "transferencia recibida", "ingreso recibido",
  "received", "you've received", "you received", "credited", "credit received",
  "deposit", "deposited", "refund", "refunded", "transfer received",
  "incoming transfer", "payment received", "money received", "paid you", "sent you",
]

function inferTypeFromText(text: string): "ingreso" | "gasto" {
  const norm = normalize(text)
  return INCOME_KEYWORDS.some((k) => norm.includes(normalize(k))) ? "ingreso" : "gasto"
}

// El Shortcut nuevo (uno por usuario, generado desde Ajustes) manda todo
// por query string con un GET: más simple de construir desde la app
// Atajos que un body JSON. El Wallet automation antiguo sigue mandando un
// POST con JSON body. Unificamos ambos: query string primero, body encima
// si hay alguno con el mismo nombre (nunca coexisten en la práctica).
async function resolveParams(req: NextRequest): Promise<{ body: Record<string, unknown>; rawText: string }> {
  const fromQuery: Record<string, unknown> = {}
  req.nextUrl.searchParams.forEach((value, key) => {
    fromQuery[key.trim().toLowerCase()] = value
  })

  let rawBody: Record<string, unknown> = {}
  let rawText = ""
  if (req.method === "POST") {
    try {
      rawText = await req.text()
      rawBody = rawText ? JSON.parse(rawText) : {}
    } catch {
      rawBody = {}
    }
  }

  const body: Record<string, unknown> = { ...fromQuery }
  for (const key of Object.keys(rawBody)) {
    body[key.trim().toLowerCase()] = rawBody[key]
  }

  return { body, rawText }
}

async function resolveOwnerUserId(req: NextRequest, body: Record<string, unknown>): Promise<string | null> {
  // Vía 1 (nueva, multiusuario): token personal generado en Ajustes,
  // guardado en quick_add_tokens. Cada usuario tiene el suyo.
  const tokenRaw =
    (typeof body.token === "string" && body.token) ||
    req.headers.get("x-quick-add-token") ||
    ""
  const token = tokenRaw.trim()
  if (token) {
    const userId = await resolveUserIdByQuickAddToken(supabase, token)
    if (userId) {
      touchQuickAddTokenLastUsed(supabase, token)
      return userId
    }
  }

  // Vía 2 (antigua, un solo dueño): QUICK_ADD_SECRET + QUICK_ADD_OWNER_USER_ID,
  // pensada para el Wallet automation original. Se mantiene por compatibilidad.
  const expectedSecret = process.env.QUICK_ADD_SECRET
  const querySecret = req.nextUrl.searchParams.get("secret")
  const authHeader = req.headers.get("authorization")
  const bodySecret = typeof body.secret === "string" ? body.secret.trim() : ""

  const queryOk = !!expectedSecret && querySecret === expectedSecret
  const headerOk = !!expectedSecret && authHeader === `Bearer ${expectedSecret}`
  const bodyOk = !!expectedSecret && bodySecret === expectedSecret

  if (expectedSecret && (queryOk || headerOk || bodyOk)) {
    return process.env.QUICK_ADD_OWNER_USER_ID ?? null
  }

  return null
}

async function handle(req: NextRequest) {
  const { body, rawText } = await resolveParams(req)

  const ownerUserId = await resolveOwnerUserId(req, body)
  if (!ownerUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Limite de frecuencia: si ya se han insertado demasiadas filas para este
  // usuario en la ventana reciente, corta aqui antes de tocar nada mas. Si
  // esta consulta fallase por lo que sea, se deja pasar la peticion (mejor
  // no bloquear un alta legitima por un fallo de este chequeo aparte).
  const rateLimitWindowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { count: recentInserts, error: rateLimitError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerUserId)
    .gte("created_at", rateLimitWindowStart)

  if (!rateLimitError && (recentInserts ?? 0) >= RATE_LIMIT_MAX_INSERTS) {
    return NextResponse.json(
      { error: "Demasiadas peticiones seguidas. Espera unos minutos e intentalo de nuevo." },
      { status: 429 },
    )
  }

  let amountRaw = Number(body.amount)
  let sourceText = ""
  // true cuando el importe salió de leer el texto de una notificación
  // (disparador "Notificación" de Atajos, iOS 27+), no de un campo `amount`
  // explícito — es decir, el caso 100% silencioso sin pantalla de
  // confirmación. Se usa más abajo para avisar por push del sistema, ya
  // que aquí no hay ninguna pantalla de ZentOS que muestre el "Guardado".
  let detectedFromNotificationText = false

  if (!body.amount || Number.isNaN(amountRaw) || amountRaw === 0) {
    const notifTitle = clampText(body.title)
    const notifSubtitle = clampText(body.subtitle)
    const notifBody = clampText(body.body)
    sourceText = `${notifBody} ${notifSubtitle} ${notifTitle}`.trim()

    const match = sourceText.match(/(-?\$?\s?\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/)
    if (match) {
      const cleaned = match[1]
        .replace(/\$/g, "")
        .replace(/\s/g, "")
        .replace(/,(?=\d{2}$)/, ".")
        .replace(/,(?=\d{3})/g, "")
      amountRaw = Number(cleaned)
      detectedFromNotificationText = true
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

  if (Math.abs(amountRaw) > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `El importe supera el maximo permitido por movimiento (${MAX_AMOUNT.toLocaleString("es")}).` },
      { status: 400 },
    )
  }

  const typeVal = typeof body.type === "string" ? body.type.trim().toLowerCase() : ""
  const type =
    typeVal === "ingreso"
      ? "ingreso"
      : detectedFromNotificationText && inferTypeFromText(sourceText) === "ingreso"
        ? "ingreso"
        : "gasto"
  const rawAmount = type === "ingreso" ? Math.abs(amountRaw) : -Math.abs(amountRaw)

  // Divisa opcional (paso 5 del atajo manual puede mandar `currency`, p.ej.
  // desde un viaje). Si no coincide con la divisa principal del usuario, se
  // convierte aquí con el tipo de cambio del día y se guarda también el
  // importe original para poder mostrarlo tal cual en la app.
  const currencyRaw = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : ""

  let amount = rawAmount
  let txCurrency: string | null = null
  let txOriginalAmount: number | null = null

  if (currencyRaw) {
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("home_currency")
      .eq("user_id", ownerUserId)
      .maybeSingle()
    const homeCurrency = (prefs?.home_currency ?? "AUD").toUpperCase()

    if (currencyRaw !== homeCurrency) {
      try {
        amount = await convertAmount(rawAmount, currencyRaw, homeCurrency, supabase)
        txCurrency = currencyRaw
        txOriginalAmount = rawAmount
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "No se pudo convertir la divisa" },
          { status: 500 },
        )
      }
    }
  }

  const categoryRaw = clampText(body.category, 50).trim()
  const matchedCategory = categoryRaw
    ? (TRANSACTION_CATEGORIES as readonly string[]).find(
        (c) => normalize(c) === normalize(categoryRaw),
      )
    : undefined

  const inferSource = [
    clampText(body.description),
    clampText(body.subtitle),
    clampText(body.title),
    sourceText,
  ].join(" ")
  const category = matchedCategory ?? inferCategory(inferSource) ?? "Otros"

  // El atajo manual (Ajustes) no pide un concepto de texto, solo cantidad,
  // tipo y categoría — así que si no llega `description` explícita (ni
  // viene de una notificación del Wallet automation antiguo), usamos la
  // categoría como texto por defecto en vez de un genérico "Wallet" que ya
  // no tiene sentido para este flujo.
  const explicitDescription = clampText(body.description).trim()
  const notifDescription = [clampText(body.subtitle), clampText(body.title)]
    .filter((v) => v.trim().length > 0)
    .join(" - ")
  const description = explicitDescription || notifDescription || category

  const dateRaw = typeof body.date === "string" ? body.date.trim() : ""
  const baseDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane" }).format(new Date())

  // Programación opcional:
  //   weekOffset -> mueve el gasto N semanas hacia adelante (pagado hoy, pero
  //                 pertenece a una semana posterior: weekOffset=1)
  //   weeks      -> divide el importe a partes iguales entre N semanas seguidas
  //                 (pagar 2 semanas de hostel por adelantado: weeks=2)
  // Ambos opcionales y combinables. Sin ellos, el comportamiento no cambia.
  const weeksRaw = Number(body.weeks)
  const weeks = Number.isFinite(weeksRaw) && weeksRaw >= 1 ? Math.min(Math.floor(weeksRaw), MAX_WEEKS) : 1
  const offsetRaw = Number(body.weekoffset ?? body.weekOffset)
  const weekOffset =
    Number.isFinite(offsetRaw) && offsetRaw >= 0 ? Math.min(Math.floor(offsetRaw), MAX_WEEK_OFFSET) : 0

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

  // Si hay importe original en otra divisa, se reparte entre semanas con el
  // mismo criterio (céntimos exactos) para que cada fila lleve su propio
  // original_amount coherente con su amount ya convertido.
  let origBaseCents = 0
  let origRemainder = 0
  let origSign = 1
  if (txOriginalAmount !== null) {
    const origTotalCents = Math.round(Math.abs(txOriginalAmount) * 100)
    origBaseCents = Math.floor(origTotalCents / weeks)
    origRemainder = origTotalCents - origBaseCents * weeks
    origSign = txOriginalAmount < 0 ? -1 : 1
  }

  // Esta ruta usa la service_role key, así que salta RLS por completo.
  // Cada fila lleva el user_id resuelto arriba (por token personal o por
  // el QUICK_ADD_OWNER_USER_ID antiguo), nunca huérfana.
  const rows = Array.from({ length: weeks }, (_, i) => {
    const cents = baseCents + (i === 0 ? remainder : 0)
    const row: Record<string, unknown> = {
      date: addWeeks(baseDate, weekOffset + i),
      description: weeks > 1 ? `${description} (${i + 1}/${weeks})` : description,
      category,
      amount: sign * (cents / 100),
      user_id: ownerUserId,
      currency: txCurrency,
      original_amount:
        txOriginalAmount !== null ? origSign * ((origBaseCents + (i === 0 ? origRemainder : 0)) / 100) : null,
    }
    return row
  })

  const { data, error } = await supabase.from("transactions").insert(rows).select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Confirmación por notificación push: solo para el camino 100% silencioso
  // (disparador "Notificación" de Atajos leyendo el aviso del banco/Wallet,
  // sin ninguna pantalla de ZentOS de por medio) — el alta manual desde
  // /quick-add o /quick-confirm ya muestra su propio "Guardado" en
  // pantalla, así que ahí no hace falta duplicar el aviso. Si el usuario no
  // tiene notificaciones activadas (o el envío falla), no rompe el alta:
  // la transacción ya quedó guardada de todas formas.
  if (detectedFromNotificationText && data && data.length > 0) {
    const first = data[0] as { amount: number; description: string; category: string }
    const total = data.reduce((sum: number, r: { amount: number }) => sum + Number(r.amount), 0)
    const sign = total < 0 ? "-" : "+"
    const summary = `${first.description} · ${first.category} · ${sign}$${Math.abs(total).toFixed(2)}`
    try {
      await sendPushToUser(supabase, ownerUserId, {
        title: "Gasto detectado",
        body: summary,
        url: "/",
        tag: "zentos-quick-transaction",
      })
    } catch (err) {
      console.error("[quick-transaction] error enviando confirmación push:", err)
    }
  }

  return NextResponse.json({
    ok: true,
    transaction: data?.[0] ?? null,
    transactions: data,
    pushConfirmationSent: detectedFromNotificationText,
  })
}

export async function POST(req: NextRequest) {
  return handle(req)
}

// El Shortcut nuevo (por usuario) usa un GET simple con todo en la URL, así
// no hace falta montar un body JSON desde Atajos.
export async function GET(req: NextRequest) {
  return handle(req)
}
