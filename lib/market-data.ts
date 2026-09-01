// Thin wrapper around Twelve Data's price endpoint. Free tier: 8 requests/
// minute, 800/day — batching every distinct pair into ONE request (Twelve
// Data supports comma-separated symbols) is what keeps this well inside
// that budget regardless of how many users have active alerts.

export class MarketDataNotConfiguredError extends Error {
  constructor() {
    super("Market data isn't configured (missing TWELVE_DATA_API_KEY).")
    this.name = "MarketDataNotConfiguredError"
  }
}

export class MarketDataRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MarketDataRequestError"
  }
}

/**
 * Fetches current prices for a batch of forex pairs (e.g. ["EUR/USD",
 * "GBP/USD"]) in a single request. Returns a map of pair -> price; pairs
 * Twelve Data couldn't resolve are simply omitted from the result rather
 * than failing the whole batch.
 */
export async function getBatchPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {}

  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) throw new MarketDataNotConfiguredError()

  const unique = Array.from(new Set(symbols))
  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(unique.join(","))}&apikey=${apiKey}`

  const response = await fetch(url)
  const data = await response.json()

  if (data?.status === "error" || data?.code >= 400) {
    throw new MarketDataRequestError(data?.message || "Twelve Data request failed.")
  }

  const result: Record<string, number> = {}

  if (unique.length === 1) {
    // Single-symbol requests return a flat { price: "..." } shape rather
    // than keyed by symbol.
    const price = Number.parseFloat(data?.price)
    if (!Number.isNaN(price)) result[unique[0]] = price
    return result
  }

  for (const symbol of unique) {
    const entry = data?.[symbol]
    const price = Number.parseFloat(entry?.price)
    if (!Number.isNaN(price)) result[symbol] = price
  }

  return result
}
