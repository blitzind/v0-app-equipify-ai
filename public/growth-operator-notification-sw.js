self.addEventListener("push", (event) => {
  let payload = {
    title: "Equipify notification",
    body: "",
    targetRoute: "/admin/growth/notifications",
  }

  try {
    payload = { ...payload, ...(event.data ? event.data.json() : {}) }
  } catch {
    // Ignore malformed payloads.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.notificationId || "growth-operator-notification",
      data: {
        url: payload.targetRoute || "/admin/growth/notifications",
      },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || "/admin/growth/notifications"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
      return undefined
    }),
  )
})
