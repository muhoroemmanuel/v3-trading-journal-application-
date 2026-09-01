"use client"

import { Button } from "@/components/ui/button"
import { Download, Upload } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import type { Trade } from "./hooks/useTradeForm"

interface Props {
  trades: Trade[]
  onImport: (trades: Trade[]) => void
}

export function TradeImportExport({ trades, onImport }: Props) {
  const handleExport = () => {
    if (trades.length === 0) {
      toast({ title: "No trades to export", variant: "destructive" })
      return
    }
    const data = JSON.stringify(trades, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `trading-journal-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Exported", description: `${trades.length} trades downloaded` })
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string)
        if (!Array.isArray(imported)) throw new Error("Invalid format")
        onImport(imported)
        toast({ title: "Imported", description: `${imported.length} trades loaded` })
      } catch {
        toast({ title: "Import failed", description: "Invalid JSON file", variant: "destructive" })
      }
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleExport} className="gap-2">
        <Download className="h-4 w-4" /> Export
      </Button>
      <Button variant="outline" className="gap-2 relative" asChild>
        <label>
          <Upload className="h-4 w-4" /> Import
          <input type="file" accept=".json" onChange={handleImport} className="sr-only" />
        </label>
      </Button>
    </div>
  )
}
