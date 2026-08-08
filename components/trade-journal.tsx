"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  PlusCircle,
  Save,
  Trash2,
  ChevronsUpDown,
  Check,
  AlertTriangle,
  Settings,
  Edit,
  Download,
  Upload,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

// Define types
interface Condition {
  id: string
  description: string
  confidence: number
  checked: boolean
}

interface Trade {
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

// Predefined conditions
const buyConditions: Omit<Condition, "id" | "checked">[] = [
  { description: "Price above 200 EMA", confidence: 80 },
  { description: "RSI below 30", confidence: 75 },
  { description: "Bullish engulfing pattern", confidence: 85 },
  { description: "Support level holding", confidence: 70 },
]

const sellConditions: Omit<Condition, "id" | "checked">[] = [
  { description: "Price below 200 EMA", confidence: 80 },
  { description: "RSI above 70", confidence: 75 },
  { description: "Bearish engulfing pattern", confidence: 85 },
  { description: "Resistance level reached", confidence: 70 },
]

// Currency pairs
const initialCurrencyPairs = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP"]

export default function TradeJournal() {
  const [currencyPairs, setCurrencyPairs] = useState<string[]>([
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "USD/CHF",
    "AUD/USD",
    "USD/CAD",
    "NZD/USD",
    "EUR/GBP",
  ])
  const [customPairInput, setCustomPairInput] = useState<string>("")
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false)
  const [currencyPair, setCurrencyPair] = useState<string>("")
  const [action, setAction] = useState<"buy" | "sell" | "">("")
  const [conditions, setConditions] = useState<Condition[]>([])
  const [newCondition, setNewCondition] = useState<string>("")
  const [newConfidence, setNewConfidence] = useState<number>(50)
  const [open, setOpen] = useState(false)

  // New state for profit/loss tracking
  const [entryPrice, setEntryPrice] = useState<string>("")
  const [stopLossPrice, setStopLossPrice] = useState<string>("")
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>("")
  const [positionSize, setPositionSize] = useState<string>("")
  const [tradeStatus, setTradeStatus] = useState<"open" | "closed">("open")
  const [exitPrice, setExitPrice] = useState<string>("")

  // New state for journaling notes
  const [notes, setNotes] = useState<string>("")

