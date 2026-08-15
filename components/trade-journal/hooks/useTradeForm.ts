"use client"

import { useState, useCallback } from "react"
import { toast } from "@/hooks/use-toast"
import { tradeSchema } from "@/lib/trade-schema"

export interface Condition {
  id: string
  description: string
  confidence: number
  checked: boolean
}

export interface Trade {
  id: string
  currencyPair: string
  action: "buy" | "sell"
  date: string
  conditions: Condition[]
  entryPrice: number
  stopLossPrice: number
  takeProfitPrice: number
  exitPrice?: number
  positionSize: number
  status: "open" | "closed"
  profitLoss?: number
  notes: string
  images?: Array<{
    id: string
    fileName: string
    fileType: string
    fileSize: number
    caption: string
    preview: string
  }>
}

const defaultConditions: Condition[] = [
  { id: "1", description: "Price Action", confidence: 0, checked: false },
  { id: "2", description: "Support/Resistance", confidence: 0, checked: false },
  { id: "3", description: "Trend Following", confidence: 0, checked: false },
  { id: "4", description: "Breakout", confidence: 0, checked: false },
  { id: "5", description: "Reversal", confidence: 0, checked: false },
  { id: "6", description: "News/Event", confidence: 0, checked: false },
  { id: "7", description: "Technical Indicator", confidence: 0, checked: false },
  { id: "8", description: "Risk Management", confidence: 0, checked: false },
]

const currencyPairs = [
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD",
  "NZD/USD", "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "EUR/AUD",
  "GBP/AUD", "USD/SGD", "EUR/CHF", "GBP/CHF", "CAD/JPY", "AUD/NZD",
  "EUR/CAD", "GBP/CAD", "EUR/NZD", "GBP/NZD", "AUD/CAD", "NZD/JPY",
  "AUD/CHF", "NZD/CHF", "CAD/CHF", "EUR/NOK", "USD/NOK", "USD/SEK",
  "EUR/SEK", "USD/DKK", "EUR/DKK", "USD/ZAR", "EUR/ZAR", "GBP/ZAR",
  "USD/MXN", "EUR/MXN", "USD/PLN", "EUR/PLN", "USD/HUF", "EUR/HUF",
  "USD/CZK", "EUR/CZK", "USD/TRY", "EUR/TRY", "GBP/TRY", "USD/RUB",
  "EUR/RUB", "USD/CNH", "EUR/CNH", "GBP/CNH", "AUD/CNH", "NZD/CNH",
  "XAU/USD", "XAG/USD", "US30", "US100", "DE40", "UK100", "JP225",
  "AUS200", "FRA40", "EUSTX50", "NAS100", "SPX500", "HK50",
]

