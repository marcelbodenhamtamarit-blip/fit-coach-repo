import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient, sendPushToUser } from "@/lib/send-push.server"
import { translate, type Language } from "@/lib/i18n"

// Botón "Avisar a papi" del apartado de ahorro de la pareja (se usa tanto
// si cumplió el objetivo como si no -- el mensaje cambia según
// checkin.met_goal). Se autentica con el access_token de la propia sesión
// de quien llama (Authorization: Bearer ...) -- igual que
// app/api/push/test/route.ts -- pero el push no se manda a quien llama,
// sino a la cuenta de papi (PAPI_EMAIL): es ella avisando a él, no una
// prueba a sí misma.
//
// PAPI_EMAIL es una variable propia (no NEXT_PUBLIC_OWNER_EMAIL): esa otra
// se deja vacía a propósito para abrir la app a cualquiera que se registre
// (ver comentario en Vercel), así que no sirve para encontrar la cuenta de
// papi de forma fiable.
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

  const body = await req.json().catch(() => null)
  const checkinId = typeof body?.checkinId === "string" ? body.checkinId : null
  if (!checkinId) {
    return NextResponse.json({ error: "Falta checkinId" }, { status: 400 })
  }

  try {
    const admin = createServiceRoleClient()

    // El check-in tiene que ser de quien llama -- comprobación de defensa
    // en profundidad (RLS ya lo exigiría desde el cliente normal, pero aquí
    // se usa la clave de servicio, que se la salta).
    const { data: checkin, error: checkinError } = await admin
      .from("savings_checkins")
      .select("id, user_id, period_key, met_goal")
      .eq("id", checkinId)
      .maybeSingle()
    if (checkinError || !checkin || checkin.user_id !== userData.user.id) {
      return NextResponse.json({ error: "Check-in no encontrado" }, { status: 404 })
    }

    const { data: goal } = await admin
      .from("savings_goals")
      .select("frequency")
      .eq("user_id", userData.user.id)
      .maybeSingle()

    // PAPI_EMAIL (no NEXT_PUBLIC_OWNER_EMAIL, ver comentario arriba del
    // todo). Mantenemos NEXT_PUBLIC_OWNER_EMAIL como respaldo por si algún
    // día vuelve a usarse para bloquear el acceso.
    const papiEmail = (process.env.PAPI_EMAIL ?? process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").trim().toLowerCase()
    if (!papiEmail) {
      return NextResponse.json({ error: "PAPI_EMAIL no está configurado" }, { status: 500 })
    }

    // supabase-js 2.x no tiene un getUserByEmail directo en el admin API --
    // con solo un par de cuentas en esta app, un listUsers() entero es
    // trivial y evita depender de una tabla propia de perfiles.
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }
    const owner = usersData.users.find((u) => (u.email ?? "").trim().toLowerCase() === papiEmail)
    if (!owner) {
      return NextResponse.json({ error: "No se encontró la cuenta de papi (revisa PAPI_EMAIL)" }, { status: 500 })
    }

    // El texto va en el idioma guardado del DESTINATARIO (papi), no del que
    // manda el aviso -- igual que /api/push/test/route.ts hace con el suyo.
    const { data: ownerPrefs } = await admin
      .from("user_preferences")
      .select("language")
      .eq("user_id", owner.id)
      .maybeSingle()
    const ownerLang: Language = ownerPrefs?.language === "en" ? "en" : "es"

    const partnerName =
      (userData.user.user_metadata?.name as string | undefined) || userData.user.email?.split("@")[0] || "Tu pareja"
    const periodWord = translate(
      goal?.frequency === "monthly" ? "push.partnerPeriodMonth" : "push.partnerPeriodWeek",
      ownerLang,
    )

    const result = await sendPushToUser(admin, owner.id, {
      title: translate(checkin.met_goal ? "push.partnerMetGoalTitle" : "push.partnerMissedGoalTitle", ownerLang),
      body: translate(checkin.met_goal ? "push.partnerMetGoal" : "push.partnerMissedGoal", ownerLang, {
        name: partnerName,
        period: periodWord,
      }),
      url: "/",
      tag: "partner-savings-report",
    })

    await admin
      .from("savings_checkins")
      .update({ reported: true, reported_at: new Date().toISOString() })
      .eq("id", checkinId)

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al avisar a papi" }, { status: 500 })
  }
}
