"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/hooks/use-toast"
import { BookOpen, BarChart3 } from "lucide-react"
import { useTradeForm, type Trade } from "./hooks/useTradeForm"
import { useTradePresets } from "./hooks/useTradePresets"
import { useImageUploads } from "@/hooks/use-image-uploads"
import { TradeForm } from "./TradeForm"
import { TradeConditions } from "./TradeConditions"
import { TradePresets } from "./TradePresets"
import { TradeImportExport } from "./TradeImportExport"
import { TradeImageGallery } from "./TradeImageGallery"
import Portfolio from "@/components/portfolio"

export default function TradeJournal() {
  const [trades, setTrades] = useState<Trade[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("trades")
      if (saved) {
        try { return JSON.parse(saved) } catch { /* ignore */ }
      }
    }
    return []
  })

  const form = useTradeForm()
  const presets = useTradePresets()
  const images = useImageUploads()

  const handleSave = useCallback(() => {
    const { valid, errors } = form.validate()
    if (!valid) {
      toast({ title: "Validation Error", description: errors.join(". "), variant: "destructive" })
      return
    }

    const trade = form.toTradeObject(images.images)
    const updated = [trade, ...trades]
    setTrades(updated)
    localStorage.setItem("trades", JSON.stringify(updated))
    form.reset()
    images.clearAllImages()
    toast({ title: "Trade Saved", description: `${trade.currencyPair} ${trade.action} trade recorded` })
  }, [form, images, trades])

  const handleImport = useCallback((imported: Trade[]) => {
    const updated = [...imported, ...trades]
    setTrades(updated)
    localStorage.setItem("trades", JSON.stringify(updated))
  }, [trades])

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
            <CardHeader>
              <CardTitle>New Trade Entry</CardTitle>
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