export function useTradeForm() {
  const [currencyPair, setCurrencyPair] = useState("")
  const [customPairInput, setCustomPairInput] = useState("")
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [action, setAction] = useState<"buy" | "sell" | "">("")
  const [conditions, setConditions] = useState<Condition[]>(defaultConditions)
  const [newCondition, setNewCondition] = useState("")
  const [newConfidence, setNewConfidence] = useState(50)
  const [entryPrice, setEntryPrice] = useState("")
  const [stopLossPrice, setStopLossPrice] = useState("")
  const [takeProfitPrice, setTakeProfitPrice] = useState("")
  const [positionSize, setPositionSize] = useState("")
  const [tradeStatus, setTradeStatus] = useState<"open" | "closed">("open")
  const [exitPrice, setExitPrice] = useState("")
  const [notes, setNotes] = useState("")

  const toggleCondition = useCallback((id: string) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    )
  }, [])

  const updateConfidence = useCallback((id: string, value: number) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, confidence: value } : c))
    )
  }, [])

  const addCustomCondition = useCallback(() => {
    if (!newCondition.trim()) {
      toast({ title: "Error", description: "Enter a condition description", variant: "destructive" })
      return
    }
    const newCond: Condition = {
      id: crypto.randomUUID(),
      description: newCondition.trim(),
      confidence: newConfidence,
      checked: true,
    }
    setConditions((prev) => [...prev, newCond])
    setNewCondition("")
    setNewConfidence(50)
  }, [newCondition, newConfidence])

  const removeCondition = useCallback((id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const calculatePotentialPL = useCallback(() => {
    const entry = Number.parseFloat(entryPrice)
    const sl = stopLossPrice ? Number.parseFloat(stopLossPrice) : 0
    const tp = takeProfitPrice ? Number.parseFloat(takeProfitPrice) : 0
    const size = Number.parseFloat(positionSize)

    if (isNaN(entry) || entry <= 0 || isNaN(size) || size <= 0) {
      return { stopLossPL: 0, takeProfitPL: 0 }
    }

    let stopLossPL = 0
    let takeProfitPL = 0

    if (action === "buy") {
      takeProfitPL = tp > 0 ? (tp - entry) * size : 0
      stopLossPL = sl > 0 ? (sl - entry) * size : 0
    } else if (action === "sell") {
      takeProfitPL = tp > 0 ? (entry - tp) * size : 0
      stopLossPL = sl > 0 ? (entry - sl) * size : 0
    }

    return { stopLossPL, takeProfitPL }
  }, [action, entryPrice, stopLossPrice, takeProfitPrice, positionSize])

  const calculateActualPL = useCallback(() => {
    if (tradeStatus !== "closed" || !exitPrice) return undefined
    const entry = Number.parseFloat(entryPrice)
    const exit = Number.parseFloat(exitPrice)
    const size = Number.parseFloat(positionSize)

    if (isNaN(entry) || isNaN(exit) || isNaN(size)) return undefined

    if (action === "buy") return (exit - entry) * size
    if (action === "sell") return (entry - exit) * size
    return undefined
  }, [tradeStatus, exitPrice, action, entryPrice, positionSize])

  const validate = useCallback((): { valid: boolean; errors: string[] } => {
    const parseResult = tradeSchema.safeParse({
      currencyPair: showCustomInput ? customPairInput : currencyPair,
      action,
      entryPrice: entryPrice ? Number.parseFloat(entryPrice) : undefined,
      stopLossPrice: stopLossPrice ? Number.parseFloat(stopLossPrice) : undefined,
      takeProfitPrice: takeProfitPrice ? Number.parseFloat(takeProfitPrice) : undefined,
      positionSize: positionSize ? Number.parseFloat(positionSize) : undefined,
      notes: notes || undefined,
    })

    if (!parseResult.success) {
      return { valid: false, errors: parseResult.error.errors.map((e) => e.message) }
    }

    const errors: string[] = []
    const entry = Number.parseFloat(entryPrice)
    const sl = stopLossPrice ? Number.parseFloat(stopLossPrice) : 0
    const tp = takeProfitPrice ? Number.parseFloat(takeProfitPrice) : 0

    if (isNaN(entry) || entry <= 0) errors.push("Entry price must be a positive number")
    if (stopLossPrice && (isNaN(sl) || sl <= 0)) errors.push("Stop loss must be a positive number")
    if (takeProfitPrice && (isNaN(tp) || tp <= 0)) errors.push("Take profit must be a positive number")
    const size = Number.parseFloat(positionSize)
    if (isNaN(size) || size <= 0) errors.push("Position size must be a positive number")

    if (action === "buy") {
      if (stopLossPrice && sl >= entry) errors.push("For BUY, stop loss must be below entry")
      if (takeProfitPrice && tp <= entry) errors.push("For BUY, take profit must be above entry")
    } else if (action === "sell") {
      if (stopLossPrice && sl <= entry) errors.push("For SELL, stop loss must be above entry")
      if (takeProfitPrice && tp >= entry) errors.push("For SELL, take profit must be below entry")
    }

    if (stopLossPrice && takeProfitPrice && action && !isNaN(entry) && !isNaN(sl) && !isNaN(tp) && entry > 0) {
      const risk = Math.abs(entry - sl)
      const reward = Math.abs(tp - entry)
      if (reward > 0 && risk > 0 && reward < risk) {
        errors.push("Warning: Reward is less than risk")
      }
    }

    if (!conditions.some((c) => c.checked)) {
      errors.push("Please select at least one condition")
    }

    return { valid: errors.length === 0, errors }
  }, [currencyPair, customPairInput, showCustomInput, action, entryPrice, stopLossPrice, takeProfitPrice, positionSize, notes, conditions])

  const toTradeObject = useCallback((images?: Trade["images"]): Trade => {
    const profitLoss = calculateActualPL()
    return {
      id: crypto.randomUUID(),
      currencyPair: showCustomInput ? customPairInput : currencyPair,
      action: action as "buy" | "sell",
      date: new Date().toISOString(),
      conditions: conditions.filter((c) => c.checked),
      entryPrice: Number.parseFloat(entryPrice),
      stopLossPrice: stopLossPrice ? Number.parseFloat(stopLossPrice) : 0,
      takeProfitPrice: takeProfitPrice ? Number.parseFloat(takeProfitPrice) : 0,
      exitPrice: exitPrice ? Number.parseFloat(exitPrice) : undefined,
      positionSize: Number.parseFloat(positionSize),
      status: tradeStatus,
      profitLoss,
      notes: notes.trim(),
      images,
    }
  }, [currencyPair, customPairInput, showCustomInput, action, entryPrice, stopLossPrice, takeProfitPrice, exitPrice, positionSize, tradeStatus, notes, conditions, calculateActualPL])

  const reset = useCallback(() => {
    setCurrencyPair("")
    setCustomPairInput("")
    setShowCustomInput(false)
    setAction("")
    setConditions(defaultConditions)
    setNewCondition("")
    setNewConfidence(50)
    setEntryPrice("")
    setStopLossPrice("")
    setTakeProfitPrice("")
    setPositionSize("")
    setTradeStatus("open")
    setExitPrice("")
    setNotes("")
  }, [])

  const loadPreset = useCallback((preset: { conditions: Condition[] }) => {
    setConditions(preset.conditions.map((c) => ({ ...c, checked: true })))
  }, [])

  return {
    // State
    currencyPair, setCurrencyPair,
    customPairInput, setCustomPairInput,
    showCustomInput, setShowCustomInput,
    action, setAction,
    conditions,
    newCondition, setNewCondition,
    newConfidence, setNewConfidence,
    entryPrice, setEntryPrice,
    stopLossPrice, setStopLossPrice,
    takeProfitPrice, setTakeProfitPrice,
    positionSize, setPositionSize,
    tradeStatus, setTradeStatus,
    exitPrice, setExitPrice,
    notes, setNotes,
    // Actions
    toggleCondition,
    updateConfidence,
    addCustomCondition,
    removeCondition,
    calculatePotentialPL,
    calculateActualPL,
    validate,
    toTradeObject,
    reset,
    loadPreset,
    // Constants
    currencyPairs,
  }
}
