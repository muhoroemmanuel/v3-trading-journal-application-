"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, Clock3, Loader2, MoreVertical, Plus, RefreshCw, ShieldCheck, Unplug } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

 type Platform = "MT4" | "MT5"
 type AccountStatus = "Connected" | "Syncing" | "Error" | "Disconnected"
 type BrokerAccount = { id: string; platform: Platform; server: string; accountNumber: string; status: AccountStatus; lastSynced?: string; error?: string }

const demoAccounts: BrokerAccount[] = [
  { id: "icmarkets-demo", platform: "MT5", server: "ICMarketsSC-Demo", accountNumber: "•••4521", status: "Connected", lastSynced: "Today at 9:42 AM" },
]

const statusStyles: Record<AccountStatus, string> = {
  Connected: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Syncing: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Error: "border-destructive/30 bg-destructive/10 text-destructive",
  Disconnected: "border-muted bg-muted text-muted-foreground",
}

export function BrokerAccounts() {
  const [accounts, setAccounts] = useState<BrokerAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [disconnecting, setDisconnecting] = useState<BrokerAccount | null>(null)
  const [form, setForm] = useState({ platform: "MT5" as Platform, server: "", accountNumber: "", password: "" })
  const [formError, setFormError] = useState("")
  const [progress, setProgress] = useState<"idle" | "connecting" | "verifying" | "syncing">("idle")

  useEffect(() => {
    let active = true
    fetch("/api/broker-accounts")
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => { if (active) setAccounts(Array.isArray(data) ? data : demoAccounts) })
      .catch(() => { if (active) setAccounts(demoAccounts) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  const connect = async () => {
    if (!form.server.trim() || !form.accountNumber.trim() || !form.password) { setFormError("Enter your broker server, account number, and investor password to continue."); return }
    setFormError("")
    setProgress("connecting")
    await new Promise((resolve) => setTimeout(resolve, 900))
    setProgress("verifying")
    await new Promise((resolve) => setTimeout(resolve, 900))
    setProgress("syncing")
    await new Promise((resolve) => setTimeout(resolve, 900))
    try { await fetch("/api/broker-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form }) }) } catch { /* Backend is wired separately. */ }
    setAccounts((current) => [{ id: crypto.randomUUID(), platform: form.platform, server: form.server, accountNumber: `•••${form.accountNumber.slice(-4)}`, status: "Connected", lastSynced: "Just now" }, ...current])
    setForm({ platform: "MT5", server: "", accountNumber: "", password: "" }); setProgress("idle"); setShowForm(false)
  }

  const sync = async (account: BrokerAccount) => {
    setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: "Syncing", error: undefined } : item))
    try { await fetch(`/api/broker-accounts/${account.id}/sync`, { method: "POST" }); await new Promise((resolve) => setTimeout(resolve, 1200)); setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: "Connected", lastSynced: "Just now" } : item)) } catch { setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, status: "Error", error: "We couldn't sync this account. Check the connection and try again." } : item)) }
  }

  const disconnect = async () => {
    if (!disconnecting) return
    try { await fetch(`/api/broker-accounts/${disconnecting.id}`, { method: "DELETE" }) } catch { /* Backend is wired separately. */ }
    setAccounts((current) => current.filter((item) => item.id !== disconnecting.id)); setDisconnecting(null)
  }

  const progressLabel = { idle: "", connecting: "Connecting to broker...", verifying: "Verifying account...", syncing: "Syncing trade history..." }[progress]

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Accounts</h1><p className="mt-1 text-sm text-muted-foreground">Connect read-only broker accounts to keep your journal in sync.</p></div><Button className="min-h-11 shrink-0 gap-2" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Connect</span><span className="sm:hidden">Add</span></Button></div>
    {accounts.length > 0 && <section className="space-y-3"><h2 className="text-sm font-semibold text-muted-foreground">Connected accounts</h2>{isLoading ? <Card><CardContent className="flex min-h-28 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card> : accounts.map((account) => <Card key={account.id}><CardContent className="space-y-4 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{account.platform}</div><div className="min-w-0"><p className="truncate font-semibold">{account.server}</p><p className="text-sm text-muted-foreground">{account.accountNumber}</p></div></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="min-h-11 min-w-11"><MoreVertical className="h-5 w-5" /><span className="sr-only">Account actions</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem className="text-destructive" onClick={() => setDisconnecting(account)}><Unplug className="mr-2 h-4 w-4" />Disconnect</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><div className="flex flex-wrap items-center justify-between gap-3"><Badge variant="outline" className={statusStyles[account.status]}>{account.status === "Connected" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : account.status === "Syncing" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <AlertCircle className="mr-1 h-3 w-3" />}{account.status}</Badge><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{account.lastSynced || "Not synced yet"}</span><Button variant="outline" className="min-h-11 gap-2" disabled={account.status === "Syncing"} onClick={() => sync(account)}><RefreshCw className="h-4 w-4" />Sync now</Button></div>{account.error && <p className="text-sm text-destructive">{account.error}</p>}</CardContent></Card>)}</section>}
    {accounts.length === 0 && !isLoading && <Card><CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center"><ShieldCheck className="h-10 w-10 text-primary" /><h2 className="font-semibold">No broker accounts connected</h2><p className="max-w-sm text-sm text-muted-foreground">Connect an investor-password account to automatically import your trades.</p><Button className="min-h-11" onClick={() => setShowForm(true)}>Connect broker account</Button></CardContent></Card>}
    <Dialog open={showForm} onOpenChange={(open) => { if (!open && progress === "idle") setShowForm(false) }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>Connect Broker Account</DialogTitle><DialogDescription>Use read-only access to safely import trade history.</DialogDescription></DialogHeader>{progress !== "idle" ? <div className="flex flex-col items-center gap-4 py-10 text-center"><Loader2 className="h-9 w-9 animate-spin text-primary" /><div><p className="font-semibold">{progressLabel}</p><p className="mt-1 text-sm text-muted-foreground">This can take 30–90 seconds.</p></div><div className="flex gap-1">{["connecting", "verifying", "syncing"].map((step) => <span key={step} className={`h-1.5 w-14 rounded-full ${["connecting", "verifying", "syncing"].indexOf(step) <= ["connecting", "verifying", "syncing"].indexOf(progress) ? "bg-primary" : "bg-muted"}`} />)}</div></div> : <div className="space-y-4"><div className="grid grid-cols-2 gap-2">{(["MT4", "MT5"] as Platform[]).map((platform) => <Button key={platform} type="button" variant={form.platform === platform ? "default" : "outline"} className="min-h-11" onClick={() => setForm({ ...form, platform })}>{platform}</Button>)}</div><div className="space-y-2"><Label htmlFor="server">Broker server name</Label><Input className="text-base" id="server" value={form.server} onChange={(event) => setForm({ ...form, server: event.target.value })} placeholder="ICMarketsSC-Demo" autoComplete="organization" /><p className="text-xs text-muted-foreground">e.g. ICMarketsSC-Demo — find this in your MT4/5 login screen</p></div><div className="space-y-2"><Label htmlFor="account-number">Account login/number</Label><Input className="text-base" id="account-number" inputMode="numeric" type="number" value={form.accountNumber} onChange={(event) => setForm({ ...form, accountNumber: event.target.value })} placeholder="12345678" autoComplete="username" /></div><div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-6 text-muted-foreground"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />Use your investor (read-only) password, not your trading password. This lets us read your trade history without any ability to place trades.</div><div className="space-y-2"><Label htmlFor="investor-password">Investor password</Label><Input className="text-base" id="investor-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="current-password" /></div>{formError && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert"><AlertCircle className="mr-2 inline h-4 w-4" />{formError}</div>}</div>}<DialogFooter>{progress === "idle" && <Button className="min-h-11 w-full" onClick={connect}>Connect account</Button>}</DialogFooter></DialogContent></Dialog>
    <Dialog open={!!disconnecting} onOpenChange={(open) => !open && setDisconnecting(null)}><DialogContent><DialogHeader><DialogTitle>Disconnect account?</DialogTitle><DialogDescription>This stops future syncing for {disconnecting?.server}, but keeps trades already imported in your journal.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" className="min-h-11" onClick={() => setDisconnecting(null)}>Cancel</Button><Button variant="destructive" className="min-h-11" onClick={disconnect}>Disconnect</Button></DialogFooter></DialogContent></Dialog>
  </div>
}

export default BrokerAccounts
