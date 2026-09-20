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
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    // Corrupted queue — drop it rather than crashing every sync attempt.
    console.error("Could not parse the sync queue; starting a fresh one:", error)
    return []
  }
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
// Every reader is defensive: a single corrupt key used to throw out of a React
// effect and blank the page it was rendered on.
export function getLocalTrades(): Trade[] {
  const raw = localStorage.getItem("trades")
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error("Could not parse local trades:", error)
    return []
  }
}

export function setLocalTrades(trades: Trade[]) {
  localStorage.setItem("trades", JSON.stringify(trades))
}

export function getLocalPresets(): Preset[] {
  const raw = localStorage.getItem("tradePresets")
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error("Could not parse local presets:", error)
    return []
  }
}

export function setLocalPresets(presets: Preset[]) {
  localStorage.setItem("tradePresets", JSON.stringify(presets))
}

// ─── Check if user is logged in ───
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    return !!data.session
  } catch (error) {
    // Supabase not configured, or offline — treat as signed out so callers take
    // the local-first path instead of throwing.
    console.error("Could not read Supabase session:", error)
    return false
  }
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

  // 2. Try to sync if online and authenticated. The whole cloud attempt is
  // wrapped in try/catch (and the caller does not need to handle failures) —
  // the trade is already safely in localStorage by this point.
  try {
    if (navigator.onLine && await isAuthenticated()) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Send our own uuid so the cloud row keeps the same id as the local copy.
        // That makes the pipeline idempotent — a retried insert collides with the
        // row it already created instead of duplicating it — and lets the
        // Portfolio tab's edits/deletes address a row that actually exists.
        const { error } = await supabase.from("trades").insert({
          ...trade,
          id: localTrade.id,
          user_id: user.id,
        })
        // 23505 = duplicate key: this trade already made it to the cloud.
        if (error && error.code !== "23505") {
          console.error("Sync error:", error)
          addToQueue({ table: "trades", action: "insert", data: trade, id: localTrade.id })
        }
      }
    } else {
      addToQueue({ table: "trades", action: "insert", data: trade, id: localTrade.id })
    }
  } catch (error) {
    console.error("Sync error:", error)
    addToQueue({ table: "trades", action: "insert", data: trade, id: localTrade.id })
  }

  return localTrade
}

// ─── Delete trade ───
// `tradeId` must be the same uuid in both places for the cloud delete to land —
// saveTrade() sends its client-generated id to Supabase to guarantee that.
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
/**
 * Full sync: drains the offline queue (trades saved while signed out, imported
 * backups, pending deletes) and then pulls the cloud copy back down. Safe to
 * call repeatedly — every step is idempotent.
 */
export async function syncPending() {
  if (!navigator.onLine) return
  if (!await isAuthenticated()) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const queue = getQueue()
  const newQueue: PendingOp[] = []

  for (const op of queue) {
    if (op.table !== "trades") continue

    // Supabase reports failures through the returned `error` rather than by
    // throwing, so the old try/catch here silently dropped failed ops from the
    // queue. Check the result explicitly and keep anything that really failed.
    if (op.action === "insert") {
      const { error } = await supabase
        .from("trades")
        .insert({ ...op.data, id: op.id, user_id: user.id })
      // 23505 = duplicate key: a previous attempt already landed, so drop it.
      if (error && error.code !== "23505") {
        console.error("Sync failed for op:", op, error)
        newQueue.push(op) // Retry later
      }
    } else if (op.action === "delete" && op.id) {
      const { error } = await supabase.from("trades").delete().eq("id", op.id)
      if (error) {
        console.error("Sync failed for op:", op, error)
        newQueue.push(op) // Retry later
      }
    }
  }

  setQueue(newQueue)

  // After sync, pull latest from cloud
  await pullFromCloud()
}

type TradeRow = {
  id: string
  currency_pair: string
  action: string
  entry_price: number
  stop_loss_price: number | null
  take_profit_price: number | null
  exit_price: number | null
  position_size: number
  status: string
  profit_loss: number | null
  notes: string | null
  conditions: unknown
  images: unknown
  created_at?: string
}

/**
 * Maps a locally-stored trade onto the DB column shape. Tolerates both layouts
 * found in localStorage — snake_case (written by saveTrade) and camelCase (JSON
 * backups) — and returns null for records too incomplete to insert.
 */
function toDbRow(raw: Record<string, any>): TradeRow | null {
  const currencyPair = raw.currency_pair ?? raw.currencyPair
  if (!raw.id || !currencyPair) return null

  return {
    id: raw.id,
    currency_pair: currencyPair,
    action: raw.action === "sell" ? "sell" : "buy",
    entry_price: raw.entry_price ?? raw.entryPrice ?? 0,
    // 0 is the "not set" sentinel the trade form uses, and is never a real price.
    stop_loss_price: raw.stop_loss_price || raw.stopLossPrice || null,
    take_profit_price: raw.take_profit_price || raw.takeProfitPrice || null,
    exit_price: raw.exit_price || raw.exitPrice || null,
    position_size: raw.position_size ?? raw.positionSize ?? 0,
    status: raw.status === "closed" ? "closed" : "open",
    profit_loss: raw.profit_loss ?? raw.profitLoss ?? null,
    notes: raw.notes ?? null,
    conditions: raw.conditions ?? [],
    images: raw.images ?? [],
    created_at: raw.created_at ?? raw.date ?? undefined,
  }
}

/**
 * Queues locally-added trades that didn't go through saveTrade — currently JSON
 * backups restored from the import dialog — so the next sync uploads them.
 *
 * Without this they would exist only in this browser, and the next
 * pullFromCloud() (which replaces local storage with the cloud copy) would drop
 * them. Only newly imported trades are queued: re-uploading older local records
 * could create duplicates for rows whose local id predates id-sharing with
 * Supabase. Duplicate uploads are harmless anyway — the queue retry treats a
 * 23505 duplicate-key response as success.
 */
export function queueTradesForCloud(trades: unknown[]) {
  let queued = 0
  for (const trade of trades) {
    const row = toDbRow(trade as Record<string, any>)
    if (!row) continue
    addToQueue({ table: "trades", action: "insert", data: row, id: row.id })
    queued++
  }
  if (queued > 0) console.info(`Queued ${queued} imported trade(s) for upload`)
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
/**
 * Syncs whenever the browser comes back online. Returns a teardown function:
 * callers MUST use it as their effect cleanup, otherwise every remount stacks
 * another permanent listener and each reconnect fires N redundant syncs.
 */
export function setupSyncListener(): () => void {
  const handleOnline = () => {
    console.log("Back online — syncing...")
    void syncPending().catch((error) => console.error("Background sync failed:", error))
  }

  window.addEventListener("online", handleOnline)
  return () => window.removeEventListener("online", handleOnline)
}
