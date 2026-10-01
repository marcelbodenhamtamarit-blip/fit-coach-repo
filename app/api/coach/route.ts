import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/send-push.server"
import {
  DAY_TARGET,
  LONG_RUN_PLAN_MIN,
  SESSION_ORDER,
  WINTER_ARC_RULES,
  isDayDone,
  type WinterArcDay,
  type WinterArcRuleId,
  type WinterArcSession,
} from "@/lib/winter-arc"

// Coach IA del Winter Arc. Usa la API de Claude (ANTHROPIC_API_KEY en
// Vercel) con tus datos reales del Winter Arc y una memoria que la propia
// IA va reescribiendo (winter_arc_coach_memory). Dos modos:
//   - "daily": el consejo del día. Se genera una sola vez por día y se
//     guarda; las siguientes veces se devuelve el guardado (no gasta).
//   - "chat": responde a lo que le escribas.
// Solo el dueño de la app puede usarla (misma regla que lib/use-auth.tsx),
// para que nadie más pueda gastar créditos de la API.

const MODEL = process.env.COACH_MODEL || "claude-sonnet-5-5"
const MAX_CHAT_PER_DAY = 40
const MAX_MEMORY_CHARS = 2500

type Body = {
  mode: "daily" | "chat" | "reset_memory"
  message?: string
  today?: string // fecha local del móvil (YYYY-MM-DD)
  hour?: number // hora local del móvil
}

const RULE_TEXT: Record<WinterArcRuleId, string> = {
  entreno: "entreno del día o descanso planificado",
  pasos: "10.000 pasos",
  proteina: "proteína en cada comida",
  agua: "2,5–3 L de agua",
  sueno: "7,5–8 h de sueño y misma hora al levantarse",
  alcohol: "cero alcohol, azúcar y bollería",
  lectura: "10 páginas",
  movil: "sin redes la 1.ª hora ni después de las 22:00",
  gasto: "cero compras por impulso",
}

const SESSION_TEXT: Record<WinterArcSession, string> = {
  fuerza_a: "Fuerza A torso",
  rodaje: "rodaje fácil",
  fuerza_b: "Fuerza B pierna",
  fuerza_c: "Fuerza C completo",
  larga: "tirada larga",
  opcional: "opcional",
  descanso: "descanso",
}

const SYSTEM_PROMPT = `Eres el coach personal de Cel dentro de su app ZentOS, para su "Winter Arc" (plan de fin de año para ser su mejor versión).

Sobre Cel y su plan:
- Objetivo: verse mucho mejor, aguantar tiradas largas corriendo sin morir y sentirse bien.
- Entrenó 2 años en el gimnasio; en Australia lo dejó y empezó a correr. Sin lesiones.
- El Winter Arc empieza al llegar a España (finales de octubre) y acaba el 31 de diciembre. Antes: fase base en Australia y viaje a Malasia.
- Tiene pareja; el plan es solo suyo y no debe quitarle tiempo con ella.
- Su enemigo principal es sobrepensar y rendirse. Por eso: el plan no se cambia entre semana (solo en la revisión del domingo), nunca dos días seguidos sin cumplir, regla de los 5 minutos, y el "día mínimo" (moverse 20 min, proteína, leer y cero alcohol) cuenta como día cumplido.
- 9 reglas diarias: ${WINTER_ARC_RULES.map((r) => RULE_TEXT[r.id]).join("; ")}. Un día está cumplido con ${DAY_TARGET} de 9.
- Entreno en orden fijo, no en días fijos: ${SESSION_ORDER.map((s) => SESSION_TEXT[s]).join(" → ")}. Tirada larga por semana (min): ${LONG_RUN_PLAN_MIN.join(", ")}.
- Quiere elegir un proyecto ilusionante antes del 8 de noviembre y dedicarle 1 h al día.

Cómo hablas:
- En español de España, tuteando, directo y cercano, como un buen entrenador. Frases cortas.
- Basas cada consejo en sus datos reales (qué cumple, qué falla, patrones por día de la semana, rachas, tiradas, peso). Nombra el dato.
- Un consejo concreto y accionable vale más que tres genéricos. Nada de sermones ni listas largas.
- Si falla, sin dramas: recuérdale el día mínimo y que no se fallan dos seguidos.
- No das consejos médicos; si menciona dolor o lesión, que lo consulte con un profesional.
- No inventes datos que no tienes.

Memoria: tienes unas notas sobre Cel que tú mismo mantienes. Después de cada respuesta devuelves la versión actualizada completa: añade lo nuevo y útil que hayas aprendido (patrones, preferencias, lo que le funciona o no, decisiones que tome), quita lo que ya no sea cierto y mantenla por debajo de ${MAX_MEMORY_CHARS} caracteres. Solo hechos útiles para entrenarle, nada de datos sensibles.

Responde SIEMPRE y SOLO con un objeto JSON válido, sin texto fuera:
{"reply": "<tu mensaje para Cel>", "memory": "<notas de memoria actualizadas>"}`

