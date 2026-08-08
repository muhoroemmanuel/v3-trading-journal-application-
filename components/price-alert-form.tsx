"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { AlertTriangle, Calendar, Globe, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface EconomicEvent {
  id: string
  title: string
  country: string
  impact: "low" | "medium" | "high"
  date: string
  time: string
  notifyBefore: number // minutes before event
  subscribed: boolean
}

const COUNTRIES = [
  "United States",
  "Eurozone",
  "United Kingdom",
  "Japan",
  "Australia",
  "Canada",
  "Switzerland",
  "China",
  "New Zealand",
  "All Countries",
]

export default function EconomicEventForm() {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [title, setTitle] = useState<string>("")
  const [country, setCountry] = useState<string>("")
  const [impact, setImpact] = useState<"low" | "medium" | "high">("medium")
  const [date, setDate] = useState<string>("")
  const [time, setTime] = useState<string>("")
  const [notifyBefore, setNotifyBefore] = useState<number>(15)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Load saved events and check notification settings
  useEffect(() => {
    const savedEvents = JSON.parse(localStorage.getItem("economicEvents") || "[]")
    setEvents(savedEvents)

    // Check if notifications are enabled
    const settings = JSON.parse(localStorage.getItem("notificationSettings") || "{}")
    setNotificationsEnabled(settings.pushEnabled || settings.emailEnabled || false)
  }, [])

  // Save events when they change
  useEffect(() => {
    localStorage.setItem("economicEvents", JSON.stringify(events))
  }, [events])

  // Add a new economic event subscription
  const addEvent = () => {
    if (!title) {
      toast({
        title: "Error",
        description: "Please enter an event title",
        variant: "destructive",
      })
      return
    }

    if (!country) {
      toast({
        title: "Error",
        description: "Please select a country",
        variant: "destructive",
      })
      return
    }

    if (!date) {
      toast({
        title: "Error",
        description: "Please select a date",
        variant: "destructive",
      })
      return
    }

    if (!time) {
      toast({
        title: "Error",
        description: "Please select a time",
        variant: "destructive",
      })
      return
    }

    const newEvent: EconomicEvent = {
      id: crypto.randomUUID(),
      title,
      country,
      impact,
      date,
      time,
      notifyBefore,
      subscribed: true,
    }

    setEvents([...events, newEvent])

    toast({
      title: "Event Subscribed",
      description: `You will be notified ${notifyBefore} minutes before ${title}`,
    })

    // Reset form
    setTitle("")
    setDate("")
    setTime("")
  }

  // Toggle event subscription
  const toggleSubscription = (id: string) => {
    setEvents(events.map((event) => (event.id === id ? { ...event, subscribed: !event.subscribed } : event)))

    const event = events.find((e) => e.id === id)
    if (event) {
      toast({
        title: event.subscribed ? "Unsubscribed" : "Subscribed",
        description: event.subscribed
          ? `You will no longer receive notifications for ${event.title}`
          : `You will be notified ${event.notifyBefore} minutes before ${event.title}`,
      })
    }
  }

  // Delete an event
  const deleteEvent = (id: string) => {
    setEvents(events.filter((event) => event.id !== id))

    toast({
      title: "Event Removed",
      description: "Economic event has been removed from your subscriptions",
    })
  }

  // Simulate fetching events from myfxbook.com
  const fetchEconomicEvents = () => {
    setIsRefreshing(true)

    // Simulate API call delay
    setTimeout(() => {
      const sampleEvents: EconomicEvent[] = [
        {
          id: crypto.randomUUID(),
          title: "Non-Farm Payrolls",
          country: "United States",
          impact: "high",
          date: new Date(Date.now() + 86400000).toISOString().split("T")[0], // tomorrow
          time: "12:30",
          notifyBefore: 30,
          subscribed: false,
        },
        {
          id: crypto.randomUUID(),
          title: "ECB Interest Rate Decision",
          country: "Eurozone",
          impact: "high",
          date: new Date(Date.now() + 172800000).toISOString().split("T")[0], // day after tomorrow
          time: "11:45",
          notifyBefore: 30,
          subscribed: false,
        },
        {
          id: crypto.randomUUID(),
          title: "Retail Sales m/m",
          country: "United Kingdom",
          impact: "medium",
          date: new Date(Date.now() + 86400000).toISOString().split("T")[0], // tomorrow
          time: "08:30",
          notifyBefore: 15,
          subscribed: false,
        },
        {
          id: crypto.randomUUID(),
          title: "GDP q/q",
          country: "Japan",
          impact: "high",
          date: new Date(Date.now() + 259200000).toISOString().split("T")[0], // 3 days from now
          time: "23:50",
          notifyBefore: 30,
          subscribed: false,
        },
      ]

      // Merge with existing events, avoiding duplicates by title and date
      const existingTitlesAndDates = events.map((e) => `${e.title}-${e.date}`)
      const newEvents = sampleEvents.filter((e) => !existingTitlesAndDates.includes(`${e.title}-${e.date}`))

      if (newEvents.length > 0) {
        setEvents([...events, ...newEvents])
        toast({
          title: "Economic Calendar Updated",
          description: `${newEvents.length} new events found`,
        })
      } else {
        toast({
          title: "No New Events",
          description: "Your economic calendar is up to date",
        })
      }

      setIsRefreshing(false)
    }, 2000)
  }

  // Get impact badge color
  const getImpactColor = (impact: "low" | "medium" | "high") => {
    switch (impact) {
      case "low":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
      case "medium":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
      default:
        return ""
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calendar className="mr-2 h-5 w-5" />
          Economic Events
        </CardTitle>
        <CardDescription>Subscribe to economic events from MyFXBook and receive notifications</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {!notificationsEnabled && (
          <div className="flex items-center p-3 text-sm border rounded-md bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
            <p>Notifications are disabled. Enable them in Settings to receive economic event alerts.</p>
          </div>
        )}

        {/* Create new event subscription */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Subscribe to Economic Event</h3>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={fetchEconomicEvents}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Refresh from MyFXBook
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                placeholder="e.g. Non-Farm Payrolls"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="impact">Impact Level</Label>
              <Select value={impact} onValueChange={(value: "low" | "medium" | "high") => setImpact(value)}>
                <SelectTrigger id="impact">
                  <SelectValue placeholder="Select impact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notify-before">Notify Before (minutes)</Label>
              <Select
                value={notifyBefore.toString()}
                onValueChange={(value) => setNotifyBefore(Number.parseInt(value))}
              >
                <SelectTrigger id="notify-before">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-time">Time</Label>
              <Input id="event-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <Button onClick={addEvent} className="w-full mt-4">
            Subscribe to Event
          </Button>
        </div>

        {/* Active event subscriptions */}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-medium">Your Economic Event Subscriptions</h3>

          {events.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              No economic events subscribed. Add one above or refresh from MyFXBook.
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded-md bg-background">
                  <div className="flex items-start space-x-2">
                    <Globe className="h-4 w-4 mt-1 text-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{event.title}</p>
                        <Badge className={`text-xs ${getImpactColor(event.impact)}`}>
                          {event.impact.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {event.country} • {event.date} at {event.time}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Notification: {event.notifyBefore} minutes before event
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant={event.subscribed ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSubscription(event.id)}
                    >
                      {event.subscribed ? "Subscribed" : "Subscribe"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEvent(event.id)}
                      className="text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
