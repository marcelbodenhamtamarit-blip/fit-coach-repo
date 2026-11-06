import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient, sendPushToUser } from "@/lib/send-push.server"
import { translate, type Language } from "@/lib/i18n"

// Botón de un solo toque en la versión de la pareja: avisa a papi al
// instante, sin check-in ni nada que guardar -- solo un push. Misma
// dirección que app/api/partner/report/route.ts (pareja -> papi), pero sin
// ningún dato de por medio, así que aquí SÍ hace falta comprobar el email
// de quien llama contra NEXT_PUBLIC_PARTNER_EMAIL (en /report esa
// comprobación la hace indirectamente el propio check-in, que tiene que
// ser suyo).
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

  const partnerEmail = (process.env.NEXT_PUBLIC_PARTNER_EMAIL ?? "").trim().toLowerCase()
  const callerEmail = (userData.user.email ?? "").trim().toLowerCase()
  if (!partnerEmail || callerEmail !== partnerEmail) {
    return NextResponse.json({ error: "Solo la cuenta de tu pareja puede usar esto" }, { status: 403 })
  }

  try {
    const admin = createServiceRoleClient()

    // PAPI_EMAIL (no NEXT_PUBLIC_OWNER_EMAIL, ver comentario en
    // app/api/partner/report/route.ts).
    const papiEmail = (process.env.PAPI_EMAIL ?? process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").trim().toLowerCase()
    if (!papiEmail) {
      return NextResponse.json({ error: "PAPI_EMAIL no está configurado" }, { status: 500 })
    }

    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers()
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }
    const owner = usersData.users.find((u) => (u.email ?? "").trim().toLowerCase() === papiEmail)
    if (!owner) {
      return NextResponse.json({ error: "No se encontró la cuenta de papi (revisa PAPI_EMAIL)" }, { status: 500 })
    }

    // El texto va en el idioma guardado de papi, igual que el resto de
    // pushes de esta familia.
    const { data: ownerPrefs } = await admin
      .from("user_preferences")
      .select("language")
      .eq("user_id", owner.id)
      .maybeSingle()
    const ownerLang: Language = ownerPrefs?.language === "en" ? "en" : "es"

    const partnerName =
      (userData.user.user_metadata?.name as string | undefined) || userData.user.email?.split("@")[0] || "Tu pareja"

    const result = await sendPushToUser(admin, owner.id, {
      title: translate("push.poopTitle", ownerLang),
      body: translate("push.poopBody", ownerLang, { name: partnerName }),
      url: "/",
      tag: "partner-poop",
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al avisar a papi" }, { status: 500 })
  }
}
