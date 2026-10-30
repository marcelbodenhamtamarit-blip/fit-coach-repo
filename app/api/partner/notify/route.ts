import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient, sendPushToUser } from "@/lib/send-push.server"
import { translate, type Language } from "@/lib/i18n"

// Dirección contraria a app/api/partner/report/route.ts: aquí es papi quien
// manda un mensaje suelto (un ánimo, un recordatorio) al push de su
// pareja. Solo puede llamarla la cuenta de papi (PAPI_EMAIL) -- se
// comprueba con el email de la propia sesión de quien llama, igual que el
// resto de rutas de esta familia.
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

  const papiEmail = (process.env.PAPI_EMAIL ?? process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").trim().toLowerCase()
  const callerEmail = (userData.user.email ?? "").trim().toLowerCase()
  if (!papiEmail || callerEmail !== papiEmail) {
    return NextResponse.json({ error: "Solo la cuenta de papi puede usar esto" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const customTitle = typeof body?.title === "string" ? body.title.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "Falta el mensaje" }, { status: 400 })
  }

  try {
    const admin = createServiceRoleClient()

    const partnerEmail = (process.env.NEXT_PUBLIC_PARTNER_EMAIL ?? "").trim().toLowerCase()
    if (!partnerEmail) {
      return NextResponse.json({ error: "NEXT_PUBLIC_PARTNER_EMAIL no está configurado" }, { status: 500 })
    }

    // supabase-js 2.x no tiene un getUserByEmail directo en el admin API --
    // con solo un par de cuentas en esta app, un listUsers() entero es
    // trivial (ver app/api/partner/report/route.ts, mismo patrón).
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }
    const partner = usersData.users.find((u) => (u.email ?? "").trim().toLowerCase() === partnerEmail)
    if (!partner) {
      return NextResponse.json(
        { error: "No se encontró la cuenta de tu pareja (revisa NEXT_PUBLIC_PARTNER_EMAIL)" },
        { status: 500 },
      )
    }

    // El título por defecto va en el idioma guardado del DESTINATARIO (su
    // pareja), igual que el resto de pushes de la app.
    const { data: partnerPrefs } = await admin
      .from("user_preferences")
      .select("language")
      .eq("user_id", partner.id)
      .maybeSingle()
    const partnerLang: Language = partnerPrefs?.language === "en" ? "en" : "es"

    const result = await sendPushToUser(admin, partner.id, {
      title: customTitle || translate("push.papiMessageTitle", partnerLang),
      body: message,
      url: "/",
      tag: "papi-message",
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al mandar el mensaje" }, { status: 500 })
  }
}
