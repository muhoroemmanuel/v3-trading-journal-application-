// Behavioral pattern detection over a user's real trade history.
//
// This is the piece that turns the AI coach from a generic chatbot into
// something that actually reasons about *this* user's trading psychology.
// Everything here is deterministic (no LLM call) — it runs over the trades
// pulled from Supabase and produces a compact, human-readable summary that
// gets embedded in the system prompt sent to OpenAI.

export interface TradeForAnalysis {
  id: string
  currency_pair: string
  action: "buy" | "sell"
  position_size: number
  status: "open" | "closed"
  profit_loss: number | null
  created_at: string
}

export interface RevengeTradeFlag {
  afterTradeId: string
  nextTradeId: string
  priorLoss: number
  sizeIncreasePct: number
}

export interface OverconfidenceFlag {
  streakLength: number
  nextTradeId: string
  sizeIncreasePct: number
}

export interface PsychologyInsights {
  totalTrades: number
  closedTrades: number
  winRate: number | null
  avgPositionSize: number
  currentStreak: { type: "win" | "loss" | "none"; length: number }
  revengeTrades: RevengeTradeFlag[]
  overconfidenceEvents: OverconfidenceFlag[]
  maxConsecutiveLosses: number
  /** Compact natural-language summary to inject into the coach's system prompt. */
  summary: string
}

const REVENGE_SIZE_THRESHOLD = 1.3 // 30% larger position after a loss
const OVERCONFIDENCE_SIZE_THRESHOLD = 1.3 // 30% larger after a win streak
const OVERCONFIDENCE_MIN_STREAK = 3

export function analyzeTradingPsychology(trades: TradeForAnalysis[]): PsychologyInsights {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  const closed = sorted.filter((t) => t.status === "closed" && t.profit_loss !== null)

  const wins = closed.filter((t) => (t.profit_loss ?? 0) > 0)
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : null

  const avgPositionSize =
    sorted.length > 0 ? sorted.reduce((sum, t) => sum + t.position_size, 0) / sorted.length : 0

  // Walk the closed trades in order, flagging size jumps that follow a loss
  // (revenge trading) or follow a win streak (overconfidence).
  const revengeTrades: RevengeTradeFlag[] = []
  const overconfidenceEvents: OverconfidenceFlag[] = []
  let winStreak = 0
  let lossStreak = 0
  let maxConsecutiveLosses = 0

  for (let i = 0; i < closed.length; i++) {
    const trade = closed[i]
    const pl = trade.profit_loss ?? 0
    const prev = i > 0 ? closed[i - 1] : null

    if (pl < 0) {
      lossStreak++
      winStreak = 0
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, lossStreak)

      if (prev && trade.position_size > prev.position_size * REVENGE_SIZE_THRESHOLD) {
        revengeTrades.push({
          afterTradeId: prev.id,
          nextTradeId: trade.id,
          priorLoss: prev.profit_loss ?? 0,
          sizeIncreasePct: Math.round((trade.position_size / prev.position_size - 1) * 100),
        })
      }
    } else if (pl > 0) {
      // Check overconfidence based on the streak *entering* this trade
      if (
        winStreak >= OVERCONFIDENCE_MIN_STREAK &&
        prev &&
        trade.position_size > prev.position_size * OVERCONFIDENCE_SIZE_THRESHOLD
      ) {
        overconfidenceEvents.push({
          streakLength: winStreak,
          nextTradeId: trade.id,
          sizeIncreasePct: Math.round((trade.position_size / prev.position_size - 1) * 100),
        })
      }
      winStreak++
      lossStreak = 0
    }
  }

  // Current streak, most recent trade first
  let currentStreak: PsychologyInsights["currentStreak"] = { type: "none", length: 0 }
  for (let i = closed.length - 1; i >= 0; i--) {
    const pl = closed[i].profit_loss ?? 0
    const type = pl > 0 ? "win" : pl < 0 ? "loss" : "none"
    if (i === closed.length - 1) {
      currentStreak = { type, length: type === "none" ? 0 : 1 }
    } else if (type === currentStreak.type) {
      currentStreak.length++
    } else {
      break
    }
  }

  const summary = buildSummary({
    totalTrades: sorted.length,
    closedTrades: closed.length,
    winRate,
    currentStreak,
    revengeTrades,
    overconfidenceEvents,
    maxConsecutiveLosses,
  })

  return {
    totalTrades: sorted.length,
    closedTrades: closed.length,
    winRate,
    avgPositionSize,
    currentStreak,
    revengeTrades,
    overconfidenceEvents,
    maxConsecutiveLosses,
    summary,
  }
}

function buildSummary(data: {
  totalTrades: number
  closedTrades: number
  winRate: number | null
  currentStreak: PsychologyInsights["currentStreak"]
  revengeTrades: RevengeTradeFlag[]
  overconfidenceEvents: OverconfidenceFlag[]
  maxConsecutiveLosses: number
}): string {
  if (data.totalTrades === 0) {
    return "This user has no logged trades yet — coach them on getting started with disciplined journaling, not on patterns yet."
  }

  const lines: string[] = []
  lines.push(`Total trades: ${data.totalTrades} (${data.closedTrades} closed).`)
  if (data.winRate !== null) {
    lines.push(`Win rate: ${data.winRate.toFixed(1)}%.`)
  }
  if (data.currentStreak.length > 0) {
    lines.push(`Currently on a ${data.currentStreak.length}-trade ${data.currentStreak.type} streak.`)
  }
  if (data.maxConsecutiveLosses >= 3) {
    lines.push(`Worst losing streak on record: ${data.maxConsecutiveLosses} consecutive losses.`)
  }
  if (data.revengeTrades.length > 0) {
    lines.push(
      `Revenge-trading pattern detected: ${data.revengeTrades.length} time(s) this user increased position size by 30%+ immediately after a loss (most recent: +${data.revengeTrades[data.revengeTrades.length - 1].sizeIncreasePct}% size after a loss).`,
    )
  }
  if (data.overconfidenceEvents.length > 0) {
    const latest = data.overconfidenceEvents[data.overconfidenceEvents.length - 1]
    lines.push(
      `Overconfidence pattern detected: ${data.overconfidenceEvents.length} time(s) this user increased position size by 30%+ after a win streak of 3+ (most recent: +${latest.sizeIncreasePct}% size after a ${latest.streakLength}-trade win streak).`,
    )
  }
  if (data.revengeTrades.length === 0 && data.overconfidenceEvents.length === 0) {
    lines.push("No revenge-trading or overconfidence sizing patterns detected yet in the available history.")
  }
  return lines.join(" ")
}
