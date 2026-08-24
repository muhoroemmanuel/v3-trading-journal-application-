import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { getBatchPrices, MarketDataNotConfiguredError, MarketDataRequestError } from "@/lib/market-data"
import { sendAlertEmail } from "@/lib/email"

// Triggered on a schedule by .github/workflows/check-price-alerts.yml
// rather than Vercel's own Cron — Vercel's Hobby plan only allows
// once-per-day cron, which is far too infrequent for price alerts.
// GitHub Actions' schedule is free and can run every few minutes instead.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase isn't configured (missing SUPABASE_SERVICE_ROLE_KEY)." }, { status: 503 })
  }

  const { data: alerts, error: fetchError } = await supabase
    .from("price_alerts")
    .select("id, user_id, currency_pair, direction, target_price")
    .eq("status", "active")

  if (fetchError) {
    console.error("check-price-alerts: failed to load alerts", fetchError)
    return NextResponse.json({ error: "Couldn't load active alerts." }, { status: 500 })
  }

  if (!alerts || alerts.length === 0) {
    return NextResponse.json({ checked: 0, triggered: 0 })
  }

  let prices: Record<string, number>
  try {
    prices = await getBatchPrices(alerts.map((a) => a.currency_pair))
  } catch (err) {
    const message =
      err instanceof MarketDataNotConfiguredError
        ? err.message
        : err instanceof MarketDataRequestError
          ? err.message
          : "Couldn't fetch current prices."
    console.error("check-price-alerts: price fetch failed", err)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const emailCache = new Map<string, string | null>()
  const getUserEmail = async (userId: string): Promise<string | null> => {
    if (emailCache.has(userId)) return emailCache.get(userId)!
    const { data, error } = await supabase.auth.admin.getUserById(userId)
    const email = !error ? data.user?.email ?? null : null
    emailCache.set(userId, email)
    return email
  }

  let triggeredCount = 0

  for (const alert of alerts) {
    const currentPrice = prices[alert.currency_pair]
    if (currentPrice === undefined) continue

    const isTriggered =
      alert.direction === "above" ? currentPrice >= alert.target_price : currentPrice <= alert.target_price

    if (!isTriggered) continue

    const { error: updateError } = await supabase
      .from("price_alerts")
      .update({ status: "triggered", triggered_at: new Date().toISOString(), triggered_price: currentPrice })
      .eq("id", alert.id)
      .eq("status", "active") // guards against double-triggering if a sweep overlaps

    if (updateError) {
      console.error("check-price-alerts: failed to mark alert triggered", alert.id, updateError)
      continue
    }

    triggeredCount++

    const email = await getUserEmail(alert.user_id)
    if (email) {
      await sendAlertEmail(
        email,
        `Price alert: ${alert.currency_pair} ${alert.direction} ${alert.target_price}`,
        `${alert.currency_pair} just hit ${currentPrice} — your alert was set for ${alert.direction} ${alert.target_price}.`,
      )
    }
  }

  return NextResponse.json({ checked: alerts.length, triggered: triggeredCount })
}
