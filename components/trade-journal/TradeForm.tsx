"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import type { UseTradeFormReturn } from "./hooks/useTradeForm"

interface Props {
  form: UseTradeFormReturn
}

export function TradeForm({ form }: Props) {
  const { stopLossPL, takeProfitPL } = form.calculatePotentialPL()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Currency Pair</Label>
          {!form.showCustomInput ? (
            <Select value={form.currencyPair} onValueChange={form.setCurrencyPair}>
              <SelectTrigger><SelectValue placeholder="Select pair" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {form.currencyPairs.map((pair: string) => (
                  <SelectItem key={pair} value={pair}>{pair}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={form.customPairInput}
              onChange={(e) => form.setCustomPairInput(e.target.value)}
              placeholder="e.g. EUR/USD"
            />
          )}
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              form.setShowCustomInput(!form.showCustomInput)
              if (form.showCustomInput) form.setCustomPairInput("")
            }}
          >
            {form.showCustomInput ? "Choose from list" : "Enter custom pair"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Action</Label>
          <Select value={form.action} onValueChange={(v) => form.setAction(v as "buy" | "sell")}>
            <SelectTrigger><SelectValue placeholder="Buy or Sell" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Buy (Long)</SelectItem>
              <SelectItem value="sell">Sell (Short)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Entry Price</Label>
          <Input type="number" step="0.00001" value={form.entryPrice} onChange={(e) => form.setEntryPrice(e.target.value)} placeholder="1.0850" />
        </div>
        <div className="space-y-2">
          <Label>Position Size (Lots)</Label>
          <Input type="number" step="0.01" value={form.positionSize} onChange={(e) => form.setPositionSize(e.target.value)} placeholder="0.10" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Stop Loss</Label>
          <Input type="number" step="0.00001" value={form.stopLossPrice} onChange={(e) => form.setStopLossPrice(e.target.value)} placeholder="1.0800" />
          {stopLossPL !== 0 && (
            <p className={`text-sm ${stopLossPL < 0 ? "text-red-500" : "text-green-500"}`}>
              Potential: {stopLossPL < 0 ? "-" : "+"}${Math.abs(stopLossPL).toFixed(2)}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Take Profit</Label>
          <Input type="number" step="0.00001" value={form.takeProfitPrice} onChange={(e) => form.setTakeProfitPrice(e.target.value)} placeholder="1.0950" />
          {takeProfitPL !== 0 && (
            <p className={`text-sm ${takeProfitPL < 0 ? "text-red-500" : "text-green-500"}`}>
              Potential: {takeProfitPL < 0 ? "-" : "+"}${Math.abs(takeProfitPL).toFixed(2)}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Trade Status</Label>
          <Select value={form.tradeStatus} onValueChange={(v) => form.setTradeStatus(v as "open" | "closed")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.tradeStatus === "closed" && (
          <div className="space-y-2">
            <Label>Exit Price</Label>
            <Input type="number" step="0.00001" value={form.exitPrice} onChange={(e) => form.setExitPrice(e.target.value)} placeholder="1.0900" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => form.setNotes(e.target.value)}
          placeholder="Trade rationale, emotions, lessons learned..."
          rows={4}
        />
      </div>
    </div>
  )
}
