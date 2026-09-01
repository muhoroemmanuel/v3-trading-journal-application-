import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase-server"
import { getAccount, getHistoryDeals, MetaApiNotConfiguredError, MetaApiRequestError } from "@/lib/metaapi"
import { mapDealsToTrades } from "@/lib/broker-sync"

// MetaApi's regional client-api calls can occasionally be slow (they're
// reading from a live broker terminal connection, not a simple cache) —
// give this route more room than Next's default. Hobby-tier Vercel plans
// cap this at 60s; adjust down if you're on that tier and hit a limit.
export const maxDuration = 60


// How far back to look on a *first* sync (MT4/5 accounts can have years of
// history — 90 days keeps the initial import fast and relevant to current
// trading habits, not a full account history dump).
const INITIAL_SYNC_LOOKBACK_DAYS = 90
// On repeat syncs, re-fetch a small overlap window before the last sync
// time rather than exactly from last_synced_at, so a deal that hadn't
// fully settled yet at the last sync still gets picked up.
const RESYNC_OVERLAP_HOURS = 24

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request)
  if ("error" in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params

  const { data: connection, error: fetchError } = await supabase
    .from("broker_connections")
    .select("id, metaapi_account_id, last_synced_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !connection) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 })
  }

  if (!connection.metaapi_account_id) {
    return NextResponse.json({ error: "This connection hasn't finished provisioning yet." }, { status: 409 })
  }

  try {
    const account = await getAccount(connection.metaapi_account_id)

    // The MT terminal MetaApi spins up on the broker's behalf can take a
    // little while to actually connect — this isn't an error, just "not
    // ready yet". Report it plainly rather than treating it as a failure.
    if (account.connectionStatus !== "CONNECTED") {
      await supabase
        .from("broker_connections")
        .update({ status: "connecting", error_message: null })
        .eq("id", id)
      return NextResponse.json(
        { status: "connecting", message: "Still connecting to your broker terminal — try syncing again in a moment." },
        { status: 202 },
      )
    }

    const endTime = new Date()
    const startTime = connection.last_synced_at
      ? new Date(new Date(connection.last_synced_at).getTime() - RESYNC_OVERLAP_HOURS * 60 * 60 * 1000)
      : new Date(endTime.getTime() - INITIAL_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

    const deals = await getHistoryDeals(connection.metaapi_account_id, account.region, startTime, endTime)
    const mapped = mapDealsToTrades(deals)

    if (mapped.length > 0) {
      const { error: upsertError } = await supabase.from("trades").upsert(
        mapped.map((trade) => ({
          user_id: user.id,
          broker_connection_id: id,
          broker_position_id: trade.broker_position_id,
          currency_pair: trade.currency_pair,
          action: trade.action,
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          position_size: trade.position_size,
          status: trade.status,
          profit_loss: trade.profit_loss,
          conditions: [],
          images: [],
          created_at: trade.created_at,
        })),
        { onConflict: "user_id,broker_position_id" },
      )

      if (upsertError) {
        console.error("broker sync: trades upsert failed", upsertError)
        return NextResponse.json({ error: "Fetched trades from your broker but couldn't save them." }, { status: 500 })
      }
    }

    await supabase
      .from("broker_connections")
      .update({ status: "connected", error_message: null, last_synced_at: endTime.toISOString() })
      .eq("id", id)

    return NextResponse.json({ status: "connected", imported: mapped.length })
  } catch (err) {
    const message =
      err instanceof MetaApiNotConfiguredError
        ? "Broker sync isn't configured on this deployment (missing METAAPI_TOKEN)."
        : err instanceof MetaApiRequestError
          ? err.message
          : "Couldn't sync with your broker."

    await supabase.from("broker_connections").update({ status: "error", error_message: message }).eq("id", id)
    console.error("broker-accounts sync error:", err)

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
