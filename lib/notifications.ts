// This file contains functions for handling push notifications

// Function to subscribe to push notifications
export async function subscribeToNotifications() {
  try {
    // Check if service workers are supported
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service workers are not supported in this browser")
    }

    // Register service worker
    const registration = await navigator.serviceWorker.register("/service-worker.js", {
      scope: "/",
    })

    // Check if push is supported
    if (!("PushManager" in window)) {
      throw new Error("Push notifications are not supported in this browser")
    }

    // Get existing subscription
    let subscription = await registration.pushManager.getSubscription()

    // If no subscription exists, create one
    if (!subscription) {
      // ⚠️ SECURITY: This is a DEMO VAPID key from Google's examples.
      // It will NOT work for your domain. For production:
      // 1. Generate your own VAPID key pair: https://web-push-codelab.glitch.me/
      // 2. Store the private key securely on your server (never in client code)
      // 3. Replace this public key with your own
      const vapidPublicKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"

      // Convert the key to the format expected by the browser
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)

      // Subscribe to push notifications
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      })

      // In a real app, you would send this subscription to your server
      console.log("Subscribed to push notifications:", subscription)
    }

    return subscription
  } catch (error) {
    console.error("Error subscribing to push notifications:", error)
    throw error
  }
}

// Function to unsubscribe from push notifications
export async function unsubscribeFromNotifications() {
  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready

    // Get push subscription
    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      return true
    }

    // Unsubscribe
    const result = await subscription.unsubscribe()

    // In a real app, you would notify your server about the unsubscription
    console.log("Unsubscribed from push notifications")

    return result
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error)
    throw error
  }
}

// Helper function to convert base64 to Uint8Array
// (required for applicationServerKey)
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

// Function to send a notification (for demo purposes)
export function sendNotification(title: string, options: NotificationOptions = {}) {
  if (!("Notification" in window)) {
    console.error("Notifications not supported")
    return
  }

  if (Notification.permission === "granted") {
    const notification = new Notification(title, options)
    return notification
  }
}

// Schedule economic event notifications
export function scheduleEconomicEventNotification(event: any, advanceMinutes: number) {
  const eventDateTime = new Date(`${event.date} ${event.time}`)
  const notificationTime = new Date(eventDateTime.getTime() - advanceMinutes * 60 * 1000)
  const timeUntilNotification = notificationTime.getTime() - Date.now()

  if (timeUntilNotification > 0) {
    return setTimeout(() => {
      const title = `📊 Economic Event Alert: ${event.event}`
      const body = `${event.currency} - ${event.impact.toUpperCase()} impact event in ${advanceMinutes} minutes`

      sendNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `economic-event-${event.id}`,
        requireInteraction: true,
        data: {
          type: "economic-event",
          event: event,
        },
      })
    }, timeUntilNotification)
  }

  return null
}

// Schedule journal reminder notifications
export function scheduleJournalReminder(
  time: string,
  frequency: "daily" | "weekly" | "custom",
  days?: string[],
  customInterval?: number,
) {
  const [hours, minutes] = time.split(":").map(Number)

  const scheduleNext = () => {
    const now = new Date()
    const nextReminder = new Date()
    nextReminder.setHours(hours, minutes, 0, 0)

    // If time has passed today, schedule for next occurrence
    if (nextReminder <= now) {
      switch (frequency) {
        case "daily":
          nextReminder.setDate(nextReminder.getDate() + 1)
          break
        case "weekly":
          nextReminder.setDate(nextReminder.getDate() + 7)
          break
        case "custom":
          nextReminder.setDate(nextReminder.getDate() + (customInterval || 1))
          break
      }
    }

    const timeUntilReminder = nextReminder.getTime() - Date.now()

    if (timeUntilReminder > 0) {
      return setTimeout(() => {
        sendNotification("📝 Trading Journal Reminder", {
          body: "Don't forget to log your trades and reflect on your trading performance today!",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: "journal-reminder",
          requireInteraction: true,
          data: {
            type: "journal-reminder",
          },
        })

        // Schedule next reminder
        scheduleNext()
      }, timeUntilReminder)
    }

    return null
  }

  return scheduleNext()
}

// Send trade alert notification
export function sendTradeAlert(trade: any, alertType: string) {
  let title = ""
  let body = ""

  switch (alertType) {
    case "profit-target":
      title = `🎯 Profit Target Reached: ${trade.currencyPair}`
      body = `Your ${trade.action.toUpperCase()} position has reached the profit target!`
      break
    case "stop-loss":
      title = `🛑 Stop Loss Hit: ${trade.currencyPair}`
      body = `Your ${trade.action.toUpperCase()} position has hit the stop loss.`
      break
    case "breakeven":
      title = `⚖️ Breakeven Reached: ${trade.currencyPair}`
      body = `Your ${trade.action.toUpperCase()} position has reached breakeven.`
      break
    case "time-exit":
      title = `⏰ Time-Based Exit: ${trade.currencyPair}`
      body = `Consider exiting your ${trade.action.toUpperCase()} position based on time criteria.`
      break
  }

  sendNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `trade-alert-${trade.id}`,
    requireInteraction: true,
    data: {
      type: "trade-alert",
      trade: trade,
      alertType: alertType,
    },
  })
}

// Clear all scheduled notifications
export function clearAllScheduledNotifications() {
  // Clear journal reminder intervals
  const journalIntervalId = localStorage.getItem("journalReminderInterval")
  if (journalIntervalId) {
    clearInterval(Number(journalIntervalId))
    localStorage.removeItem("journalReminderInterval")
  }

  // Clear economic event timeouts
  const eventTimeouts = JSON.parse(localStorage.getItem("economicEventTimeouts") || "[]")
  eventTimeouts.forEach((timeoutId: number) => clearTimeout(timeoutId))
  localStorage.removeItem("economicEventTimeouts")

  // Clear journal reminder timeouts
  const journalTimeouts = JSON.parse(localStorage.getItem("journalReminderTimeouts") || "[]")
  journalTimeouts.forEach((timeoutId: number) => clearTimeout(timeoutId))
  localStorage.removeItem("journalReminderTimeouts")
}
