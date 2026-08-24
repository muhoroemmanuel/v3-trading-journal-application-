import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase-server"

const VALID_DIRECTIONS = ["above", "below"]

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if ("error" in auth) return auth.error
  const { supabase, user } = auth

  const { data, error } = await supabase
    .from("price_alerts")
    .select("id, currency_pair, direction, target_price, status, triggered_at, triggered_price, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: "Couldn't load alerts." }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if ("error" in auth) return auth.error
  const { supabase, user } = auth

  const body = await request.json().catch(() => null)
  const currencyPair = body?.currency_pair?.trim()
  const direction = body?.direction
  const targetPrice = Number.parseFloat(body?.target_price)

  if (!currencyPair || !VALID_DIRECTIONS.includes(direction) || Number.isNaN(targetPrice) || targetPrice <= 0) {
    return NextResponse.json(
      { error: "A currency pair, direction (above/below), and a positive target price are required." },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from("price_alerts")
    .insert({ user_id: user.id, currency_pair: currencyPair, direction, target_price: targetPrice })
    .select("id, currency_pair, direction, target_price, status, triggered_at, triggered_price, created_at")
    .single()

  if (error) return NextResponse.json({ error: "Couldn't create alert." }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