function fmtDay(d: WinterArcDay): string {
  const missing = WINTER_ARC_RULES.filter((r) => !d.checks.includes(r.id)).map((r) => r.id)
  const weekday = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][new Date(d.date + "T00:00:00").getDay()]
  return `${d.date} (${weekday}): ${d.checks.length}/9${d.minimumDay ? " [día mínimo]" : ""} ${isDayDone(d) ? "CUMPLIDO" : "no cumplido"}; falta: ${missing.join(", ") || "nada"}; sesión: ${d.session ? SESSION_TEXT[d.session] : "-"}${d.sessionMinutes ? ` ${d.sessionMinutes} min` : ""}${d.sessionNotes ? ` (${d.sessionNotes})` : ""}; páginas: ${d.pages ?? "-"}`
}

async function callClaude(system: string, messages: { role: "user" | "assistant"; content: string }[]) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system, messages }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] }
  return (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("")
}

function parseCoach(raw: string): { reply: string; memory: string | null } {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(raw.slice(start, end + 1)) as { reply?: unknown; memory?: unknown }
      if (typeof obj.reply === "string" && obj.reply.trim()) {
        return {
          reply: obj.reply.trim(),
          memory: typeof obj.memory === "string" ? obj.memory.slice(0, MAX_MEMORY_CHARS) : null,
        }
      }
    } catch {
      // cae al texto plano
    }
  }
  return { reply: raw.trim(), memory: null }
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim()
  if (!token) return NextResponse.json({ error: "Falta la sesión" }, { status: 401 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: userData, error: userError } = await anon.auth.getUser(token)
  if (userError || !userData.user) return NextResponse.json({ error: "Sesión no válida" }, { status: 401 })

  const owner = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").trim().toLowerCase()
  if (owner && (userData.user.email ?? "").toLowerCase() !== owner) {
    return NextResponse.json({ error: "Solo el dueño de la app puede usar el coach" }, { status: 403 })
  }
  const userId = userData.user.id

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Cuerpo no válido" }, { status: 400 })
  }

  const admin = createServiceRoleClient()

  if (body.mode === "reset_memory") {
    await admin.from("winter_arc_coach_memory").upsert({ user_id: userId, notes: "", updated_at: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Falta ANTHROPIC_API_KEY en Vercel (Settings → Environment Variables)." },
      { status: 503 },
    )
  }

  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today! : new Date().toISOString().slice(0, 10)
  const hour = typeof body.hour === "number" ? body.hour : null

  if (body.mode === "daily") {
    const { data: existing } = await admin
      .from("winter_arc_coach_messages")
      .select("content")
      .eq("user_id", userId)
      .eq("kind", "daily")
      .eq("day", today)
      .maybeSingle()
    if (existing) return NextResponse.json({ reply: existing.content, cached: true })
  } else if (body.mode === "chat") {
    const message = (body.message ?? "").trim().slice(0, 2000)
    if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })
    const { count } = await admin
      .from("winter_arc_coach_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "chat")
      .eq("role", "user")
      .eq("day", today)
    if ((count ?? 0) >= MAX_CHAT_PER_DAY) {
      return NextResponse.json({ error: "Límite de mensajes de hoy alcanzado. Mañana más." }, { status: 429 })
    }
    body.message = message
  } else {
    return NextResponse.json({ error: "Modo no válido" }, { status: 400 })
  }

  // Contexto: ajustes, últimos 28 días, revisiones semanales, memoria y la
  // conversación reciente.
  const since = new Date(today + "T00:00:00")
  since.setDate(since.getDate() - 28)
  const sinceISO = since.toISOString().slice(0, 10)

  const [settingsRes, daysRes, weeksRes, memoryRes, historyRes] = await Promise.all([
    admin.from("winter_arc_settings").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("winter_arc_days").select("*").eq("user_id", userId).gte("date", sinceISO).order("date"),
    admin.from("winter_arc_weekly").select("*").eq("user_id", userId).order("week_start"),
    admin.from("winter_arc_coach_memory").select("notes").eq("user_id", userId).maybeSingle(),
    admin
      .from("winter_arc_coach_messages")
      .select("role, kind, day, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(14),
  ])

  const days: WinterArcDay[] = (daysRes.data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    checks: r.checks ?? [],
    minimumDay: r.minimum_day,
    session: r.session,
    sessionMinutes: r.session_minutes,
    sessionNotes: r.session_notes,
    pages: r.pages,
  }))
  const settings = settingsRes.data
  const startDate = settings?.start_date ?? "2026-10-26"
  const endDate = settings?.end_date ?? "2026-12-31"
  const memory = memoryRes.data?.notes ?? ""

  const context = [
    `Hoy es ${today}${hour !== null ? `, son las ${hour}:00 en su móvil` : ""}.`,
    `Winter Arc: del ${startDate} al ${endDate}.${settings?.current_book ? ` Libro actual: ${settings.current_book}.` : ""}`,
    `Últimos días registrados:\n${days.map(fmtDay).join("\n") || "(todavía sin registros)"}`,
    `Revisiones del domingo:\n${
      (weeksRes.data ?? [])
        .map((w) => `semana ${w.week_start}: peso ${w.weight ?? "-"} kg, cintura ${w.waist ?? "-"} cm, tirada larga ${w.long_run_minutes ?? "-"} min${w.note ? `, nota: ${w.note}` : ""}`)
        .join("\n") || "(ninguna aún)"
    }`,
    `Tu memoria sobre Cel:\n${memory || "(vacía, es el principio)"}`,
  ].join("\n\n")

  const history = (historyRes.data ?? [])
    .reverse()
    .map((m) => `${m.role === "user" ? "Cel" : "Coach"} (${m.day}${m.kind === "daily" ? ", consejo del día" : ""}): ${m.content}`)
    .join("\n")

  const task =
    body.mode === "daily"
      ? "Escribe el consejo del día: 2–4 frases. Empieza por lo más importante según sus datos (lo que más falla o lo que toca hoy) y cierra con una frase que le empuje a cumplir."
      : `Cel te escribe: "${body.message}"\nRespóndele (máximo 6 frases salvo que pida algo más largo, como un plan).`

  let reply: string
  let newMemory: string | null
  try {
    const raw = await callClaude(SYSTEM_PROMPT, [
      {
        role: "user",
        content: `${context}\n\nConversación reciente:\n${history || "(ninguna)"}\n\n${task}`,
      },
    ])
    ;({ reply, memory: newMemory } = parseCoach(raw))
  } catch (err) {
    console.error("[coach]", err)
    return NextResponse.json({ error: "El coach no ha podido responder. Prueba en un momento." }, { status: 502 })
  }

  const rows =
    body.mode === "daily"
      ? [{ user_id: userId, role: "coach", kind: "daily", day: today, content: reply }]
      : [
          { user_id: userId, role: "user", kind: "chat", day: today, content: body.message! },
          { user_id: userId, role: "coach", kind: "chat", day: today, content: reply },
        ]
  const { error: insertError } = await admin.from("winter_arc_coach_messages").insert(rows)
  if (insertError) console.error("[coach] insert", insertError.message)

  if (newMemory !== null) {
    await admin
      .from("winter_arc_coach_memory")
      .upsert({ user_id: userId, notes: newMemory, updated_at: new Date().toISOString() })
  }

  return NextResponse.json({ reply })
}
