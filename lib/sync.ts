import { supabase } from "./supabase"
import type { Trade, Preset } from "./db-schema"

// ─── Queue for offline operations ───
interface PendingOp {
  table: "trades" | "presets"
  action: "insert" | "update" | "delete"
  data: any
  id?: string
}

function getQueue(): PendingOp[] {
  const raw = localStorage.getItem("syncQueue")
  return raw ? JSON.parse(raw) : []
}

function setQueue(queue: PendingOp[]) {
  localStorage.setItem("syncQueue", JSON.stringify(queue))
}

function addToQueue(op: PendingOp) {
  const queue = getQueue()
  queue.push(op)
  setQueue(queue)
}

// ─── Local storage helpers ───
export function getLocalTrades(): Trade[] {
  const raw = localStorage.getItem("trades")
  return raw ? JSON.parse(raw) : []
}

export function setLocalTrades(trades: Trade[]) {
  localStorage.setItem("trades", JSON.stringify(trades))
}

export function getLocalPresets(): Preset[] {
  const raw = localStorage.getItem("tradePresets")
  return raw ? JSON.parse(raw) : []
}

export function setLocalPresets(presets: Preset[]) {
  localStorage.setItem("tradePresets", JSON.stringify(presets))
}

// ─── Check if user is logged in ───
export async function isAuthenticated(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

// ─── Save trade (offline-first) ───
export async function saveTrade(trade: Omit<Trade, "id" | "user_id" | "created_at" | "updated_at">) {
  // 1. Always save locally first
  const localTrades = getLocalTrades()
  const localTrade: Trade = {
    ...trade,
    id: crypto.randomUUID(),
    user_id: "local", // Will be replaced on sync
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Trade
  localTrades.unshift(localTrade)
  setLocalTrades(localTrades)

  // 2. Try to sync if online and authenticated
  if (navigator.onLine && await isAuthenticated()) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { error } = await supabase.from("trades").insert({
        ...trade,
        user_id: user.id,
      })
      if (error) {
        console.error("Sync error:", error)
        addToQueue({ table: "trades", action: "insert", data: trade })
      }
    }
  } else {
    addToQueue({ table: "trades", action: "insert", data: trade })
  }

  return localTrade
}

// ─── Delete trade ───
export async function deleteTrade(tradeId: string) {
  // 1. Delete locally
  const trades = getLocalTrades().filter((t) => t.id !== tradeId)
  setLocalTrades(trades)

  // 2. Sync if possible
  if (navigator.onLine && await isAuthenticated()) {
    const { error } = await supabase.from("trades").delete().eq("id", tradeId)
    if (error) addToQueue({ table: "trades", action: "delete", id: tradeId, data: null })
  } else {
    addToQueue({ table: "trades", action: "delete", id: tradeId, data: null })
  }
}

// ─── Sync pending operations ───
export async function syncPending() {
  if (!navigator.onLine) return
  if (!await isAuthenticated()) return

  const queue = getQueue()
  if (queue.length === 0) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const newQueue: PendingOp[] = []

  for (const op of queue) {
    try {
      if (op.table === "trades") {
        if (op.action === "insert") {
          await supabase.from("trades").insert({ ...op.data, user_id: user.id })
        } else if (op.action === "delete" && op.id) {
          await supabase.from("trades").delete().eq("id", op.id)
        }
      }
      // Successfully synced — don't add back to queue
    } catch (err) {
      console.error("Sync failed for op:", op, err)
      newQueue.push(op) // Retry later
    }
  }

  setQueue(newQueue)

  // After sync, pull latest from cloud
  await pullFromCloud()
}

// ─── Pull data from Supabase to localStorage ───
export async function pullFromCloud() {
  if (!navigator.onLine || !await isAuthenticated()) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Fetch trades
  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (trades) {
    setLocalTrades(trades as Trade[])
  }

  // Fetch presets
  const { data: presets } = await supabase
    .from("presets")
    .select("*")
    .eq("user_id", user.id)

  if (presets) {
    setLocalPresets(presets as Preset[])
  }
}

// ─── Listen for online status ───
export function setupSyncListener() {
  window.addEventListener("online", () => {
    console.log("Back online — syncing...")
    syncPending()
  })
}
