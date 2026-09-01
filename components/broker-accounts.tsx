"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Clock3, Loader2, MoreVertical, Plus, RefreshCw, ShieldCheck, Unplug } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

type Platform = "MT4" | "MT5"
// Matches broker_connections.status in Supabase exactly — no display-only
// aliasing, so what you see is what's actually stored.
type AccountStatus = "connecting" | "connected" | "error" | "disconnected"
type BrokerAccount = {
  id: string
  platform: Platform
  server: string
  account_login: string
  status: AccountStatus
  error_message?: string | null
  last_synced_at?: string | null
}

const statusStyles: Record<AccountStatus, string> = {
  connected: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  connecting: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  disconnected: "border-muted bg-muted text-muted-foreground",
}

const statusLabels: Record<AccountStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  error: "Error",
  disconnected: "Disconnected",
}

function formatLastSynced(iso?: string | null) {
  if (!iso) return "Not synced yet"
  return `Last synced ${new Date(iso).toLocaleString()}`
}

async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

export function BrokerAccounts() {
  const [accounts, setAccounts] = useState<BrokerAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [disconnecting, setDisconnecting] = useState<BrokerAccount | null>(null)
  const [form, setForm] = useState({ platform: "MT5" as Platform, server: "", accountNumber: "" })
  const passwordRef = useRef<HTMLInputElement>(null)
  const [formError, setFormError] = useState("")
  const [progress, setProgress] = useState<"idle" | "connecting">("idle")

  const loadAccounts = async () => {
    const headers = await authHeader()
    if (!headers.Authorization) {
      setSignedIn(false)
      setIsLoading(false)
      return
    }
    setSignedIn(true)
    try {
      const response = await fetch("/api/broker-accounts", { headers })
      const data = response.ok ? await response.json() : []
      setAccounts(Array.isArray(data) ? data : [])
    } catch {
      setAccounts([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  // Broker terminals take a little while to actually deploy/connect after
  // provisioning — poll briefly so "Connecting" rows flip to their real
  // status without the user needing to manually refresh.
  useEffect(() => {
    if (!accounts.some((a) => a.status === "connecting")) return
    const timeout = setTimeout(loadAccounts, 5000)
    return () => clearTimeout(timeout)
  }, [accounts])

  const connect = async () => {
    const password = passwordRef.current?.value || ""

    if (!form.server.trim() || !form.accountNumber.trim() || !password) {
      setFormError("Enter your broker server, account number, and investor password to continue.")
      return
    }

    setFormError("")
    setProgress("connecting")

    const headers = await authHeader()
    if (!headers.Authorization) {
      setFormError("Sign in first to connect a broker account.")
      setProgress("idle")
      return
    }

    try {
      const response = await fetch("/api/broker-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ ...form, password }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setFormError(data?.error || "Couldn't connect to that account.")
        setProgress("idle")
        return
      }

      setAccounts((current) => [data, ...current])
      setForm({ platform: "MT5", server: "", accountNumber: "" })
      if (passwordRef.current) passwordRef.current.value = ""
      setProgress("idle")
      setShowForm(false)
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.")
      setProgress("idle")
    }
  }

  const sync = async (account: BrokerAccount) => {
    setAccounts((current) =>
      current.map((item) => (item.id === account.id ? { ...item, status: "connecting", error_message: null } : item)),
    )
    const headers = await authHeader()
    try {
      const response = await fetch(`/api/broker-accounts/${account.id}/sync`, { method: "POST", headers })
      const data = await response.json().catch(() => null)

      if (response.status === 202) {
        // Still deploying on MetaApi's side — not an error, just not ready.
        setAccounts((current) =>
          current.map((item) => (item.id === account.id ? { ...item, status: "connecting" } : item)),
        )
        return
      }

      if (!response.ok) {
        setAccounts((current) =>
          current.map((item) =>
            item.id === account.id ? { ...item, status: "error", error_message: data?.error || "Sync failed." } : item,
          ),
        )
        return
      }

      await loadAccounts()
    } catch {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, status: "error", error_message: "Couldn't reach the server." } : item,
        ),
      )
    }
  }

  const disconnect = async () => {
    if (!disconnecting) return
    const headers = await authHeader()
    try {
      await fetch(`/api/broker-accounts/${disconnecting.id}`, { method: "DELETE", headers })
    } catch {
      /* We still remove it from the list below either way. */
    }
    setAccounts((current) => current.filter((item) => item.id !== disconnecting.id))
    setDisconnecting(null)
  }

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Connect read-only broker accounts to keep your journal in sync.</p>
      </div>
      {signedIn && <Button className="min-h-11 shrink-0 gap-2" onClick={() => setShowForm(true)}>
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Connect</span>
        <span className="sm:hidden">Add</span>
      </Button>}
    </div>

    {signedIn === false && <Card><CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center"><ShieldCheck className="h-10 w-10 text-primary" /><h2 className="font-semibold">Sign in to connect a broker</h2><p className="max-w-sm text-sm text-muted-foreground">Broker sync needs your account to securely store the connection and your imported trades.</p><Button asChild className="min-h-11"><Link href="/login">Sign in / Create account</Link></Button></CardContent></Card>}

    {signedIn && accounts.length > 0 && <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">Connected accounts</h2>
      {isLoading ? <Card><CardContent className="flex min-h-28 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card> : accounts.map((account) => <Card key={account.id}><CardContent className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{account.platform.toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold">{account.server}</p><p className="text-sm text-muted-foreground">•••{account.account_login.slice(-4)}</p></div></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11"><MoreVertical className="h-5 w-5" /><span className="sr-only">Account actions</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive" onClick={() => setDisconnecting(account)}><Unplug className="mr-2 h-4 w-4" />Disconnect</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline" className={statusStyles[account.status]}>{account.status === "connected" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : account.status === "connecting" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <AlertCircle className="mr-1 h-3 w-3" />}{statusLabels[account.status]}</Badge><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{formatLastSynced(account.last_synced_at)}</span><Button variant="outline" className="min-h-11 gap-2" disabled={account.status === "connecting"} onClick={() => sync(account)}><RefreshCw className="h-4 w-4" />Sync now</Button></div>{account.error_message && <p className="text-sm text-destructive">{account.error_message}</p>}</CardContent></Card>)}
    </section>}

    {signedIn && accounts.length === 0 && !isLoading && <Card><CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center"><ShieldCheck className="h-10 w-10 text-primary" /><h2 className="font-semibold">No broker accounts connected</h2><p className="max-w-sm text-sm text-muted-foreground">Connect an investor-password account to automatically import your trades.</p><Button className="min-h-11" onClick={() => setShowForm(true)}>Connect broker account</Button></CardContent></Card>}

    <Dialog open={showForm} onOpenChange={(open) => { if (!open && progress === "idle") setShowForm(false) }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Broker Account</DialogTitle>
          <DialogDescription>Use read-only access to safely import trade history.</DialogDescription>
        </DialogHeader>
        {progress !== "idle" ? <div className="flex flex-col items-center gap-4 py-10 text-center"><Loader2 className="h-9 w-9 animate-spin text-primary" /><div><p className="font-semibold">Connecting to broker...</p><p className="mt-1 text-sm text-muted-foreground">MetaApi is provisioning a secure connection to your terminal. This can take up to a minute.</p></div></div> : <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">{(["MT4", "MT5"] as Platform[]).map((platform) => <Button key={platform} type="button" variant={form.platform === platform ? "default" : "outline"} className="min-h-11" onClick={() => setForm({ ...form, platform })}>{platform}</Button>)}</div>
          <div className="space-y-2"><Label htmlFor="server">Broker server name</Label><Input className="text-base" id="server" value={form.server} onChange={(event) => setForm({ ...form, server: event.target.value })} placeholder="ICMarketsSC-Demo" autoComplete="organization" /><p className="text-xs text-muted-foreground">e.g. ICMarketsSC-Demo — find this in your MT4/5 login screen</p></div>
          <div className="space-y-2"><Label htmlFor="account-number">Account login/number</Label><Input className="text-base" id="account-number" inputMode="numeric" type="number" value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} placeholder="12345678" autoComplete="username" /></div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />Use your investor (read-only) password, not your trading password. This lets us read your trade history without any ability to place trades.</div>
          <div className="space-y-2">
            <Label htmlFor="password">Investor Password</Label>
            <Input
              className="text-base"
              id="password"
              type="password"
              ref={passwordRef}
              placeholder="Enter investor password"
              autoComplete="off"
            />
          </div>
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <DialogFooter><Button className="min-h-11 w-full" onClick={connect}>Connect Account</Button></DialogFooter>
        </div>}
      </DialogContent>
    </Dialog>

    <Dialog open={!!disconnecting} onOpenChange={(open) => !open && setDisconnecting(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect Account</DialogTitle>
          <DialogDescription>Are you sure you want to disconnect {disconnecting?.server}?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setDisconnecting(null)}>Cancel</Button>
          <Button variant="destructive" onClick={disconnect}>Disconnect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
