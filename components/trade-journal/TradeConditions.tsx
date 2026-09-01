"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { X, Plus } from "lucide-react"
import type { UseTradeFormReturn } from "./hooks/useTradeForm"

interface Props {
  form: UseTradeFormReturn
}

export function TradeConditions({ form }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Trade Conditions</h3>
      <div className="space-y-2">
        {form.conditions.map((condition: typeof form.conditions[0]) => (
          <div key={condition.id} className="flex items-center gap-3 p-2 rounded-lg border">
            <Checkbox
              checked={condition.checked}
              onCheckedChange={() => form.toggleCondition(condition.id)}
            />
            <span className="flex-1 text-sm">{condition.description}</span>
            {condition.checked && (
              <div className="flex items-center gap-2 w-32">
                <Slider
                  value={[condition.confidence]}
                  onValueChange={([v]) => form.updateConfidence(condition.id, v)}
                  min={0}
                  max={100}
                  step={5}
                />
                <span className="text-xs w-8 text-right">{condition.confidence}%</span>
              </div>
            )}
            {condition.id.length > 2 && (
              <Button variant="ghost" size="icon" onClick={() => form.removeCondition(condition.id)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={form.newCondition}
          onChange={(e) => form.setNewCondition(e.target.value)}
          placeholder="Add custom condition..."
          className="flex-1"
        />
        <Slider
          value={[form.newConfidence]}
          onValueChange={([v]) => form.setNewConfidence(v)}
          min={0}
          max={100}
          step={5}
          className="w-24"
        />
        <Button onClick={form.addCustomCondition} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
