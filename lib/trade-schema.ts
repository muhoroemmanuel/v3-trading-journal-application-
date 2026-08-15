import { z } from "zod"

export const tradeSchema = z.object({
  currencyPair: z.string().min(1, "Currency pair is required"),
  action: z.enum(["buy", "sell"]),
  entryPrice: z.number().positive("Entry price must be a positive number"),
  stopLossPrice: z.number().positive().optional(),
  takeProfitPrice: z.number().positive().optional(),
  positionSize: z.number().positive("Position size must be a positive number"),
  notes: z.string().max(2000, "Notes must be under 2000 characters").optional(),
})

export type TradeInput = z.infer<typeof tradeSchema>
