// Service worker de ZentOS: solo se encarga de notificaciones push del
// sistema (Web Push API). No cachea nada ni intercepta fetch — la PWA ya
// funciona online-first, así que aquí no hace falta un Service Worker de
// "offline app shell", solo el canal de push que exige el navegador para
// poder mostrar notificaciones incluso con la app cerrada.

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: "ZentOS", body: event.data ? event.data.text() : "" }
  }

  const title = payload.title || "ZentOS"
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-dark-32x32.png",
    tag: payload.tag || "zentos-automation",
    data: { url: payload.url || "/" },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if ("navigate" in client) client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    }),
  )
})
