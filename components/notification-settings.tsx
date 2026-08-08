"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { Bell, Mail, AlertTriangle, BookOpen, Loader2, Settings } from "lucide-react"
import { subscribeToNotifications, unsubscribeFromNotifications } from "@/lib/notifications"
import { Separator } from "@/components/ui/separator"

interface NotificationSettings {
  email: string
  emailEnabled: boolean
  pushEnabled: boolean
  journalReminders: boolean

  // Journal Reminder Settings
  journalReminderFrequency: "daily" | "weekly" | "custom"
  journalReminderTime: string // HH:MM format
  journalReminderDays: string[] // for weekly/custom
  journalReminderCustomInterval: number // days for custom
}

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
]

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>({
    email: "",
    emailEnabled: false,
    pushEnabled: false,
    journalReminders: true,

    journalReminderFrequency: "daily",
    journalReminderTime: "18:00",
    journalReminderDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    journalReminderCustomInterval: 3,
  })

  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Load saved settings
  useEffect(() => {
    const savedSettings = localStorage.getItem("notificationSettings")
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings((prev) => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error("Error parsing saved settings:", error)
      }
    }

    // Check if push notifications are supported
    if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true)
      setPushPermission(Notification.permission)
    }

    // Initialize notification scheduling
    initializeNotificationScheduling()
  }, [])

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem("notificationSettings", JSON.stringify(settings))
    scheduleNotifications()
  }, [settings])

  // Initialize notification scheduling system
  const initializeNotificationScheduling = () => {
    // Clear existing scheduled notifications
    clearScheduledNotifications()

    // Schedule new notifications based on current settings
    scheduleNotifications()
  }

  // Clear all scheduled notifications
  const clearScheduledNotifications = () => {
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
  }

  // Schedule notifications based on current settings
  const scheduleNotifications = () => {
    if (!settings.pushEnabled && !settings.emailEnabled) return

    // Schedule journal reminders
    if (settings.journalReminders) {
      scheduleJournalReminders()
    }
  }

  // Schedule journal reminders
  const scheduleJournalReminders = () => {
    const now = new Date()
    const [hours, minutes] = settings.journalReminderTime.split(":").map(Number)

    const nextReminderTime = new Date()
    nextReminderTime.setHours(hours, minutes, 0, 0)

    // If the time has passed today, schedule for tomorrow
    if (nextReminderTime <= now) {
      nextReminderTime.setDate(nextReminderTime.getDate() + 1)
    }

    const scheduleNextReminder = () => {
      const timeUntilReminder = nextReminderTime.getTime() - Date.now()

      if (timeUntilReminder > 0) {
        const timeoutId = setTimeout(() => {
          sendJournalReminder()

          // Schedule next reminder based on frequency
          switch (settings.journalReminderFrequency) {
            case "daily":
              nextReminderTime.setDate(nextReminderTime.getDate() + 1)
              break
            case "weekly":
              nextReminderTime.setDate(nextReminderTime.getDate() + 7)
              break
            case "custom":
              nextReminderTime.setDate(nextReminderTime.getDate() + settings.journalReminderCustomInterval)
              break
          }

          scheduleNextReminder()
        }, timeUntilReminder)

        // Store timeout ID for cleanup
        const timeouts = JSON.parse(localStorage.getItem("journalReminderTimeouts") || "[]")
        timeouts.push(timeoutId)
        localStorage.setItem("journalReminderTimeouts", JSON.stringify(timeouts))
      }
    }

    // Check if today is a valid reminder day for weekly/custom frequencies
    const today = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()
    const shouldRemindToday =
      settings.journalReminderFrequency === "daily" || settings.journalReminderDays.includes(today)

    if (shouldRemindToday) {
      scheduleNextReminder()
    }
  }

  // Send journal reminder notification
  const sendJournalReminder = () => {
    const title = "📝 Trading Journal Reminder"
    const body = "Don't forget to log your trades and reflect on your trading performance today!"

    if (settings.pushEnabled && Notification.permission === "granted") {
      const notification = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: "journal-reminder",
        requireInteraction: true,
        actions: [
          { action: "open", title: "Open Journal" },
          { action: "dismiss", title: "Dismiss" },
        ],
      })

      notification.onclick = () => {
        window.focus()
        // Navigate to journal tab if possible
        const event = new CustomEvent("navigate-to-journal")
        window.dispatchEvent(event)
        notification.close()
      }
    }

    // Send email reminder if enabled
    if (settings.emailEnabled && settings.email) {
      sendEmailNotification(title, body, "journal-reminder")
    }

    toast({
      title: "Journal Reminder",
      description: "Time to update your trading journal!",
    })
  }

  // Handle email change
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, email: e.target.value })
  }

  // Toggle email notifications
  const toggleEmailNotifications = (checked: boolean) => {
    if (checked && !isValidEmail(settings.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      })
      return
    }

    setSettings({ ...settings, emailEnabled: checked })

    if (checked) {
      toast({
        title: "Email Notifications Enabled",
        description: "You will now receive email notifications",
      })

      // Send welcome email
      sendEmailNotification(
        "Welcome to Trading Journal Notifications",
        "You have successfully enabled email notifications for your trading journal. You'll receive economic event alerts and journal reminders based on your preferences.",
        "welcome",
      )
    }
  }

  // Send email notification (simulated)
  const sendEmailNotification = async (subject: string, body: string, type: string) => {
    if (!settings.email || !isValidEmail(settings.email)) return

    try {
      // In a real application, this would be a server action or API call
      // For demo purposes, we'll simulate a network request
      await new Promise((resolve) => setTimeout(resolve, 1000))

      console.log(`Email sent to ${settings.email}:`, { subject, body, type })

      // Show success toast for important notifications
      if (type === "economic-event" || type === "journal-reminder") {
        toast({
          title: "Email Sent",
          description: `Notification email sent to ${settings.email}`,
        })
      }
    } catch (error) {
      console.error("Error sending email:", error)
    }
  }

  // Toggle push notifications
  const togglePushNotifications = async (checked: boolean) => {
    if (checked) {
      try {
        // Request permission if not already granted
        if (Notification.permission !== "granted") {
          const permission = await Notification.requestPermission()
          setPushPermission(permission)

          if (permission !== "granted") {
            toast({
              title: "Permission Denied",
              description: "You need to allow notifications in your browser settings",
              variant: "destructive",
            })
            return
          }
        }

        // Subscribe to push notifications
        await subscribeToNotifications()

        setSettings({ ...settings, pushEnabled: true })
        toast({
          title: "Push Notifications Enabled",
          description: "You will now receive push notifications",
        })

        // Initialize notification scheduling
        scheduleNotifications()
      } catch (error) {
        console.error("Error subscribing to push notifications:", error)
        toast({
          title: "Subscription Failed",
          description: "Could not subscribe to push notifications",
          variant: "destructive",
        })
      }
    } else {
      try {
        // Unsubscribe from push notifications
        await unsubscribeFromNotifications()

        // Clear scheduled notifications
        clearScheduledNotifications()

        setSettings({ ...settings, pushEnabled: false })
        toast({
          title: "Push Notifications Disabled",
          description: "You will no longer receive push notifications",
        })
      } catch (error) {
        console.error("Error unsubscribing from push notifications:", error)
      }
    }
  }

  // Update settings
  const updateSettings = (updates: Partial<NotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  // Save settings
  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      localStorage.setItem("notificationSettings", JSON.stringify(settings))

      // Reschedule notifications with new settings
      clearScheduledNotifications()
      scheduleNotifications()

      toast({
        title: "Settings Saved",
        description: "Your notification preferences have been updated",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingSettings(false)
    }
  }

  // Validate email
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // Test notification
  const sendTestNotification = (type: "journal") => {
    if (!settings.pushEnabled && !settings.emailEnabled) {
      toast({
        title: "Notifications Disabled",
        description: "Enable push or email notifications to test",
        variant: "destructive",
      })
      return
    }

    sendJournalReminder()
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bell className="mr-2 h-5 w-5" />
          Advanced Notification Settings
        </CardTitle>
        <CardDescription>
          Configure comprehensive notifications for economic events, journal reminders, and trade alerts
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Basic Notification Settings */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <h3 className="text-lg font-medium">Email Notifications</h3>
            </div>
            <Switch
              checked={settings.emailEnabled}
              onCheckedChange={toggleEmailNotifications}
              disabled={!settings.email && !settings.emailEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={settings.email}
              onChange={handleEmailChange}
            />
            <p className="text-sm text-muted-foreground">We'll send notifications to this email address</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <h3 className="text-lg font-medium">Push Notifications</h3>
            </div>
            <Switch
              checked={settings.pushEnabled}
              onCheckedChange={togglePushNotifications}
              disabled={!pushSupported}
            />
          </div>

          {!pushSupported && (
            <div className="flex items-center p-3 text-sm border rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
              <p>Push notifications are not supported in your browser</p>
            </div>
          )}

          {pushSupported && pushPermission === "denied" && (
            <div className="flex items-center p-3 text-sm border rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
              <p>Notifications are blocked. Please update your browser settings to allow notifications.</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Journal Reminders */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5" />
              <h3 className="text-lg font-medium">Journal Reminders</h3>
            </div>
            <Switch
              checked={settings.journalReminders}
              onCheckedChange={(checked) => updateSettings({ journalReminders: checked })}
            />
          </div>

          {settings.journalReminders && (
            <div className="space-y-4 pl-7">
              <div className="space-y-2">
                <Label>Reminder Frequency</Label>
                <Select
                  value={settings.journalReminderFrequency}
                  onValueChange={(value: "daily" | "weekly" | "custom") =>
                    updateSettings({ journalReminderFrequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="custom">Custom Interval</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reminder-time">Reminder Time</Label>
                <Input
                  id="reminder-time"
                  type="time"
                  value={settings.journalReminderTime}
                  onChange={(e) => updateSettings({ journalReminderTime: e.target.value })}
                />
              </div>

              {settings.journalReminderFrequency === "weekly" && (
                <div className="space-y-3">
                  <Label>Reminder Days</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Switch
                          checked={settings.journalReminderDays.includes(day.value)}
                          onCheckedChange={(checked) => {
                            const days = checked
                              ? [...settings.journalReminderDays, day.value]
                              : settings.journalReminderDays.filter((d) => d !== day.value)
                            updateSettings({ journalReminderDays: days })
                          }}
                        />
                        <Label className="text-sm">{day.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {settings.journalReminderFrequency === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="custom-interval">Remind Every (days)</Label>
                  <Input
                    id="custom-interval"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.journalReminderCustomInterval}
                    onChange={(e) =>
                      updateSettings({ journalReminderCustomInterval: Number.parseInt(e.target.value) || 1 })
                    }
                  />
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => sendTestNotification("journal")}
                className="flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                Test Journal Reminder
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* Save Settings */}
        <div className="flex justify-between items-center pt-4">
          <div className="text-sm text-muted-foreground">Settings are automatically saved when changed</div>
          <Button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2">
            {savingSettings ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>

        {/* Notification Status Summary */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Notification Status Summary</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${settings.pushEnabled ? "bg-green-500" : "bg-gray-400"}`}></div>
                <span>Push Notifications: {settings.pushEnabled ? "Enabled" : "Disabled"}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${settings.emailEnabled ? "bg-green-500" : "bg-gray-400"}`}></div>
                <span>Email Notifications: {settings.emailEnabled ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-2 h-2 rounded-full ${settings.journalReminders ? "bg-purple-500" : "bg-gray-400"}`}
                ></div>
                <span>Journal Reminders: {settings.journalReminders ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
