"use client"

import { useState, useCallback, useEffect } from "react"
import { toast } from "@/hooks/use-toast"
import type { Condition } from "./useTradeForm"

export interface Preset {
  id: string
  name: string
  conditions: Condition[]
  createdAt: string
}

export type UseTradePresetsReturn = ReturnType<typeof useTradePresets>

export function useTradePresets() {
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetName, setPresetName] = useState("")
  const [showPresetDialog, setShowPresetDialog] = useState(false)

  // Mount-only browser hydration: localStorage does not exist during SSR, so
  // this cannot move into the useState initializer.
  useEffect(() => {
    const saved = localStorage.getItem("tradePresets")
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only hydration, see above.
      try { setPresets(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

  const saveToStorage = useCallback((updated: Preset[]) => {
    localStorage.setItem("tradePresets", JSON.stringify(updated))
  }, [])

  const savePreset = useCallback((conditions: Condition[]) => {
    if (!presetName.trim()) {
      toast({ title: "Error", description: "Enter a preset name", variant: "destructive" })
      return
    }
    const checked = conditions.filter((c) => c.checked)
    if (checked.length === 0) {
      toast({ title: "Error", description: "Select at least one condition", variant: "destructive" })
      return
    }
    const newPreset: Preset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      conditions: checked.map((c) => ({ ...c })),
      createdAt: new Date().toISOString(),
    }
    const updated = [...presets, newPreset]
    setPresets(updated)
    saveToStorage(updated)
    setPresetName("")
    setShowPresetDialog(false)
    toast({ title: "Preset Saved", description: `"${newPreset.name}" saved successfully` })
  }, [presetName, presets, saveToStorage])

  const deletePreset = useCallback((id: string) => {
    const updated = presets.filter((p) => p.id !== id)
    setPresets(updated)
    saveToStorage(updated)
    toast({ title: "Preset Deleted", description: "Preset removed successfully" })
  }, [presets, saveToStorage])

  return {
    presets,
    presetName,
    setPresetName,
    showPresetDialog,
    setShowPresetDialog,
    savePreset,
    deletePreset,
  }
}
