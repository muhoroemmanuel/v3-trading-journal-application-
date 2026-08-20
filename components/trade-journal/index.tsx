"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { BookOpen, BarChart3, RefreshCw } from "lucide-react"
import { useTradeForm, type Trade as FormTrade } from "./hooks/useTradeForm"
import { useTradePresets } from "./hooks/useTradePresets"
import { useImageUploads } from "@/hooks/use-image-uploads"
import { getLocalTrades, saveTrade, setLocalTrades, syncPending, setupSyncListener } from "@/lib/sync"
import { useAuth } from "@/components/auth-provider"
import { TradeForm } from "./TradeForm"
import { TradeConditions } from "./TradeConditions"
import { TradePresets } from "./TradePresets"
import { TradeImportExport } from "./TradeImportExport"
import { TradeImageGallery } from "./TradeImageGallery"
import dynamic from "next/dynamic"

// Same heavy (recharts) component as app/page.tsx's Portfolio tab — code-split
// here too, and skip SSR since it only renders after a client-side tab click.
const Portfolio = dynamic(() => import("@/components/portfolio"), {
  loading: () => <div className="p-6 text-sm text-muted-foreground">Loading portfolio…</div>,
  ssr: false,
})

// Mapper: form Trade (camelCase) → DB format (snake_case)
function toDbTrade(trade: FormTrade) {
  return {
    currency_pair: trade.currencyPair,
    action: trade.action,
    entry_price: trade.entryPrice,
    stop_loss_price: trade.stopLossPrice || null,
    take_profit_price: trade.takeProfitPrice || null,
    exit_price: trade.exitPrice || null,
    position_size: trade.positionSize,
    status: trade.status,
    profit_loss: trade.profitLoss || null,
    notes: trade.notes || null,
    conditions: trade.conditions,
    images: trade.images?.map((img) => ({
      id: img.id,
      file_name: img.fileName,
      file_type: img.fileType,
      file_size: img.fileSize,
      caption: img.caption,
      preview: img.preview,
    })) || [],
  }
}

export default function TradeJournal() {
  const [trades, setTrades] = useState<FormTrade[]>([])
  const [syncing, setSyncing] = useState(false)
  const { user } = useAuth()

  // Load from localStorage on mount
  useEffect(() => {
    setTrades(getLocalTrades() as unknown as FormTrade[])
    setupSyncListener()
  }, [])

  const form = useTradeForm()
  const presets = useTradePresets()
  const images = useImageUploads()

  const handleSave = useCallback(async () => {
    const { valid, errors } = form.validate()
    if (!valid) {
      toast({ title: "Validation Error", description: errors.join(". "), variant: "destructive" })
      return
    }

    const trade = form.toTradeObject(images.images)
    
    // Save offline-first via sync layer
    await saveTrade(toDbTrade(trade))
    
    // Refresh local state
    setTrades(getLocalTrades() as unknown as FormTrade[])
    
    form.reset()
    images.clearAllImages()
    toast({ title: "Trade Saved", description: `${trade.currencyPair} ${trade.action} trade recorded` })
  }, [form, images])

  const handleImport = useCallback((imported: FormTrade[]) => {
    const updated = [...imported, ...trades]
    setTrades(updated)
    setLocalTrades(updated as any)
    toast({ title: "Imported", description: `${imported.length} trades loaded` })
  }, [trades])

  const handleSync = useCallback(async () => {
    if (!user) {
      toast({ title: "Not logged in", description: "Sign in to sync to cloud", variant: "destructive" })
      return
    }
    setSyncing(true)
    try {
      await syncPending()
      setTrades(getLocalTrades() as unknown as FormTrade[])
      toast({ title: "Synced", description: "Trades synced with cloud" })
    } catch (err: any) {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }, [user])

  return (
    <div className="space-y-6">
      <Tabs defaultValue="journal" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="journal" className="gap-2">
            <BookOpen className="h-4 w-4" /> New Trade
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-2">
            <BarChart3 className="h-4 w-4" /> Portfolio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="journal">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>New Trade Entry</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <TradeForm form={form} />
              <TradeConditions form={form} />
              <TradePresets presets={presets} form={form} />
              <TradeImageGallery images={images} />
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">Save Trade</Button>
                <TradeImportExport trades={trades} onImport={handleImport} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio">
          <Portfolio />
        </TabsContent>
      </Tabs>
    </div>
  )
}
