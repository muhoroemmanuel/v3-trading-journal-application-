"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ArrowDown, ArrowUp, Bell, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"

type Direction = "above" | "below"
type AlertStatus = "active" | "triggered" | "cancelled"

interface PriceAlert {
  id: string
  currency_pair: string
  direction: Direction
  target_price: number
  status: AlertStatus
  triggered_at: string | null
  triggered_price: number | null
  created_at: string
}

const COMMON_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP"]

async function authHeader(): Promise<Record<string, string>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session ? { Authorization: `Bearer ${session.access_token}` } : {}
  } catch (error) {
    // Supabase not configured, or offline. Treat as "not signed in" rather than
    // letting the rejection escape as an unhandled promise.
    console.error("Could not read Supabase session:", error)
    return {}
  }
}

export default function PriceAlertForm() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currencyPair, setCurrencyPair] = useState("EUR/USD")
  const [customPair, setCustomPair] = useState("")
  const [direction, setDirection] = useState<Direction>("above")
  const [targetPrice, setTargetPrice] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadAlerts = async () => {
    const headers = await authHeader()
    if (!headers.Authorization) {
      setSignedIn(false)
      setIsLoading(false)
      return
    }
    setSignedIn(true)
    try {
      const response = await fetch("/api/price-alerts", { headers })
      const data = response.ok ? await response.json() : []
      setAlerts(Array.isArray(data) ? data : [])
    } finally {
      setIsLoading(false)
    }
  }

  // Intentional mount-only fetch of the saved alerts.
  useEffect(() => {
    // The plugin follows this promise chain into loadAlerts() and attributes its
    // setState calls to the effect body; they actually land after an await, so
    // nothing renders synchronously from here.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above.
    loadAlerts().catch((error) => {
      console.error("Could not load price alerts:", error)
      setIsLoading(false)
    })
  }, [])

  const createAlert = async () => {
    const pair = (customPair.trim() || currencyPair).toUpperCase()
    const price = Number.parseFloat(targetPrice)

    if (!pair || Number.isNaN(price) || price <= 0) {
      toast({ title: "Check your entry", description: "Enter a currency pair and a positive target price.", variant: "destructive" })
      return
    }

    setSubmitting(true)
    const headers = await authHeader()
    try {
      const response = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ currency_pair: pair, direction, target_price: price }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        toast({ title: "Couldn't create alert", description: data?.error || "Please try again.", variant: "destructive" })
        return
      }

      setAlerts((current) => [data, ...current])
      setTargetPrice("")
      setCustomPair("")
      toast({ title: "Alert created", description: `We'll email you when ${pair} goes ${direction} ${price}.` })
    } finally {
      setSubmitting(false)
    }
  }

  const cancelAlert = async (alert: PriceAlert) => {
    const headers = await authHeader()
    await fetch(`/api/price-alerts/${alert.id}`, { method: "DELETE", headers })
    setAlerts((current) => current.filter((item) => item.id !== alert.id))
  }

  const activeAlerts = alerts.filter((a) => a.status === "active")
  const pastAlerts = alerts.filter((a) => a.status !== "active")

  if (signedIn === false) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <ShieldCheck className="h-10 w-10 text-primary" />
          <h2 className="font-semibold">Sign in to set price alerts</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Alerts are checked in the background and emailed to you, so they need your account to know where to send them.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            New price alert
          </CardTitle>
          <CardDescription>Checked roughly every 15 minutes. We&apos;ll email you the moment it triggers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pair">Currency pair</Label>
            <Select value={currencyPair} onValueChange={setCurrencyPair}>
              <SelectTrigger id="pair" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_PAIRS.map((pair) => (
                  <SelectItem key={pair} value={pair}>
                    {pair}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="text-base"
              placeholder="Or type any pair, e.g. USD/ZAR"
              value={customPair}
              onChange={(event) => setCustomPair(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={direction === "above" ? "default" : "outline"}
              className="min-h-11 gap-2"
              onClick={() => setDirection("above")}
            >
              <ArrowUp className="h-4 w-4" />
              Above
            </Button>
            <Button
              type="button"
              variant={direction === "below" ? "default" : "outline"}
              className="min-h-11 gap-2"
              onClick={() => setDirection("below")}
            >
              <ArrowDown className="h-4 w-4" />
              Below
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target-price">Target price</Label>
            <Input
              id="target-price"
              className="text-base"
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="1.1000"
              value={targetPrice}
              onChange={(event) => setTargetPrice(event.target.value)}
            />
          </div>

          <Button className="min-h-11 w-full" onClick={createAlert} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create alert
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Active alerts</h2>
        {isLoading ? (
          <Card>
            <CardContent className="flex min-h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </CardContent>
          </Card>
        ) : activeAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active alerts yet.</p>
        ) : (
          activeAlerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-2">
                  {alert.direction === "above" ? (
                    <ArrowUp className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowDown className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium">{alert.currency_pair}</span>
                  <span className="text-sm text-muted-foreground">
                    {alert.direction} {alert.target_price}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={() => cancelAlert(alert)}>
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Cancel alert</span>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {pastAlerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Triggered</h2>
          {pastAlerts.map((alert) => (
            <Card key={alert.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <AlertTriangle className="h-3 w-3" />
                  Triggered
                </Badge>
                <span className="font-medium">{alert.currency_pair}</span>
                <span className="text-sm text-muted-foreground">
                  hit {alert.triggered_price} ({alert.direction} {alert.target_price}) on{" "}
                  {alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : "unknown"}
                </span>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
