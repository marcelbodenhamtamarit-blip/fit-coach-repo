import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient, sendPushToUser } from "@/lib/send-push.server"

export const maxDuration = 60

// Worker que evalúa todas las automatizaciones activas y dispara las que
// tocan (push y/o pop-up). Dos formas de llamarlo:
//
//   1. Cron (Vercel Cron -> vercel.json, o un ping externo tipo
//      cron-job.org): GET/POST con ?secret=CRON_SECRET. Evalúa TODAS las
//      automatizaciones activas de TODOS los usuarios.
//
//   2. "Probar ahora" desde la UI: POST con Authorization: Bearer
//      <access_token de sesión> y ?automationId=<uuid>. Dispara esa
//      automatización una única vez para quien la creó, sin tocar su
//      estado de programación (no cuenta como el disparo real).
//
// Import a tener en cuenta sobre el plan gratuito de Vercel: los cron jobs
// de Hobby están limitados a una ejecución al día. Para recordatorios/
// alertas con más frecuencia, o bien se pasa a plan Pro, o se apunta un
// cron externo gratuito (cron-job.org, EasyCron...) a esta misma URL con
// el secreto — el endpoint no distingue quién lo llama, solo el secreto.

const TZ = "Australia/Brisbane"

function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())
}

function nowHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date())
}

function weekdayOf(dateISO: string): number {
  return new Date(dateISO + "T00:00:00").getDay()
}