  // Image upload state
  const [tradeImages, setTradeImages] = useState<
    Array<{
      id: string
      file: File
      preview: string
      caption: string
    }>
  >([])
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null)
  const [editingCaptionText, setEditingCaptionText] = useState<string>("")
  const [selectedImageModal, setSelectedImageModal] = useState<{
    id: string
    file: File
    preview: string
    caption: string
  } | null>(null)

  // Preset management state
  const [presets, setPresets] = useState<
    Array<{
      id: string
      name: string
      action: "buy" | "sell"
      conditions: Condition[]
      createdAt: string
    }>
  >([])
  const [showPresetDialog, setShowPresetDialog] = useState(false)
  const [showPresetManager, setShowPresetManager] = useState(false)
  const [editingPreset, setEditingPreset] = useState<string | null>(null)
  const [editingPresetName, setEditingPresetName] = useState("")
  const [presetName, setPresetName] = useState("")
  const [presetErrors, setPresetErrors] = useState<{
    name?: string
    save?: string
    load?: string
  }>({})

  // Calculate potential profit/loss
  const calculatePotentialPL = () => {
    if (!entryPrice || !positionSize || !action) return { takeProfit: 0, stopLoss: 0 }

    const entry = Number.parseFloat(entryPrice)
    const tp = takeProfitPrice ? Number.parseFloat(takeProfitPrice) : 0
    const sl = stopLossPrice ? Number.parseFloat(stopLossPrice) : 0
    const size = Number.parseFloat(positionSize)

    let takeProfitPL = 0
    let stopLossPL = 0

    if (action === "buy") {
      // For buy: profit when price goes up, loss when price goes down
      takeProfitPL = tp > 0 ? (tp - entry) * size : 0
      stopLossPL = sl > 0 ? (sl - entry) * size : 0
    } else if (action === "sell") {
      // For sell: profit when price goes down, loss when price goes up
      takeProfitPL = tp > 0 ? (entry - tp) * size : 0
      stopLossPL = sl > 0 ? (entry - sl) * size : 0
    }

    return { takeProfit: takeProfitPL, stopLoss: stopLossPL }
  }

  // Calculate actual profit/loss for closed trades
  const calculateActualPL = () => {
    if (tradeStatus !== "closed" || !entryPrice || !exitPrice || !positionSize || !action) return 0

    const entry = Number.parseFloat(entryPrice)
    const exit = Number.parseFloat(exitPrice)
    const size = Number.parseFloat(positionSize)

    if (action === "buy") {
      return (exit - entry) * size
    } else {
      return (entry - exit) * size
    }
  }

  // Load presets from localStorage
  useEffect(() => {
    try {
      const savedPresets = JSON.parse(localStorage.getItem("conditionPresets") || "[]")
      setPresets(savedPresets)
    } catch (error) {
      console.error("Error loading presets:", error)
    }
  }, [])

  // Save presets to localStorage
  const savePresetsToStorage = (updatedPresets: typeof presets) => {
    try {
      localStorage.setItem("conditionPresets", JSON.stringify(updatedPresets))
      setPresets(updatedPresets)
    } catch (error) {
      console.error("Error saving presets:", error)
      setPresetErrors({ save: "Failed to save preset. Please try again." })
    }
  }

  // Save current conditions as preset
  const savePreset = () => {
    setPresetErrors({})

    if (!presetName.trim()) {
      setPresetErrors({ name: "Preset name is required" })
      return
    }

    if (!action) {
      setPresetErrors({ name: "Please select an action (buy/sell) first" })
      return
    }

    const checkedConditions = conditions.filter((cond) => cond.checked)
    if (checkedConditions.length === 0) {
      setPresetErrors({ name: "Please select at least one condition" })
      return
    }

    // Check for duplicate names
    if (presets.some((preset) => preset.name.toLowerCase() === presetName.trim().toLowerCase())) {
      setPresetErrors({ name: "A preset with this name already exists" })
      return
    }

    const newPreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      action: action as "buy" | "sell",
      conditions: checkedConditions.map((cond) => ({ ...cond })),
      createdAt: new Date().toISOString(),
    }

    const updatedPresets = [...presets, newPreset]
    savePresetsToStorage(updatedPresets)

    toast({
      title: "Preset Saved",
      description: `"${presetName}" has been saved successfully`,
    })

    setPresetName("")
    setShowPresetDialog(false)
  }

  // Load a preset
  const loadPreset = (presetId: string) => {
    try {
      const preset = presets.find((p) => p.id === presetId)
      if (!preset) {
        setPresetErrors({ load: "Preset not found" })
        return
      }

      // Set action first
      setAction(preset.action)

      // Wait for action to update, then set conditions
      setTimeout(() => {
        const updatedConditions = conditions.map((cond) => {
          const presetCondition = preset.conditions.find((pc) => pc.description === cond.description)
          return presetCondition ? { ...cond, checked: true } : { ...cond, checked: false }
        })

        // Add any custom conditions from preset that don't exist
        const existingDescriptions = conditions.map((c) => c.description)
        const customConditions = preset.conditions.filter((pc) => !existingDescriptions.includes(pc.description))

        setConditions([...updatedConditions, ...customConditions])

        toast({
          title: "Preset Loaded",
          description: `"${preset.name}" conditions have been applied`,
        })
      }, 100)
    } catch (error) {
      console.error("Error loading preset:", error)
      setPresetErrors({ load: "Failed to load preset" })
    }
  }

  // Delete a preset
  const deletePreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return

    const updatedPresets = presets.filter((p) => p.id !== presetId)
    savePresetsToStorage(updatedPresets)

    toast({
      title: "Preset Deleted",
      description: `"${preset.name}" has been deleted`,
    })
  }

  // Rename a preset
  const renamePreset = (presetId: string) => {
    setPresetErrors({})

    if (!editingPresetName.trim()) {
      setPresetErrors({ name: "Preset name is required" })
      return
    }

    // Check for duplicate names (excluding current preset)
    if (
      presets.some(
        (preset) => preset.id !== presetId && preset.name.toLowerCase() === editingPresetName.trim().toLowerCase(),
      )
    ) {
      setPresetErrors({ name: "A preset with this name already exists" })
      return
    }

    const updatedPresets = presets.map((preset) =>
      preset.id === presetId ? { ...preset, name: editingPresetName.trim() } : preset,
    )

    savePresetsToStorage(updatedPresets)

    toast({
      title: "Preset Renamed",
      description: `Preset renamed to "${editingPresetName}"`,
    })

    setEditingPreset(null)
    setEditingPresetName("")
  }

  // Get presets for current action
  const getPresetsForCurrentAction = () => {
    return presets.filter((preset) => preset.action === action)
  }

  const potentialPL = calculatePotentialPL()
  const actualPL = calculateActualPL()

  // Load predefined conditions when action changes
  useEffect(() => {
    if (action === "buy") {
      setConditions(
        buyConditions.map((cond) => ({
          ...cond,
          id: crypto.randomUUID(),
          checked: false,
        })),
      )
    } else if (action === "sell") {
      setConditions(
        sellConditions.map((cond) => ({
          ...cond,
          id: crypto.randomUUID(),
          checked: false,
        })),
      )
    } else {
      setConditions([])
    }
  }, [action])

  // Load saved currency pairs from localStorage
  useEffect(() => {
    const savedPairs = JSON.parse(localStorage.getItem("currencyPairs") || "[]")
    if (savedPairs.length > 0) {
      setCurrencyPairs((prev) => {
        const uniquePairs = Array.from(new Set([...prev, ...savedPairs]))
        return uniquePairs
      })
    }
  }, [])

  // Add a new custom condition
  const addCondition = () => {
    if (!newCondition.trim()) {
      toast({
        title: "Error",
        description: "Condition description cannot be empty",
        variant: "destructive",
      })
      return
    }

    const condition: Condition = {
      id: crypto.randomUUID(),
      description: newCondition,
      confidence: newConfidence,
      checked: false,
    }

    setConditions([...conditions, condition])
    setNewCondition("")
    setNewConfidence(50)
  }

  // Toggle condition checked state
  const toggleCondition = (id: string) => {
    setConditions(conditions.map((cond) => (cond.id === id ? { ...cond, checked: !cond.checked } : cond)))
  }

  // Delete a condition
  const deleteCondition = (id: string) => {
    setConditions(conditions.filter((cond) => cond.id !== id))
  }

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (files.length === 0) return

    // Validate file types and sizes
    const validFiles = files.filter((file) => {
      const validTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp",
        "image/svg+xml",
        "image/tiff",
      ]
      const maxSize = 10 * 1024 * 1024 // 10MB

      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a supported image format`,
          variant: "destructive",
        })
        return false
      }

      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds the 10MB limit`,
          variant: "destructive",
        })
        return false
      }

      return true
    })

    // Create preview URLs and add to state
    const newImages = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      caption: "",
    }))

    setTradeImages((prev) => [...prev, ...newImages])

    toast({
      title: "Images Uploaded",
      description: `${newImages.length} image(s) added to your trade journal`,
    })

    // Clear the input
    e.target.value = ""
  }

  // Remove image
  const removeImage = (imageId: string) => {
    setTradeImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === imageId)
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.preview)
      }
      return prev.filter((img) => img.id !== imageId)
    })

    toast({
      title: "Image Removed",
      description: "Image has been removed from your trade journal",
    })
  }

  // Clear all images
  const clearAllImages = () => {
    tradeImages.forEach((image) => {
      URL.revokeObjectURL(image.preview)
    })
    setTradeImages([])

    toast({
      title: "All Images Cleared",
      description: "All images have been removed from your trade journal",
    })
  }

  // Move image position
  const moveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= tradeImages.length) return

    const newImages = [...tradeImages]
    const [movedImage] = newImages.splice(fromIndex, 1)
    newImages.splice(toIndex, 0, movedImage)
    setTradeImages(newImages)
  }

  // Caption editing functions
  const startEditingCaption = (imageId: string) => {
    const image = tradeImages.find((img) => img.id === imageId)
    if (image) {
      setEditingCaptionId(imageId)
      setEditingCaptionText(image.caption)
    }
  }

  const saveCaption = (imageId: string) => {
    setTradeImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, caption: editingCaptionText.trim() } : img)),
    )
    setEditingCaptionId(null)
    setEditingCaptionText("")
  }

  const cancelEditingCaption = () => {
    setEditingCaptionId(null)
    setEditingCaptionText("")
  }

  // Open image modal
  const openImageModal = (image: (typeof tradeImages)[0]) => {
    setSelectedImageModal(image)
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Save the trade
  const saveTrade = () => {
    if (!currencyPair) {
      toast({
        title: "Error",
        description: "Please select a currency pair",
        variant: "destructive",
      })
      return
    }

    if (!action) {
      toast({
        title: "Error",
        description: "Please select an action (buy/sell)",
        variant: "destructive",
      })
      return
    }

    if (!entryPrice) {
      toast({
        title: "Error",
        description: "Please enter an entry price",
        variant: "destructive",
      })
      return
    }

    if (!positionSize) {
      toast({
        title: "Error",
        description: "Please enter a position size",
        variant: "destructive",
      })
      return
    }

    if (!conditions.some((cond) => cond.checked)) {
      toast({
        title: "Error",
        description: "Please select at least one condition",
        variant: "destructive",
      })
      return
    }

    // Calculate profit/loss
    let profitLoss = undefined
    if (tradeStatus === "closed" && exitPrice) {
      profitLoss = calculateActualPL()
    }

    // Update the trade object in saveTrade function to include images
    const trade: Trade = {
      id: crypto.randomUUID(),
      currencyPair,
      action,
      date: new Date().toISOString(),
      conditions: conditions.filter((cond) => cond.checked),
      entryPrice: Number.parseFloat(entryPrice),
      stopLossPrice: stopLossPrice ? Number.parseFloat(stopLossPrice) : 0,
      takeProfitPrice: takeProfitPrice ? Number.parseFloat(takeProfitPrice) : 0,
      exitPrice: exitPrice ? Number.parseFloat(exitPrice) : undefined,
      positionSize: Number.parseFloat(positionSize),
      status: tradeStatus,
      profitLoss,
      notes: notes.trim(),
      images: tradeImages.map((img) => ({
        id: img.id,
        fileName: img.file.name,
        fileType: img.file.type,
        fileSize: img.file.size,
        caption: img.caption,
        preview: img.preview, // Note: In production, you'd upload to a server and store the URL
      })),
    }

    // Get existing trades from localStorage
    const existingTrades = JSON.parse(localStorage.getItem("trades") || "[]")

    // Add new trade
    localStorage.setItem("trades", JSON.stringify([...existingTrades, trade]))

    // Save currency pairs to localStorage
    localStorage.setItem("currencyPairs", JSON.stringify(currencyPairs))

    toast({
      title: "Success",
      description: "Trade saved successfully",
    })

    // Reset form
    setCurrencyPair("")
    setAction("")
    setConditions([])
    setEntryPrice("")
    setStopLossPrice("")
    setTakeProfitPrice("")
    setPositionSize("")
    setTradeStatus("open")
    setExitPrice("")
    setNotes("")
    setTradeImages([])
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>New Trade Entry</CardTitle>
        <CardDescription>Record your trade details and conditions</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="currency-pair">Currency Pair</Label>
            {!showCustomInput ? (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-transparent"
                    id="currency-pair"
                  >
                    {currencyPair ? currencyPair : "Select currency pair"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search currency pair..." />
                    <CommandList>
                      <CommandEmpty>No currency pair found.</CommandEmpty>
                      <CommandGroup>
                        {currencyPairs.map((pair) => (
                          <CommandItem
                            key={pair}
                            value={pair}
                            onSelect={(value) => {
                              setCurrencyPair(value === currencyPair ? "" : value)
                              setOpen(false)
                            }}
                          >
                            <Check
                              className={cn("mr-2 h-4 w-4", currencyPair === pair ? "opacity-100" : "opacity-0")}
                            />
                            {pair}
                          </CommandItem>
                        ))}
                        <CommandItem
                          value="custom-new-pair"
                          onSelect={() => {
                            setShowCustomInput(true)
                            setCurrencyPair("")
                            setOpen(false)
                          }}
                          className="text-primary"
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add Custom Pair
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex flex-col space-y-2">
                <div className="flex space-x-2">
                  <Input
                    placeholder="e.g. BTC/USD"
                    value={customPairInput}
                    onChange={(e) => setCustomPairInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (customPairInput.trim()) {
                        const newPair = customPairInput.trim()
                        if (!currencyPairs.includes(newPair)) {
                          setCurrencyPairs([...currencyPairs, newPair])
                        }
                        setCurrencyPair(newPair)
                        setCustomPairInput("")
                        setShowCustomInput(false)
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCustomInput(false)
                    setCustomPairInput("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Action</Label>
            <Select value={action} onValueChange={(value: "buy" | "sell") => setAction(value)}>
              <SelectTrigger id="action">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Price and Position Information */}
        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-4">Trade Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry-price">Entry Price</Label>
              <Input
                id="entry-price"
                type="number"
                step="0.00001"
                placeholder="Enter entry price"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position-size">Position Size (Units/Lots)</Label>
              <Input
                id="position-size"
                type="number"
                step="0.01"
                placeholder="Enter position size"
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stop-loss">Stop Loss Price</Label>
              <Input
                id="stop-loss"
                type="number"
                step="0.00001"
                placeholder="Enter stop loss price"
                value={stopLossPrice}
                onChange={(e) => setStopLossPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="take-profit">Take Profit Price</Label>
              <Input
                id="take-profit"
                type="number"
                step="0.00001"
                placeholder="Enter take profit price"
                value={takeProfitPrice}
                onChange={(e) => setTakeProfitPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-status">Trade Status</Label>
              <Select value={tradeStatus} onValueChange={(value: "open" | "closed") => setTradeStatus(value)}>
                <SelectTrigger id="trade-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tradeStatus === "closed" && (
              <div className="space-y-2">
                <Label htmlFor="exit-price">Exit Price</Label>
                <Input
                  id="exit-price"
                  type="number"
                  step="0.00001"
                  placeholder="Enter exit price"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Profit/Loss Summary */}
          {action && entryPrice && positionSize && (
            <div className="mt-4 p-3 border rounded-md bg-muted/30">
              <h4 className="font-medium mb-2">Profit/Loss Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {tradeStatus === "open" ? (
                  <>
                    <div className="flex justify-between">
                      <span>Potential Profit (Take Profit):</span>
                      <span
                        className={
                          potentialPL.takeProfit >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"
                        }
                      >
                        {potentialPL.takeProfit.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Potential Loss (Stop Loss):</span>
                      <span
                        className={
                          potentialPL.stopLoss >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"
                        }
                      >
                        {potentialPL.stopLoss.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Risk/Reward Ratio:</span>
                      <span className="font-medium">
                        {potentialPL.stopLoss !== 0 && potentialPL.takeProfit !== 0
                          ? `1:${Math.abs(potentialPL.takeProfit / potentialPL.stopLoss).toFixed(2)}`
                          : "N/A"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between col-span-2">
                    <span>Actual Profit/Loss:</span>
                    <span className={actualPL >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      {actualPL.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Trading Journal Notes */}
        <div className="border-t pt-4">
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Trade Images</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    id="image-upload"
                    multiple
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/svg+xml,image/tiff"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("image-upload")?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Images
                  </Button>
                  {tradeImages.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAllImages}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Image Preview Grid */}
              {tradeImages.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
                  {tradeImages.map((image, index) => (
                    <div key={image.id} className="relative group">
                      <div className="aspect-video bg-background border rounded-lg overflow-hidden shadow-sm">
                        <img
                          src={image.preview || "/placeholder.svg"}
                          alt={image.caption || `Trade image ${index + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => openImageModal(image)}
                        />

                        {/* Image Controls Overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openImageModal(image)}
                            className="h-8 px-2"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => startEditingCaption(image.id)}
                            className="h-8 px-2"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeImage(image.id)}
                            className="h-8 px-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Image Order Badge */}
                        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full font-medium">
                          {index + 1}
                        </div>
                      </div>

                      {/* Caption */}
                      <div className="mt-2">
                        {editingCaptionId === image.id ? (
                          <div className="flex gap-2">
                            <Input
                              value={editingCaptionText}
                              onChange={(e) => setEditingCaptionText(e.target.value)}
                              placeholder="Add image caption..."
                              className="text-sm h-8"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  saveCaption(image.id)
                                } else if (e.key === "Escape") {
                                  cancelEditingCaption()
                                }
                              }}
                              autoFocus
                            />
                            <Button type="button" size="sm" onClick={() => saveCaption(image.id)} className="h-8 px-2">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={cancelEditingCaption}
                              className="h-8 px-2 bg-transparent"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <p
                            className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => startEditingCaption(image.id)}
                          >
                            {image.caption || "Click to add caption..."}
                          </p>
                        )}
                      </div>

                      {/* Image Info */}
                      <div className="mt-1 text-xs text-muted-foreground">
                        <div className="flex justify-between items-center">
                          <span>{image.file.name}</span>
                          <span>{formatFileSize(image.file.size)}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span>{image.file.type}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveImage(index, index - 1)}
                              disabled={index === 0}
                              className="h-6 w-6 p-0"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveImage(index, index + 1)}
                              disabled={index === tradeImages.length - 1}
                              className="h-6 w-6 p-0"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Instructions */}
              {tradeImages.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">Upload Trade Images</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add screenshots, charts, or analysis images to your trade journal
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports: JPEG, PNG, GIF, WebP, BMP, SVG, TIFF • Max 10MB per image
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 bg-transparent"
                    onClick={() => document.getElementById("image-upload")?.click()}
                  >
                    Choose Images
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Image Modal Dialog */}
        {selectedImageModal && (
          <Dialog open={!!selectedImageModal} onOpenChange={() => setSelectedImageModal(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Image Preview
                </DialogTitle>
                <DialogDescription>
                  {selectedImageModal.file.name} • {formatFileSize(selectedImageModal.file.size)} •{" "}
                  {selectedImageModal.file.type}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={selectedImageModal.preview || "/placeholder.svg"}
                    alt={selectedImageModal.caption || "Trade image"}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                  />
                </div>

                {selectedImageModal.caption && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground font-medium">{selectedImageModal.caption}</p>
                  </div>
                )}

                <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={() => startEditingCaption(selectedImageModal.id)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Caption
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      removeImage(selectedImageModal.id)
                      setSelectedImageModal(null)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Image
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {action && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">{action === "buy" ? "Buy" : "Sell"} Conditions</h3>
              <div className="flex items-center gap-2">
                {/* Preset Management Buttons */}
                {getPresetsForCurrentAction().length > 0 && (
                  <Select onValueChange={(value) => loadPreset(value)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Load preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getPresetsForCurrentAction().map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{preset.name}</span>
                            <Badge variant="outline" className="ml-2 text-xs">
                              {preset.conditions.length}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPresetDialog(true)}
                  disabled={conditions.filter((c) => c.checked).length === 0}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Preset
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPresetManager(true)}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Manage
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {presetErrors.load && (
              <div className="flex items-center gap-2 p-3 text-sm border rounded-md bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{presetErrors.load}</span>
              </div>
            )}

            <div className="space-y-2">
              {conditions.map((condition) => (
                <div
                  key={condition.id}
                  className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={condition.id}
                    checked={condition.checked}
                    onCheckedChange={() => toggleCondition(condition.id)}
                  />
                  <Label htmlFor={condition.id} className="flex-1 cursor-pointer">
                    {condition.description}
                  </Label>
                  <span className="text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {condition.confidence}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCondition(condition.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete condition</span>
                  </Button>
                </div>
              ))}
            </div>

            {/* Quick Stats */}
            {conditions.filter((c) => c.checked).length > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Selected Conditions:</span>
                  <span>
                    {conditions.filter((c) => c.checked).length} of {conditions.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="font-medium">Average Confidence:</span>
                  <span>
                    {Math.round(
                      conditions.filter((c) => c.checked).reduce((sum, c) => sum + c.confidence, 0) /
                        conditions.filter((c) => c.checked).length,
                    )}
                    %
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t pt-4">
          <h3 className="text-lg font-medium mb-2">Add Custom Condition</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="condition">Condition Description</Label>
              <Input
                id="condition"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                placeholder="Enter your condition"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="confidence">Confidence Level</Label>
              </div>
              <Select value={newConfidence.toString()} onValueChange={(value) => setNewConfidence(Number(value))}>
                <SelectTrigger id="confidence">
                  <SelectValue placeholder="Select confidence level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="30">30%</SelectItem>
                  <SelectItem value="40">40%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="60">60%</SelectItem>
                  <SelectItem value="70">70%</SelectItem>
                  <SelectItem value="80">80%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="button" variant="outline" onClick={addCondition} className="w-full bg-transparent">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Condition
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Save Preset Dialog */}
      <Dialog open={showPresetDialog} onOpenChange={setShowPresetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Condition Preset</DialogTitle>
            <DialogDescription>Save your current {action} conditions as a preset for future use</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {presetErrors.save && (
              <div className="flex items-center gap-2 p-3 text-sm border rounded-md bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{presetErrors.save}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                placeholder="Enter preset name..."
                value={presetName}
                onChange={(e) => {
                  setPresetName(e.target.value)
                  if (presetErrors.name) {
                    setPresetErrors((prev) => ({ ...prev, name: undefined }))
                  }
                }}
                className={presetErrors.name ? "border-destructive" : ""}
              />
              {presetErrors.name && <p className="text-sm text-destructive">{presetErrors.name}</p>}
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Conditions to Save:</h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {conditions
                  .filter((c) => c.checked)
                  .map((condition) => (
                    <div key={condition.id} className="flex justify-between items-center text-sm">
                      <span>{condition.description}</span>
                      <Badge variant="outline">{condition.confidence}%</Badge>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPresetDialog(false)
                setPresetName("")
                setPresetErrors({})
              }}
            >
              Cancel
            </Button>
            <Button onClick={savePreset}>Save Preset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preset Manager Dialog */}
      <Dialog open={showPresetManager} onOpenChange={setShowPresetManager}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Condition Presets</DialogTitle>
            <DialogDescription>View, edit, and delete your saved condition presets</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {presets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Save className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Presets Saved</h3>
                <p className="text-sm">Save your first preset to get started</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {presets.map((preset) => (
                  <Card key={preset.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {editingPreset === preset.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editingPresetName}
                              onChange={(e) => {
                                setEditingPresetName(e.target.value)
                                if (presetErrors.name) {
                                  setPresetErrors((prev) => ({ ...prev, name: undefined }))
                                }
                              }}
                              className={presetErrors.name ? "border-destructive" : ""}
                              placeholder="Enter new name..."
                            />
                            {presetErrors.name && <p className="text-sm text-destructive">{presetErrors.name}</p>}
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => renamePreset(preset.id)}>
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingPreset(null)
                                  setEditingPresetName("")
                                  setPresetErrors({})
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{preset.name}</h4>
                              <Badge variant={preset.action === "buy" ? "default" : "destructive"}>
                                {preset.action.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">{preset.conditions.length} conditions</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Created: {new Date(preset.createdAt).toLocaleDateString()}
                            </p>
                            <div className="mt-2">
                              <details className="text-sm">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                  View conditions
                                </summary>
                                <div className="mt-2 space-y-1 pl-4 border-l-2 border-muted">
                                  {preset.conditions.map((condition, index) => (
                                    <div key={index} className="flex justify-between">
                                      <span>{condition.description}</span>
                                      <span className="text-muted-foreground">{condition.confidence}%</span>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            </div>
                          </div>
                        )}
                      </div>

                      {editingPreset !== preset.id && (
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadPreset(preset.id)}
                            className="flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingPreset(preset.id)
                              setEditingPresetName(preset.name)
                            }}
                            className="flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" />
                            Rename
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive bg-transparent"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Preset</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{preset.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletePreset(preset.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPresetManager(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardFooter>
        <Button onClick={saveTrade} className="w-full">
          <Save className="mr-2 h-4 w-4" />
          Save Trade
        </Button>
      </CardFooter>
    </Card>
  )
}
