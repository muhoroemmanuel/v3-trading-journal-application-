import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase-server"
import { provisionAccount, MetaApiNotConfiguredError, MetaApiRequestError } from "@/lib/metaapi"

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if ("error" in auth) return auth.error
  const { supabase, user } = auth

  const { data, error } = await supabase
    .from("broker_connections")
    .select("id, platform, server, account_login, status, error_message, last_synced_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("broker-accounts GET:", error)
    return NextResponse.json({ error: "Couldn't load broker connections." }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if ("error" in auth) return auth.error
  const { supabase, user } = auth

  const body = await request.json().catch(() => null)
  const { platform, server, accountNumber, password } = body ?? {}

  if (!platform || !server || !accountNumber || !password) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 })
  }
  if (platform !== "MT4" && platform !== "MT5") {
    return NextResponse.json({ error: "Platform must be MT4 or MT5." }, { status: 400 })
  }

  // Insert a "connecting" row first so the UI has something to show
  // immediately, before we hear back from MetaApi (provisioning can take
  // a while as it spins up a terminal connection to the actual broker).
  const { data: row, error: insertError } = await supabase
    .from("broker_connections")
    .insert({
      user_id: user.id,
      platform: platform.toLowerCase(),
      server,
      account_login: accountNumber,
      metaapi_account_id: "", // filled in below once MetaApi responds
      status: "connecting",
    })
    .select()
    .single()

  if (insertError || !row) {
    console.error("broker-accounts POST insert:", insertError)
    return NextResponse.json({ error: "Couldn't save the connection." }, { status: 500 })
  }

  try {
    const result = await provisionAccount({
      platform: platform.toLowerCase() as "mt4" | "mt5",
      server,
      login: accountNumber,
      password,
      name: `Trading Journal — ${accountNumber}`,
    })

    const { data: updated, error: updateError } = await supabase
      .from("broker_connections")
      .update({ metaapi_account_id: result.id, status: "connecting" })
      .eq("id", row.id)
      .select("id, platform, server, account_login, status, error_message, last_synced_at, created_at")
      .single()

    if (updateError) {
      console.error("broker-accounts POST update:", updateError)
    }

    return NextResponse.json(updated ?? row, { status: 201 })
  } catch (err) {
    const message =
      err instanceof MetaApiNotConfiguredError
        ? "Broker sync isn't configured on this deployment (missing METAAPI_TOKEN)."
        : err instanceof MetaApiRequestError
          ? err.message
          : "Couldn't connect to MetaApi."

    await supabase.from("broker_connections").update({ status: "error", error_message: message }).eq("id", row.id)

    return NextResponse.json({ error: message }, { status: 502 })
  }
}
