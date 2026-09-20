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
  journalReminderFrequency: "daily" | "weekly" | "custom"
  journalReminderTime: string
  journalReminderDays: string[]
  journalReminderCustomInterval: number
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

// Defaults for a first-time visit. Also used by the mount-only hydration below:
// on that first pass the rendered state is still these values.
const DEFAULT_SETTINGS: NotificationSettings = {
  email: "",
  emailEnabled: false,
  pushEnabled: false,
  journalReminders: true,
  journalReminderFrequency: "daily",
  journalReminderTime: "18:00",
  journalReminderDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  journalReminderCustomInterval: 3,
}

const REMINDER_TITLE = "📝 Trading Journal Reminder"
const REMINDER_BODY = "Don't forget to log your trades and reflect on your trading performance today!"

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function clearScheduledNotifications() {
  localStorage.removeItem("journalReminderInterval")
  localStorage.removeItem("journalReminderTimeouts")
  localStorage.removeItem("economicEventTimeouts")
}

// The scheduling helpers live at module scope and take the settings they act on
// as an argument. Declared inside the component they were re-created on every
// render, which made them unstable effect dependencies: listing them in a
// dependency array would re-run the mount-only hydration and re-arm timers on
// every render — the classic source of duplicate journal reminders.
//
// NOTE: no server-side email provider is wired to the browser scheduler yet.
// The only real email path today is the price-alert cron job (lib/email.ts).
// This used to log a fake send and toast "Email Sent", which told users their
// email setting was live when nothing had been sent.
function sendEmailNotification(settings: NotificationSettings, subject: string, body: string, type: string) {
  if (!settings.email || !isValidEmail(settings.email)) return

  console.info(
    `[notifications] Email delivery isn't connected on this deployment — nothing was sent to ${settings.email}.`,
    { subject, body, type },
  )
}

function sendJournalReminder(settings: NotificationSettings) {
  localStorage.setItem("lastJournalReminderDate", new Date().toDateString())

  if (settings.pushEnabled && Notification.permission === "granted") {
    const notification = new Notification(REMINDER_TITLE, {
      body: REMINDER_BODY,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "journal-reminder",
      requireInteraction: true,
    })

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  if (settings.emailEnabled && settings.email) {
    sendEmailNotification(settings, REMINDER_TITLE, REMINDER_BODY, "journal-reminder")
  }

  toast({
    title: "Journal Reminder",
    description: "Time to update your trading journal!",
  })
}

function scheduleJournalReminders(settings: NotificationSettings) {
  localStorage.removeItem("journalReminderTimeouts")
  localStorage.removeItem("journalReminderInterval")

  const now = new Date()
  const [hours, minutes] = settings.journalReminderTime.split(":").map(Number)

  const nextReminderTime = new Date()
  nextReminderTime.setHours(hours, minutes, 0, 0)

  if (nextReminderTime <= now) {
    nextReminderTime.setDate(nextReminderTime.getDate() + 1)
  }

  const timeUntilReminder = nextReminderTime.getTime() - Date.now()

  if (timeUntilReminder > 0) {
    setTimeout(() => {
      sendJournalReminder(settings)
    }, timeUntilReminder)
  }
}

function scheduleNotifications(settings: NotificationSettings) {
  if (!settings.pushEnabled && !settings.emailEnabled) return
  if (settings.journalReminders) {
    scheduleJournalReminders(settings)
  }
}

function initializeNotificationScheduling(settings: NotificationSettings) {
  clearScheduledNotifications()
  scheduleNotifications(settings)
}

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() => ({ ...DEFAULT_SETTINGS }))

  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Load saved settings + check for missed reminders on page load. This must stay
  // a mount-only effect: it hydrates browser-only state (localStorage and the
  // Notification API do not exist during SSR) and the scheduling helpers it calls
  // are module-scope functions that take the settings they act on as an argument,
  // so there is no render-scope closure to list as a dependency. (The helpers
  // used to be in-component, which meant adding them to a dependency array would
  // have re-armed every timer on each render — duplicate journal reminders.)
  useEffect(() => {
    const savedSettings = localStorage.getItem("notificationSettings")
    let parsed: Partial<NotificationSettings> | null = null
    if (savedSettings) {
      try {
        parsed = JSON.parse(savedSettings) as Partial<NotificationSettings>
        // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only hydration: localStorage does not exist during SSR, so this cannot move into the useState initializer.
        setSettings((prev) => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error("Error parsing saved settings:", error)
      }
    }

    if ("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true)
      setPushPermission(Notification.permission)
    }

    // State is still DEFAULT_SETTINGS on this first pass, which is exactly what
    // the previous closure-based call scheduled from. The effect below
    // re-schedules as soon as the hydrated settings land in state.
    initializeNotificationScheduling(DEFAULT_SETTINGS)

    // Missed reminders: timeout IDs don't survive a reload, so if today's
    // reminder time has already passed, send it now.
    const lastReminder = localStorage.getItem("lastJournalReminderDate")
    const today = new Date().toDateString()
    if (lastReminder !== today && parsed?.journalReminders) {
      const [hours, minutes] = (parsed?.journalReminderTime || "18:00").split(":").map(Number)
      const reminderTime = new Date()
      reminderTime.setHours(hours, minutes, 0, 0)
      if (Date.now() > reminderTime.getTime()) {
        sendJournalReminder(DEFAULT_SETTINGS)
        localStorage.setItem("lastJournalReminderDate", today)
      }
    }
  }, [])

  // Save settings when they change, then re-arm the reminders for the new
  // settings. `settings` is the only dependency that matters here: the helper is
  // module-scope, so there is no unstable function identity to chase.
  useEffect(() => {
    localStorage.setItem("notificationSettings", JSON.stringify(settings))
    scheduleNotifications(settings)
  }, [settings])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, email: e.target.value })
  }

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

      sendEmailNotification(
        settings,
        "Welcome to Trading Journal Notifications",
        "You have successfully enabled email notifications for your trading journal. You'll receive economic event alerts and journal reminders based on your preferences.",
        "welcome",
      )
    }
  }

  const togglePushNotifications = async (checked: boolean) => {
    if (checked) {
    try {
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

        await subscribeToNotifications()

        setSettings({ ...settings, pushEnabled: true })
        toast({
          title: "Push Notifications Enabled",
          description: "You will now receive push notifications",
        })

        scheduleNotifications(settings)
      } catch (error) {
        console.error("Error subscribing to push notifications:", error)
        toast({
          title: "Subscription Failed",
          description: "Failed to enable push notifications. Please try again.",
          variant: "destructive",
        })
      }
    } else {
    try {
        await unsubscribeFromNotifications()
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

  const updateSettings = (updates: Partial<NotificationSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      // Settings live in localStorage; the fake delay that used to be here just
      // made saving feel slow without doing anything.
      localStorage.setItem("notificationSettings", JSON.stringify(settings))
      clearScheduledNotifications()
      scheduleNotifications(settings)

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

  const sendTestNotification = (type: "journal") => {
    if (!settings.pushEnabled && !settings.emailEnabled) {
      toast({
        title: "Notifications Disabled",
        description: "Enable push or email notifications to test",
        variant: "destructive",
      })
      return
    }
    sendJournalReminder(settings)
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
            <p className="text-sm text-muted-foreground">
              Saved with your other preferences. Email delivery isn&apos;t connected on this deployment yet — only
              price alerts are emailed (see the Alerts page).
            </p>
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
