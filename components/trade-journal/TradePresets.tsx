"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Save, Trash2, FolderOpen } from "lucide-react"
import type { ReturnType } from "./hooks/useTradePresets"
import type { ReturnType as FormReturnType } from "./hooks/useTradeForm"

interface Props {
  presets: ReturnType<typeof import("./hooks/useTradePresets").useTradePresets>
  form: FormReturnType<typeof import("./hooks/useTradeForm").useTradeForm>
}

export function TradePresets({ presets, form }: Props) {
  return (
    <div className="flex gap-2">
      <Dialog open={presets.showPresetDialog} onOpenChange={presets.setShowPresetDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Save className="h-4 w-4" /> Save Preset
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Condition Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={presets.presetName}
              onChange={(e) => presets.setPresetName(e.target.value)}
              placeholder="Preset name (e.g. 'My Breakout Setup')"
            />
            <Button onClick={() => presets.savePreset(form.conditions)} className="w-full">
              Save Preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {presets.presets.length > 0 && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FolderOpen className="h-4 w-4" /> Load ({presets.presets.length})
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Load Preset</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {presets.presets.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {preset.conditions.length} conditions
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => form.loadPreset(preset)}>
                      Load
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => presets.deletePreset(preset.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
