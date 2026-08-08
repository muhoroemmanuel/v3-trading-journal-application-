// Enhanced service worker for handling push notifications

const CACHE_NAME = "trading-journal-v1"
const urlsToCache = ["/", "/static/js/bundle.js", "/static/css/main.css", "/favicon.ico"]

// Install event
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)))
})

// Fetch event
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request)
    }),
  )
})

// Push event - handle incoming push notifications
self.addEventListener("push", (event) => {
  console.log("Push event received:", event)

  let notificationData = {}

  if (event.data) {
    try {
      notificationData = event.data.json()
    } catch (e) {
      notificationData = {
        title: "Trading Journal",
        body: event.data.text() || "New notification from Trading Journal",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
      }
    }
  } else {
    notificationData = {
      title: "Trading Journal",
      body: "New notification from Trading Journal",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    }
  }

  const options = {
    body: notificationData.body || "New notification from Trading Journal",
    icon: notificationData.icon || "/favicon.ico",
    badge: notificationData.badge || "/favicon.ico",
    data: notificationData.data || {},
    actions: notificationData.actions || [],
    requireInteraction: notificationData.requireInteraction || false,
    tag: notificationData.tag || "default",
    timestamp: Date.now(),
    vibrate: [200, 100, 200], // Vibration pattern for mobile devices
    silent: false,
  }

  // Add specific actions based on notification type
  if (notificationData.data && notificationData.data.type) {
    switch (notificationData.data.type) {
      case "economic-event":
        options.actions = [
          { action: "view-calendar", title: "View Calendar", icon: "/icons/calendar.png" },
          { action: "dismiss", title: "Dismiss", icon: "/icons/dismiss.png" },
        ]
        options.requireInteraction = true
        break

      case "journal-reminder":
        options.actions = [
          { action: "open-journal", title: "Open Journal", icon: "/icons/journal.png" },
          { action: "snooze", title: "Remind Later", icon: "/icons/snooze.png" },
          { action: "dismiss", title: "Dismiss", icon: "/icons/dismiss.png" },
        ]
        break

      case "trade-alert":
        options.actions = [
          { action: "view-trade", title: "View Trade", icon: "/icons/trade.png" },
          { action: "dismiss", title: "Dismiss", icon: "/icons/dismiss.png" },
        ]
        options.requireInteraction = true
        break
    }
  }

  event.waitUntil(self.registration.showNotification(notificationData.title || "Trading Journal", options))
})

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event)

  event.notification.close()

  const action = event.action
  const data = event.notification.data

  let urlToOpen = "/"

  // Handle different actions
  switch (action) {
    case "view-calendar":
      urlToOpen = "/economic-calendar"
      break
    case "open-journal":
      urlToOpen = "/?tab=journal"
      break
    case "view-trade":
      urlToOpen = "/?tab=portfolio"
      break
    case "snooze":
      // Schedule a reminder for 1 hour later
      scheduleSnoozeReminder()
      return
    case "dismiss":
      return
    default:
      // Default click behavior based on notification type
      if (data && data.type) {
        switch (data.type) {
          case "economic-event":
            urlToOpen = "/economic-calendar"
            break
          case "journal-reminder":
            urlToOpen = "/?tab=journal"
            break
          case "trade-alert":
            urlToOpen = "/?tab=portfolio"
            break
        }
      }
  }

  // Open the app or focus existing window
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // Navigate to the specific URL
          client.postMessage({
            type: "NAVIGATE",
            url: urlToOpen,
          })
          return client.focus()
        }
      }

      // If app is not open, open it
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    }),
  )
})

// Handle notification close event
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed:", event)

  // Track notification dismissal for analytics
  const data = event.notification.data
  if (data && data.type) {
    // You could send analytics data here
    console.log(`Notification dismissed: ${data.type}`)
  }
})

// Schedule snooze reminder
function scheduleSnoozeReminder() {
  // Schedule a new notification for 1 hour later
  setTimeout(
    () => {
      self.registration.showNotification("📝 Journal Reminder (Snoozed)", {
        body: "Don't forget to update your trading journal!",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "journal-reminder-snooze",
        data: { type: "journal-reminder" },
        actions: [
          { action: "open-journal", title: "Open Journal" },
          { action: "dismiss", title: "Dismiss" },
        ],
      })
    },
    60 * 60 * 1000,
  ) // 1 hour
}

// Background sync for offline functionality
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(
      // Sync data when connection is restored
      syncOfflineData(),
    )
  }
})

// Sync offline data
async function syncOfflineData() {
  try {
    // Get offline data from IndexedDB or localStorage
    const offlineData = JSON.parse(localStorage.getItem("offlineNotifications") || "[]")

    if (offlineData.length > 0) {
      // Process offline notifications
      for (const notification of offlineData) {
        await self.registration.showNotification(notification.title, notification.options)
      }

      // Clear offline data
      localStorage.removeItem("offlineNotifications")
    }
  } catch (error) {
    console.error("Error syncing offline data:", error)
  }
}

// Handle messages from the main thread
self.addEventListener("message", (event) => {
  console.log("Service worker received message:", event.data)

  switch (event.data.type) {
    case "SCHEDULE_NOTIFICATION":
      scheduleNotification(event.data.notification, event.data.delay)
      break
    case "CANCEL_NOTIFICATION":
      cancelScheduledNotification(event.data.tag)
      break
    case "UPDATE_BADGE":
      updateBadge(event.data.count)
      break
  }
})

// Schedule a notification
function scheduleNotification(notification, delay) {
  setTimeout(() => {
    self.registration.showNotification(notification.title, notification.options)
  }, delay)
}

// Cancel a scheduled notification
function cancelScheduledNotification(tag) {
  self.registration.getNotifications({ tag: tag }).then((notifications) => {
    notifications.forEach((notification) => notification.close())
  })
}

// Update app badge (for supported browsers)
function updateBadge(count) {
  if ("setAppBadge" in navigator) {
    navigator.setAppBadge(count)
  }
}
