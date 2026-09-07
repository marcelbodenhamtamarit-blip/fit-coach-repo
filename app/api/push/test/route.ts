import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServiceRoleClient, sendPushToUser } from "@/lib/send-push.server"
import { translate, type Language } from "@/lib/i18n"

// Botón "Enviar notificación de prueba" en Ajustes/Automatizaciones. Se
// autentica con el access_token de la sesión de Supabase del propio
// usuario (Authorization: Bearer ...), no con un secreto compartido: solo
// puede mandarse una prueba a sí mismo.
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

  try {
    const admin = createServiceRoleClient()

    // El texto de esta prueba estaba fijo en español en el propio código,
    // así que a cualquiera con la app en inglés le llegaba igual en
    // español. Aquí sí hay sesión (el token de la persona autenticada), así
    // que se puede leer su idioma guardado en Ajustes, igual que hace
    // /api/quick-transaction con sus notificaciones de confirmación.
    const { data: prefs } = await admin
      .from("user_preferences")
      .select("language")
      .eq("user_id", userData.user.id)
      .maybeSingle()
    const userLang: Language = prefs?.language === "en" ? "en" : "es"

    const result = await sendPushToUser(admin, userData.user.id, {
      title: "ZentOS",
      body: translate("push.testBody", userLang),
      url: "/",
      tag: "zentos-test",
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error enviando la prueba" }, { status: 500 })
  }
}
