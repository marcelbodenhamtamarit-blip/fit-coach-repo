import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isRedesignBetaUser } from "@/lib/redesign-beta"
import { fallbackReduction } from "@/lib/timmy-insights"

// IA del Árbol de Gastos ("Timmy"). Mismo patrón que app/api/coach/route.ts
// (Gemini, capa gratuita, GEMINI_API_KEY ya configurada en Vercel) pero sin
// tablas nuevas en Supabase: no guarda nada, cada llamada manda el contexto
// financiero real del mes (categorías/importes ya agregados en el cliente a
// partir de data.transactions) y, en modo chat, el historial reciente de la
// propia conversación. Solo responde a la cuenta de lib/redesign-beta.ts —
// cualquier otra sesión válida recibe 403, igual que el coach de Winter Arc
// solo responde al dueño de la app.
const MODEL = process.env.GEMINI_TIMMY_MODEL || process.env.GEMINI_COACH_MODEL || "gemini-3.6-flash"
const THINKING_CONFIG = /^gemini-3/.test(MODEL) ? { thinkingLevel: "low" } : { thinkingBudget: 0 }

type CategoryInput = { category: string; amount: number }

type Body = {
  mode: "plan" | "chat"
  categories: CategoryInput[]
  income: number
  expense: number
  message?: string
  history?: { who: "user" | "timmy"; text: string }[]
}

const SYSTEM_PROMPT = `Eres Timmy, la IA del apartado "Árbol de Gastos" dentro de ZentOS, la app personal de finanzas de Cel. El árbol es la metáfora visual de la app: las raíces son los ingresos, el tronco crece con el ahorro, y cada rama es una categoría de gasto, ordenadas de mayor a menor.

Cómo hablas:
- Español de España, tuteando, cercano y positivo, como un asistente financiero que anima a cuidar el árbol en vez de regañar por gastar.
- Te basas siempre en las cifras reales que te pasan (categorías, importes, ingresos, gastos) de ese mes. Nunca inventes cifras ni categorías que no te hayan dado.
- Un consejo concreto y accionable vale más que varios genéricos. Nada de sermones largos.
- No das asesoría financiera o de inversión formal; si preguntan por eso, acláralo brevemente y sigue centrado en sus hábitos de gasto.

Responde SIEMPRE y SOLO con un objeto JSON válido, sin texto fuera de él.`

async function callGemini(system: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
          thinkingConfig: THINKING_CONFIG,
        },
      }),
      signal: AbortSignal.timeout(20000),
    },
  )
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("")
}

function parseJsonObject<T>(raw: string): T | null {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

function clampCategories(categories: CategoryInput[]): CategoryInput[] {
  return (Array.isArray(categories) ? categories : [])
    .filter((c) => c && typeof c.category === "string" && typeof c.amount === "number")
    .slice(0, 12)
}

function fallbackPlan(categories: CategoryInput[]) {
  return {
    lines: categories.map((c) => ({
      category: c.category,
      reduction: fallbackReduction(c.amount),
      advice: "Revisa este gasto y marca un límite mensual algo más bajo que el real.",
    })),
    summary: "Plan orientativo (sin IA disponible ahora): un 12% de margen estimado por categoría.",
  }
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim()
  if (!token) return NextResponse.json({ error: "Falta la sesión" }, { status: 401 })

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: userData, error: userError } = await anon.auth.getUser(token)
  if (userError || !userData.user) return NextResponse.json({ error: "Sesión no válida" }, { status: 401 })

  if (!isRedesignBetaUser(userData.user.email)) {
    return NextResponse.json({ error: "El Árbol de Gastos todavía no está disponible para esta cuenta" }, { status: 403 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "Cuerpo no válido" }, { status: 400 })
  }

  const categories = clampCategories(body.categories)
  const income = typeof body.income === "number" ? body.income : 0
  const expense = typeof body.expense === "number" ? body.expense : 0

  if (body.mode !== "plan" && body.mode !== "chat") {
    return NextResponse.json({ error: "Modo no válido" }, { status: 400 })
  }

  if (!process.env.GEMINI_API_KEY) {
    if (body.mode === "plan") return NextResponse.json(fallbackPlan(categories))
    return NextResponse.json({
      reply: "Ahora mismo no tengo acceso a Gemini (falta GEMINI_API_KEY en Vercel), pero tus cifras de este mes siguen siendo correctas en el árbol y en Economía.",
    })
  }

  const catLines = categories.length
    ? categories.map((c) => `- ${c.category}: €${c.amount.toFixed(2)}`).join("\n")
    : "(sin gastos registrados este mes todavía)"
  const context = `Este mes: ingresos +€${income.toFixed(2)}, gastos -€${expense.toFixed(2)}, balance ${
    income - expense >= 0 ? "+" : "-"
  }€${Math.abs(income - expense).toFixed(2)}.\nGastos por categoría (de mayor a menor):\n${catLines}`

  try {
    if (body.mode === "plan") {
      const raw = await callGemini(
        SYSTEM_PROMPT,
        `${context}\n\nTarea: para cada categoría de la lista, propone una reducción mensual realista en euros (campo "reduction", número, nunca mayor que el propio gasto de esa categoría) y un consejo de una frase ("advice"). Añade también un resumen de una frase ("summary") con el ahorro total anual aproximado si se aplicara el plan completo.\n\nResponde con este JSON exacto: {"lines": [{"category": "<igual que en la lista>", "reduction": <número>, "advice": "<frase>"}], "summary": "<frase>"}`,
      )
      const parsed = parseJsonObject<{ lines?: { category: string; reduction: number; advice: string }[]; summary?: string }>(raw)
      if (parsed?.lines?.length) {
        return NextResponse.json({
          lines: parsed.lines.map((l) => ({
            category: String(l.category),
            reduction: Math.max(0, Math.round(Number(l.reduction) || 0)),
            advice: typeof l.advice === "string" && l.advice.trim() ? l.advice.trim() : "Revisa este gasto este mes.",
          })),
          summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : fallbackPlan(categories).summary,
        })
      }
      return NextResponse.json(fallbackPlan(categories))
    }

    const message = (body.message ?? "").trim().slice(0, 1000)
    if (!message) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 })
    const history = (Array.isArray(body.history) ? body.history : [])
      .slice(-12)
      .map((m) => `${m.who === "user" ? "Cel" : "Timmy"}: ${m.text}`)
      .join("\n")

    const raw = await callGemini(
      SYSTEM_PROMPT,
      `${context}\n\nConversación reciente:\n${history || "(ninguna)"}\n\nCel te escribe: "${message}"\n\nResponde con este JSON exacto: {"reply": "<tu respuesta a Cel, máximo 5 frases>"}`,
    )
    const parsed = parseJsonObject<{ reply?: string }>(raw)
    const reply = parsed?.reply?.trim()
    if (reply) return NextResponse.json({ reply })
    return NextResponse.json({ reply: raw.trim().slice(0, 600) || "No he podido pensar una respuesta, prueba otra vez." })
  } catch (err) {
    console.error("[timmy]", err)
    if (body.mode === "plan") return NextResponse.json(fallbackPlan(categories))
    return NextResponse.json({ error: "Timmy no ha podido responder. Prueba en un momento." }, { status: 502 })
  }
}
