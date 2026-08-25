import webpush from "web-push"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Solo se importa desde rutas de servidor (app/api/**/route.ts). Usa la
// clave privada VAPID, que nunca debe llegar al cliente.

let configured = false
function ensureConfigured() {
  if (configured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@zentos.app"
  if (!publicKey || !privateKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. Genera un par con `npx web-push generate-vapid-keys` y añádelas a las variables de entorno.",
    )
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export type PushSubscriptionTarget = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

// Manda una notificación a todas las suscripciones de un usuario. Si el
// navegador ya no la reconoce (410 Gone / 404), la suscripción se borra
// sola, así se limpia solo con el uso normal en vez de acumular basura.
export async function sendPushToUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<{ sent: number; removed: number; errors: string[] }> {
  ensureConfigured()

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId)

  if (error || !subs || subs.length === 0) {
    return { sent: 0, removed: 0, errors: error ? [error.message] : [] }
  }

  let sent = 0
  let removed = 0
  const errors: string[] = []

  await Promise.all(
    subs.map(async (sub: PushSubscriptionTarget) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        )
        sent++
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id)
          removed++
        } else {
          errors.push(err instanceof Error ? err.message : String(err))
        }
      }
    }),
  )

  return { sent, removed, errors }
}

export function createServiceRoleClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
