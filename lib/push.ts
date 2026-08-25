"use client"

// Suscripción del navegador a notificaciones push (Web Push API), guardada
// en Supabase (push_subscriptions, RLS-scoped al usuario). El envío en sí
// (con la clave privada VAPID) solo puede pasar en el servidor — ver
// app/api/push/test/route.ts y app/api/automations/evaluate/route.ts.
//
// Compatibilidad: Chrome/Edge/Firefox de escritorio y Android funcionan sin
// más. iPhone (Safari) necesita iOS 16.4+ Y que la app esté instalada como
// PWA (Compartir -> Añadir a pantalla de inicio) — abierta dentro de Safari
// normal, el navegador ni siquiera expone el permiso.

import { supabase } from "./supabase"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  return Notification.permission
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js")
}

// Suscribe este dispositivo/navegador y guarda la suscripción en Supabase.
// Devuelve null si el usuario deniega el permiso o el navegador no soporta
// push (Safari fuera de una PWA instalada, navegadores antiguos, etc).
export async function subscribeToPush(vapidPublicKey: string): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "unsupported" }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, reason: "denied" }

  const registration = await registerServiceWorker()
  await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!p256dh || !auth) return { ok: false, reason: "missing_keys" }

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return { ok: false, reason: "not_authenticated" }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  )
  if (error) {
    console.error("[push] error guardando suscripción:", error.message)
    return { ok: false, reason: "save_failed" }
  }

  return { ok: true }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)
}

export async function isCurrentlySubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  return !!subscription
}
