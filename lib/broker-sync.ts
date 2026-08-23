import type { MetatraderDeal } from "@/lib/metaapi"

export interface MappedTrade {
  broker_position_id: string
  currency_pair: string
  action: "buy" | "sell"
  entry_price: number
  exit_price: number | null
  position_size: number
  status: "open" | "closed"
  profit_loss: number | null
  created_at: string
}

/**
 * Groups raw MetaTrader deals into journal-style trades, one per position.
 *
 * A single round-trip trade is at least two deals in MT4/5: a DEAL_ENTRY_IN
 * (opens the position) and a DEAL_ENTRY_OUT (closes it), both sharing the
 * same positionId. This takes the first IN deal for entry price/size/side,
 * and — if present — the last OUT deal for exit price, summing profit +
 * commission + swap across all OUT deals for the position's realized P/L.
 *
 * Known limitation: partial closes are collapsed into a single journal
 * entry using the original entry size, rather than split into separate
 * entries per partial exit. Good enough for a first working sync; revisit
 * if partial-close tracking turns out to matter for your trading style.
 */
export function mapDealsToTrades(deals: MetatraderDeal[]): MappedTrade[] {
  const byPosition = new Map<string, MetatraderDeal[]>()

  for (const deal of deals) {
    if (!deal.positionId) continue // balance/credit adjustments etc. — not a trade
    if (deal.type !== "DEAL_TYPE_BUY" && deal.type !== "DEAL_TYPE_SELL") continue
    const list = byPosition.get(deal.positionId) ?? []
    list.push(deal)
    byPosition.set(deal.positionId, list)
  }

  const trades: MappedTrade[] = []

  for (const [positionId, positionDeals] of byPosition) {
    const sorted = [...positionDeals].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

    const entryDeal = sorted.find((d) => d.entryType === "DEAL_ENTRY_IN") ?? sorted[0]
    const exitDeals = sorted.filter((d) => d.entryType === "DEAL_ENTRY_OUT" || d.entryType === "DEAL_ENTRY_INOUT")
    const isClosed = exitDeals.length > 0
    const lastExit = exitDeals[exitDeals.length - 1]

    const realizedPL = exitDeals.reduce(
      (sum, d) => sum + (d.profit ?? 0) + (d.commission ?? 0) + (d.swap ?? 0),
      0,
    )

    trades.push({
      broker_position_id: positionId,
      currency_pair: entryDeal.symbol ?? "UNKNOWN",
      action: entryDeal.type === "DEAL_TYPE_SELL" ? "sell" : "buy",
      entry_price: entryDeal.price ?? 0,
      exit_price: isClosed ? (lastExit.price ?? null) : null,
      position_size: entryDeal.volume ?? 0,
      status: isClosed ? "closed" : "open",
      profit_loss: isClosed ? realizedPL : null,
      created_at: entryDeal.time,
    })
  }

  return trades
}