function weekStartISO(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00")
  d.setDate(d.getDate() - d.getDay())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

type AutomationRow = {
  id: string
  user_id: string
  name: string
  active: boolean
  trigger_type: "schedule" | "condition"
  schedule_frequency: "daily" | "weekly" | null
  schedule_time: string | null
  schedule_weekday: number | null
  condition_metric: "weekly_savings" | "monthly_expenses" | "category_monthly_expenses" | null
  condition_operator: "lt" | "lte" | "gt" | "gte" | null
  condition_value: number | null
  condition_category: string | null
  condition_cooldown_hours: number
  action_type: "push" | "popup" | "both"
  message_title: string
  message_body: string
  last_triggered_at: string | null
  last_triggered_period: string | null
}

async function computeConditionMetric(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  metric: NonNullable<AutomationRow["condition_metric"]>,
  category: string | null,
): Promise<number> {
  const today = todayISO()

  if (metric === "weekly_savings") {
    const start = weekStartISO(today)
    const end = new Date(start + "T00:00:00")
    end.setDate(end.getDate() + 6)
    const endISO = end.toISOString().slice(0, 10)
    const { data } = await admin
      .from("transactions")
      .select("amount")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", endISO)
    return (data ?? []).reduce((sum: number, r: { amount: number }) => sum + Number(r.amount), 0)
  }

  // monthly_expenses / category_monthly_expenses
  const monthPrefix = today.slice(0, 7)
  const { data } = await admin
    .from("transactions")
    .select("amount, category")
    .eq("user_id", userId)
    .gte("date", `${monthPrefix}-01`)
    .lt("date", nextMonthISO(monthPrefix))
    .lt("amount", 0)
  const rows = (data ?? []) as { amount: number; category: string }[]
  const filtered = metric === "category_monthly_expenses" && category ? rows.filter((r) => r.category === category) : rows
  return filtered.reduce((sum, r) => sum + Math.abs(Number(r.amount)), 0)
}

function nextMonthISO(monthPrefix: string): string {
  const [y, m] = monthPrefix.split("-").map(Number)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`
  return `${next}-01`
}

function compare(value: number, operator: NonNullable<AutomationRow["condition_operator"]>, target: number): boolean {
  switch (operator) {
    case "lt":
      return value < target
    case "lte":
      return value <= target
    case "gt":
      return value > target
    case "gte":
      return value >= target
  }
}

async function fireAutomation(
  admin: ReturnType<typeof createServiceRoleClient>,
  automation: AutomationRow,
  opts: { persistScheduleState: boolean; periodKey?: string },
): Promise<{ pushSent: boolean }> {
  const { data: eventRow } = await admin
    .from("automation_events")
    .insert({
      automation_id: automation.id,
      user_id: automation.user_id,
      title: automation.message_title,
      body: automation.message_body,
      action_type: automation.action_type,
    })
    .select("id")
    .single()

  let pushSent = false
  if (automation.action_type === "push" || automation.action_type === "both") {
    const result = await sendPushToUser(admin, automation.user_id, {
      title: automation.message_title,
      body: automation.message_body,
      url: "/",
      tag: automation.id,
    })
    pushSent = result.sent > 0
    if (eventRow?.id) {
      await admin.from("automation_events").update({ push_sent: pushSent }).eq("id", eventRow.id)
    }
  }

  if (opts.persistScheduleState) {
    await admin
      .from("automations")
      .update({
        last_triggered_at: new Date().toISOString(),
        last_evaluated_at: new Date().toISOString(),
        ...(opts.periodKey ? { last_triggered_period: opts.periodKey } : {}),
      })
      .eq("id", automation.id)
  }

  return { pushSent }
}

async function handle(req: NextRequest) {
  const url = new URL(req.url)
  const secret = url.searchParams.get("secret")
  const automationId = url.searchParams.get("automationId")
  const cronSecret = process.env.CRON_SECRET
  const admin = createServiceRoleClient()

  // Modo 2: "probar ahora" — sesión de usuario + automationId concreto.
  if (automationId) {
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (!token) return NextResponse.json({ error: "Falta la sesión" }, { status: 401 })

    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data: userData, error: userError } = await anon.auth.getUser(token)
    if (userError || !userData.user) return NextResponse.json({ error: "Sesión no válida" }, { status: 401 })

    const { data: automation, error } = await admin
      .from("automations")
      .select("*")
      .eq("id", automationId)
      .eq("user_id", userData.user.id)
      .maybeSingle()

    if (error || !automation) return NextResponse.json({ error: "Automatización no encontrada" }, { status: 404 })

    const { pushSent } = await fireAutomation(admin, automation as AutomationRow, { persistScheduleState: false })
    return NextResponse.json({ ok: true, fired: 1, pushSent })
  }

  // Modo 1: cron — evalúa todo, protegido por CRON_SECRET. Vercel Cron manda
  // automáticamente `Authorization: Bearer <CRON_SECRET>` si esa variable de
  // entorno existe en el proyecto; un cron externo (cron-job.org y
  // similares, que no siempre dejan poner cabeceras) puede usar en su lugar
  // ?secret=... en la URL.
  const authHeader = req.headers.get("authorization") || ""
  const headerOk = !!cronSecret && authHeader === `Bearer ${cronSecret}`
  const queryOk = !!cronSecret && secret === cronSecret
  if (!headerOk && !queryOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: automations, error } = await admin.from("automations").select("*").eq("active", true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const today = todayISO()
  const nowTime = nowHHMM()
  const todayWeekday = weekdayOf(today)
  const currentWeekStart = weekStartISO(today)

  let evaluated = 0
  let fired = 0
  let pushSent = 0
  const errors: string[] = []

  for (const automationRaw of (automations ?? []) as AutomationRow[]) {
    evaluated++
    try {
      if (automationRaw.trigger_type === "schedule") {
        if (!automationRaw.schedule_time) continue
        const periodKey = automationRaw.schedule_frequency === "weekly" ? currentWeekStart : today

        if (automationRaw.schedule_frequency === "weekly" && automationRaw.schedule_weekday !== null) {
          if (todayWeekday !== automationRaw.schedule_weekday) continue
        }
        if (nowTime < automationRaw.schedule_time) continue
        if (automationRaw.last_triggered_period === periodKey) continue

        const result = await fireAutomation(admin, automationRaw, { persistScheduleState: true, periodKey })
        fired++
        if (result.pushSent) pushSent++
      } else if (automationRaw.trigger_type === "condition") {
        if (!automationRaw.condition_metric || !automationRaw.condition_operator || automationRaw.condition_value === null) continue

        const cooldownMs = automationRaw.condition_cooldown_hours * 60 * 60 * 1000
        if (automationRaw.last_triggered_at) {
          const elapsed = Date.now() - new Date(automationRaw.last_triggered_at).getTime()
          if (elapsed < cooldownMs) continue
        }

        const value = await computeConditionMetric(
          admin,
          automationRaw.user_id,
          automationRaw.condition_metric,
          automationRaw.condition_category,
        )
        const met = compare(value, automationRaw.condition_operator, automationRaw.condition_value)
        if (!met) continue

        const result = await fireAutomation(admin, automationRaw, { persistScheduleState: true })
        fired++
        if (result.pushSent) pushSent++
      }
    } catch (err) {
      errors.push(`${automationRaw.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({ ok: true, evaluated, fired, pushSent, errors })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
