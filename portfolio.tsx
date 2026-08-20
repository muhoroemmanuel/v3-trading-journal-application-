"use client"

import { DialogFooter } from "@/components/ui/dialog"

import { DialogTrigger } from "@/components/ui/dialog"

import { Input } from "@/components/ui/input"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  DollarSign,
  BookOpen,
  Download,
  Upload,
  Bot,
  Send,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Euro,
  PoundSterling,
  JapaneseYenIcon as Yen,
  Info,
  Save,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from "recharts"

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
  source?: "manual" | "broker"
  sourceName?: string
}

interface ChartDataPoint {
  date: string
  profitLoss: number
  cumulativePL: number
  currencyPair: string
  action: string
  formattedDate: string
  tradeNumber: number
}

export default function Portfolio() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [importData, setImportData] = useState<string>("")
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([])
  const [userInput, setUserInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [editingPL, setEditingPL] = useState<string | null>(null)
  const [plInputValue, setPlInputValue] = useState<string>("")
  const [showChart, setShowChart] = useState<boolean>(true)
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("line")
  const [chartFilter, setChartFilter] = useState<string>("all")
  const [timeFilter, setTimeFilter] = useState<string>("all")

  // Initial Capital Management
  const [initialCapital, setInitialCapital] = useState<number>(0)
  const [initialCapitalCurrency, setInitialCapitalCurrency] = useState<string>("USD")
  const [capitalInput, setCapitalInput] = useState<string>("")
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD")
  const [showCapitalForm, setShowCapitalForm] = useState<boolean>(false)
  const [capitalFormErrors, setCapitalFormErrors] = useState<{
    amount?: string
    currency?: string
    storage?: string
  }>({})
  const [isSubmittingCapital, setIsSubmittingCapital] = useState<boolean>(false)

  // Currency configuration
  const SUPPORTED_CURRENCIES = [
    { code: "USD", symbol: "$", name: "US Dollar", icon: DollarSign },
    { code: "EUR", symbol: "€", name: "Euro", icon: Euro },
    { code: "GBP", symbol: "£", name: "British Pound", icon: PoundSterling },
    { code: "JPY", symbol: "¥", name: "Japanese Yen", icon: Yen },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar", icon: DollarSign },
    { code: "AUD", symbol: "A$", name: "Australian Dollar", icon: DollarSign },
    { code: "CHF", symbol: "CHF", name: "Swiss Franc", icon: DollarSign },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan", icon: Yen },
  ]

  // Load trades from localStorage
  useEffect(() => {
    const storedTrades = JSON.parse(localStorage.getItem("trades") || "[]")
    setTrades(storedTrades)
  }, [])

  // Load initial capital from localStorage
  useEffect(() => {
    try {
      const savedCapital = localStorage.getItem("initialCapital")
      const savedCurrency = localStorage.getItem("initialCapitalCurrency")

      if (savedCapital) {
        const capital = Number.parseFloat(savedCapital)
        if (!isNaN(capital) && capital > 0) {
          setInitialCapital(capital)
          setCapitalInput(capital.toString())
        }
      }

      if (savedCurrency && SUPPORTED_CURRENCIES.some((c) => c.code === savedCurrency)) {
        setInitialCapitalCurrency(savedCurrency)
        setSelectedCurrency(savedCurrency)
      }
    } catch (error) {
      console.error("Error loading initial capital:", error)
    }
  }, [])

  // Filter trades based on selection — memoized so this only recomputes
  // when trades or the active filters actually change, not on every render.
  const filteredTrades = useMemo(
    () =>
      trades
        .filter((trade) => filter === "all" || trade.currencyPair === filter)
        .filter((trade) => statusFilter === "all" || trade.status === statusFilter)
        .filter(
          (trade) =>
            sourceFilter === "all" ||
            (sourceFilter === "manual" ? !trade.source || trade.source === "manual" : trade.sourceName === sourceFilter),
        ),
    [trades, filter, statusFilter, sourceFilter],
  )

  // Get unique currency pairs for filter
  const uniquePairs = useMemo(() => Array.from(new Set(trades.map((trade) => trade.currencyPair))), [trades])
  const uniqueSources = useMemo(
    () => Array.from(new Set(trades.filter((trade) => trade.sourceName).map((trade) => trade.sourceName as string))),
    [trades],
  )

  // Prepare chart data with enhanced filtering — memoized: this does a sort
  // plus several filter passes, so it's worth skipping on unrelated re-renders.
  const chartData = useMemo((): ChartDataPoint[] => {
    let tradesWithPL = trades.filter((trade) => trade.profitLoss !== undefined && trade.profitLoss !== null)

    // If no trades with P/L, return empty array
    if (tradesWithPL.length === 0) {
      return []
    }

    // Apply chart-specific filters
    if (chartFilter !== "all") {
      tradesWithPL = tradesWithPL.filter((trade) => trade.currencyPair === chartFilter)
    }

    // Apply time filter
    if (timeFilter !== "all") {
      const now = new Date()
      const filterDate = new Date()

      switch (timeFilter) {
        case "7d":
          filterDate.setDate(now.getDate() - 7)
          break
        case "30d":
          filterDate.setDate(now.getDate() - 30)
          break
        case "90d":
          filterDate.setDate(now.getDate() - 90)
          break
        case "1y":
          filterDate.setFullYear(now.getFullYear() - 1)
          break
      }

      if (timeFilter !== "all") {
        tradesWithPL = tradesWithPL.filter((trade) => new Date(trade.date) >= filterDate)
      }
    }

    // Sort by date
    tradesWithPL.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let cumulativePL = 0
    return tradesWithPL.map((trade, index) => {
      cumulativePL += trade.profitLoss || 0
      return {
        date: trade.date,
        profitLoss: trade.profitLoss || 0,
        cumulativePL: cumulativePL,
        currencyPair: trade.currencyPair,
        action: trade.action,
        formattedDate: new Date(trade.date).toLocaleDateString(),
        tradeNumber: index + 1,
      }
    })
  }, [trades, chartFilter, timeFilter])

  // Calculate portfolio statistics — memoized: several filter/reduce passes
  // plus a sort over all trades, so it should only rerun when trades change.
  const stats = useMemo(() => {
    const tradesWithPL = trades.filter((trade) => trade.profitLoss !== undefined)
    const totalPL = tradesWithPL.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0)
    const winningTrades = tradesWithPL.filter((trade) => (trade.profitLoss || 0) > 0)
    const losingTrades = tradesWithPL.filter((trade) => (trade.profitLoss || 0) < 0)
    const winRate = tradesWithPL.length > 0 ? (winningTrades.length / tradesWithPL.length) * 100 : 0

    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0) / winningTrades.length
        : 0

    const avgLoss =
      losingTrades.length > 0
        ? losingTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0) / losingTrades.length
        : 0

    // Calculate maximum drawdown
    let maxDrawdown = 0
    let peak = 0
    let cumulativePL = 0

    tradesWithPL.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    for (const trade of tradesWithPL) {
      cumulativePL += trade.profitLoss || 0
      if (cumulativePL > peak) {
        peak = cumulativePL
      }
      const drawdown = peak - cumulativePL
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    return {
      totalPL,
      totalTrades: tradesWithPL.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      avgWin,
      avgLoss,
      maxDrawdown,
      profitFactor: avgLoss !== 0 ? Math.abs((avgWin * winningTrades.length) / (avgLoss * losingTrades.length)) : 0,
    }
  }, [trades])

  // Calculate portfolio performance relative to initial capital
  const portfolioPerformance = useMemo(() => {
    if (initialCapital <= 0) return null

    const totalPL = stats.totalPL
    const currentValue = initialCapital + totalPL
    const performancePercent = (totalPL / initialCapital) * 100

    return {
      initialCapital,
      currentValue,
      totalPL,
      performancePercent,
      currency: initialCapitalCurrency,
    }
  }, [initialCapital, stats.totalPL, initialCapitalCurrency])

  // Validate capital input
  const validateCapitalInput = (amount: string, currency: string): { amount?: string; currency?: string } => {
    const errors: { amount?: string; currency?: string } = {}

    // Validate amount
    if (!amount.trim()) {
      errors.amount = "Initial capital amount is required"
    } else {
      const numAmount = Number.parseFloat(amount)
      if (isNaN(numAmount)) {
        errors.amount = "Please enter a valid numeric amount"
      } else if (numAmount <= 0) {
        errors.amount = "Initial capital must be greater than 0"
      } else if (numAmount > 1000000000) {
        errors.amount = "Initial capital amount is too large"
      }
    }

    // Validate currency
    if (!currency) {
      errors.currency = "Please select a currency"
    } else if (!SUPPORTED_CURRENCIES.some((c) => c.code === currency)) {
      errors.currency = "Please select a valid currency"
    }

    return errors
  }

  // Handle capital form submission
  const handleCapitalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmittingCapital(true)
    setCapitalFormErrors({})

    try {
      // Validate input
      const validationErrors = validateCapitalInput(capitalInput, selectedCurrency)

      if (Object.keys(validationErrors).length > 0) {
        setCapitalFormErrors(validationErrors)
        return
      }

      const amount = Number.parseFloat(capitalInput)

      // Save to localStorage
      try {
        localStorage.setItem("initialCapital", amount.toString())
        localStorage.setItem("initialCapitalCurrency", selectedCurrency)
      } catch (storageError) {
        console.error("Storage error:", storageError)
        setCapitalFormErrors({
          storage: "Failed to save initial capital. Please try again.",
        })
        return
      }

      // Update state
      setInitialCapital(amount)
      setInitialCapitalCurrency(selectedCurrency)
      setShowCapitalForm(false)

      // Show success message
      toast({
        title: "Initial Capital Saved",
        description: `Initial capital of ${getCurrencySymbol(
          selectedCurrency,
        )}${amount.toLocaleString()} has been saved successfully.`,
      })
    } catch (error) {
      console.error("Error saving initial capital:", error)
      setCapitalFormErrors({
        storage: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsSubmittingCapital(false)
    }
  }

  // Get currency symbol
  const getCurrencySymbol = (currencyCode: string): string => {
    const currency = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode)
    return currency?.symbol || currencyCode
  }

  // Get currency icon
  const getCurrencyIcon = (currencyCode: string) => {
    const currency = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode)
    return currency?.icon || DollarSign
  }

  // Enhanced custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg p-4 shadow-lg min-w-[200px]">
          <div className="space-y-2">
            <p className="font-semibold text-sm">{data.formattedDate}</p>
            <p className="text-xs text-muted-foreground">
              Trade #{data.tradeNumber} • {data.currencyPair}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={data.action === "buy" ? "default" : "destructive"} className="text-xs">
                {data.action.toUpperCase()}
              </Badge>
            </div>
            <div className="space-y-1 pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Trade P/L:</span>
                <span className={`font-bold text-sm ${data.profitLoss >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.profitLoss >= 0 ? "+" : ""}
                  {data.profitLoss.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Cumulative P/L:</span>
                <span className={`font-bold text-sm ${data.cumulativePL >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.cumulativePL >= 0 ? "+" : ""}
                  {data.cumulativePL.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  // Render different chart types
  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 10, right: 30, left: 20, bottom: 10 },
    }

    const commonElements = (
      <>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis
          dataKey="formattedDate"
          tick={{ fontSize: 11 }}
          tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={{ stroke: "hsl(var(--muted-foreground))" }}
          tickFormatter={(value) => `${value >= 0 ? "+" : ""}${value.toFixed(0)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
      </>
    )

    switch (chartType) {
      case "area":
        return (
          <AreaChart {...commonProps}>
            {commonElements}
            <defs>
              <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="cumulativePL"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#colorPL)"
              dot={{
                fill: "hsl(var(--primary))",
                strokeWidth: 2,
                r: 3,
              }}
              activeDot={{
                r: 5,
                stroke: "hsl(var(--primary))",
                strokeWidth: 2,
                fill: "hsl(var(--background))",
              }}
            />
          </AreaChart>
        )

      case "bar":
        return (
          <BarChart {...commonProps}>
            {commonElements}
            <Bar dataKey="profitLoss" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
          </BarChart>
        )

      default: // line
        return (
          <LineChart {...commonProps}>
            {commonElements}
            <Line
              type="monotone"
              dataKey="cumulativePL"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              dot={{
                fill: "hsl(var(--primary))",
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={{
                r: 6,
                stroke: "hsl(var(--primary))",
                strokeWidth: 2,
                fill: "hsl(var(--background))",
              }}
            />
          </LineChart>
        )
    }
  }

  // Delete a trade
  const deleteTrade = (id: string) => {
    const updatedTrades = trades.filter((trade) => trade.id !== id)
    setTrades(updatedTrades)
    localStorage.setItem("trades", JSON.stringify(updatedTrades))
    toast({
      title: "Success",
      description: "Trade deleted successfully",
    })
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Calculate average confidence
  const getAverageConfidence = (conditions: Condition[]) => {
    if (conditions.length === 0) return 0
    const sum = conditions.reduce((acc, cond) => acc + cond.confidence, 0)
    return Math.round(sum / conditions.length)
  }

  // Calculate potential profit/loss for open trades
  const calculatePotentialPL = (trade: Trade) => {
    if (trade.status === "closed" || !trade.entryPrice || !trade.positionSize) {
      return { takeProfit: 0, stopLoss: 0 }
    }

    const entry = trade.entryPrice
    const tp = trade.takeProfitPrice || 0
    const sl = trade.stopLossPrice || 0
    const size = trade.positionSize

    let takeProfitPL = 0
    let stopLossPL = 0

    if (trade.action === "buy") {
      takeProfitPL = tp > 0 ? (tp - entry) * size : 0
      stopLossPL = sl > 0 ? (sl - entry) * size : 0
    } else if (trade.action === "sell") {
      takeProfitPL = tp > 0 ? (entry - tp) * size : 0
      stopLossPL = sl > 0 ? (entry - sl) * size : 0
    }

    return { takeProfit: takeProfitPL, stopLoss: stopLossPL }
  }

  // Export trades to CSV
  const exportToCSV = () => {
    if (trades.length === 0) {
      toast({
        title: "Error",
        description: "No trades to export",
        variant: "destructive",
      })
      return
    }

    // Define CSV headers
    const headers = [
      "ID",
      "Currency Pair",
      "Action",
      "Date",
      "Entry Price",
      "Stop Loss",
      "Take Profit",
      "Exit Price",
      "Position Size",
      "Status",
      "Profit/Loss",
      "Conditions",
      "Notes",
    ]

    // Convert trades to CSV rows
    const csvRows = trades.map((trade) => {
      const conditionsText = trade.conditions.map((c) => `${c.description} (${c.confidence}%)`).join("; ")

      return [
        trade.id,
        trade.currencyPair,
        trade.action,
        trade.date,
        trade.entryPrice,
        trade.stopLossPrice,
        trade.takeProfitPrice,
        trade.exitPrice || "",
        trade.positionSize,
        trade.status,
        trade.profitLoss || "",
        conditionsText,
        // Escape quotes in notes to prevent CSV issues
        trade.notes ? `"${trade.notes.replace(/"/g, '""')}"` : "",
      ]
    })

    // Combine headers and rows
    const csvContent = [headers.join(","), ...csvRows.map((row) => row.join(","))].join("\n")

    // Create a Blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `trading-journal-export-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Success",
      description: "Trades exported successfully",
    })
  }

  // Export trades to JSON
  const exportToJSON = () => {
    if (trades.length === 0) {
      toast({
        title: "Error",
        description: "No trades to export",
        variant: "destructive",
      })
      return
    }

    const jsonContent = JSON.stringify(trades, null, 2)
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `trading-journal-export-${new Date().toISOString().split("T")[0]}.json`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Success",
      description: "Trades exported successfully as JSON",
    })
  }

  // Import trades from JSON
  const importFromJSON = () => {
    try {
      const importedTrades = JSON.parse(importData)

      // Validate imported data
      if (!Array.isArray(importedTrades)) {
        throw new Error("Invalid import data: not an array")
      }

      // Basic validation of each trade
      importedTrades.forEach((trade) => {
        if (!trade.id || !trade.currencyPair || !trade.action || !trade.date) {
          throw new Error("Invalid trade data: missing required fields")
        }
      })

      // Merge with existing trades, avoiding duplicates
      const existingIds = new Set(trades.map((t) => t.id))
      const newTrades = importedTrades.filter((t) => !existingIds.has(t.id))
      const updatedTrades = [...trades, ...newTrades]

      // Update state and localStorage
      setTrades(updatedTrades)
      localStorage.setItem("trades", JSON.stringify(updatedTrades))

      toast({
        title: "Success",
        description: `Imported ${newTrades.length} new trades`,
      })

      setImportData("")
      setShowImportDialog(false)
    } catch (error) {
      toast({
        title: "Error",
        description: `Import failed: ${error instanceof Error ? error.message : "Invalid data format"}`,
        variant: "destructive",
      })
    }
  }

  // Handle file upload for import
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setImportData(content)
    }
    reader.readAsText(file)
  }

  // Handle sending a message to the AI
  const sendMessage = async () => {
    if (!userInput.trim()) return

    // Add user message to chat
    const newMessage = { role: "user" as const, content: userInput }
    setChatMessages([...chatMessages, newMessage])
    const currentInput = userInput
    setUserInput("")
    setIsLoading(true)

    try {
      // Enhanced responses for emotional support and trading assistance
      setTimeout(() => {
        let response = ""
        const input = currentInput.toLowerCase()

        // Emotional Support Responses
        if (input.includes("stress") || input.includes("anxious") || input.includes("worried")) {
          response = `I understand trading can be stressful. Here are some ways to manage trading stress:

🧘 **Take a Break**: Step away from the charts for a few minutes
💪 **Risk Management**: Only risk what you can afford to lose
📊 **Review Your Plan**: Stick to your trading strategy
🎯 **Focus on Process**: Control what you can control - your decisions

Remember, every trader faces losses. It's part of the journey. What matters is learning from each trade and maintaining emotional balance.`
        } else if (input.includes("loss") || input.includes("losing") || input.includes("lost money")) {
          response = `Losses are tough, but they're also learning opportunities. Here's how to handle them:

📈 **Analyze the Trade**: What went wrong? Was it the strategy or execution?
💡 **Learn the Lesson**: Every loss teaches something valuable
🎯 **Stick to Your Plan**: Don't revenge trade or deviate from your strategy
💪 **Stay Disciplined**: Emotional decisions often lead to more losses

Your portfolio shows ${stats.totalTrades} trades with a ${stats.winRate.toFixed(1)}% win rate. Focus on improving your process, not just the outcomes.`
        } else if (input.includes("fear") || input.includes("scared") || input.includes("afraid")) {
          response = `Fear is natural in trading, but it shouldn't control your decisions:

🎯 **Start Small**: Use smaller position sizes until confidence builds
📊 **Use Stop Losses**: Protect yourself with proper risk management
📚 **Education**: The more you know, the less you'll fear
🧘 **Mindfulness**: Practice staying calm under pressure

Fear often comes from uncertainty. Having a solid trading plan can help reduce that uncertainty.`
        }
        // Trading Strategy Responses
        else if (input.includes("strategy") || input.includes("improve") || input.includes("better")) {
          response = `Based on your trading data, here are some improvement suggestions:

📊 **Your Stats**: ${stats.totalTrades} trades, ${stats.winRate.toFixed(1)}% win rate
💰 **Profit Factor**: ${stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : "N/A"}

🎯 **Areas to Focus On**:
• Risk Management: Keep losses small and let winners run
• Consistency: Stick to your proven strategies
• Journal Review: Analyze what works and what doesn't
• Patience: Wait for high-probability setups

Your average win is ${stats.avgWin.toFixed(2)} vs average loss of ${Math.abs(stats.avgLoss).toFixed(2)}. ${stats.avgWin > Math.abs(stats.avgLoss) ? "Good risk/reward ratio!" : "Consider improving your risk/reward ratio."}`
        } else if (input.includes("risk") || input.includes("management")) {
          response = `Risk management is crucial for long-term success:

💡 **Position Sizing**: Never risk more than 1-2% per trade
🛡️ **Stop Losses**: Always have an exit plan before entering
📊 **Diversification**: Don't put all eggs in one basket
📈 **Risk/Reward**: Aim for at least 1:2 risk/reward ratio

Your current max drawdown is ${stats.maxDrawdown.toFixed(2)}. ${stats.maxDrawdown < 100 ? "Good job keeping drawdown manageable!" : "Consider reducing position sizes to limit drawdown."}`
        } else if (input.includes("entry") || input.includes("when to buy") || input.includes("when to sell")) {
          response = `Good entry timing is key to profitable trading:

🎯 **Wait for Confirmation**: Don't rush into trades
📊 **Use Multiple Timeframes**: Check higher timeframes for trend
🔍 **Look for Confluence**: Multiple signals pointing same direction
⏰ **Patience**: Better to miss a trade than force a bad one

Your journal shows you use conditions like trend analysis and technical indicators. Keep refining these entry criteria based on what works best for you.`
        }
        // General Trading Questions
        else if (input.includes("profit") || input.includes("money") || input.includes("earning")) {
          response = `Your current portfolio performance:

💰 **Total P/L**: ${stats.totalPL >= 0 ? "+" : ""}${stats.totalPL.toFixed(2)}
📊 **Win Rate**: ${stats.winRate.toFixed(1)}%
🎯 **Total Trades**: ${stats.totalTrades}

${stats.totalPL >= 0 ? "🎉 Great job staying profitable!" : "💪 Focus on process improvement over profits."}

Remember: Consistent profitability comes from:
• Proper risk management
• Following your trading plan
• Continuous learning and adaptation
• Emotional discipline`
        } else if (input.includes("journal") || input.includes("tracking")) {
          response = `Your trading journal is a powerful tool for improvement:

📝 **What to Track**:
• Entry/exit reasons
• Emotional state during trades
• Market conditions
• Lessons learned

📊 **Your Current Data**: ${stats.totalTrades} trades logged
🎯 **Next Steps**: Review your trades weekly to identify patterns

The more detailed your journal, the faster you'll improve. Keep documenting everything!`
        }
        // Default supportive response
        else {
          response = `I'm here to help with both trading questions and emotional support! 

🤖 **I can help with**:
• Trading strategies and analysis
• Risk management advice  
• Emotional support during tough times
• Portfolio performance insights
• General trading education

💬 **Try asking about**:
• "How can I manage trading stress?"
• "What's my trading performance?"
• "How do I improve my win rate?"
• "I'm feeling anxious about my trades"

What specific area would you like to explore?`
        }

        setChatMessages((prev) => [...prev, { role: "assistant", content: response }])
        setIsLoading(false)
      }, 1500) // Slightly longer delay for more realistic feel
    } catch (error) {
      console.error("Error getting AI response:", error)
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm here to support you, but I'm having a technical moment. Please try again, and remember - every challenge in trading is an opportunity to grow stronger! 💪",
        },
      ])
      setIsLoading(false)
    }
  }

  // Update profit/loss for a trade
  const updateProfitLoss = (tradeId: string, newPL: number) => {
    const updatedTrades = trades.map((trade) => (trade.id === tradeId ? { ...trade, profitLoss: newPL } : trade))
    setTrades(updatedTrades)
    localStorage.setItem("trades", JSON.stringify(updatedTrades))

    toast({
      title: "Success",
      description: "Profit/Loss updated successfully",
    })

    setEditingPL(null)
    setPlInputValue("")
  }

  // Start editing P/L
  const startEditingPL = (tradeId: string, currentPL?: number) => {
    setEditingPL(tradeId)
    setPlInputValue(currentPL?.toString() || "")
  }

  // Cancel editing P/L
  const cancelEditingPL = () => {
    setEditingPL(null)
    setPlInputValue("")
  }

  return (
    <div className="space-y-6">
      {/* Initial Capital Management Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Initial Capital
            </CardTitle>
            <CardDescription>Set your starting capital to track portfolio performance</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCapitalForm(!showCapitalForm)}
            className="flex items-center gap-2"
          >
            {initialCapital > 0 ? "Update Capital" : "Set Capital"}
          </Button>
        </CardHeader>

        <CardContent>
          {/* Current Capital Display */}
          {initialCapital > 0 && (
            <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {getCurrencySymbol(initialCapitalCurrency)}
                    {initialCapital.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">Initial Capital</div>
                </div>

                {portfolioPerformance && (
                  <>
                    <div className="text-center">
                      <div
                        className={`text-2xl font-bold ${
                          portfolioPerformance.currentValue >= initialCapital ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {getCurrencySymbol(portfolioPerformance.currency)}
                        {portfolioPerformance.currentValue.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Current Value</div>
                    </div>

                    <div className="text-center">
                      <div
                        className={`text-2xl font-bold ${
                          portfolioPerformance.totalPL >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {portfolioPerformance.totalPL >= 0 ? "+" : ""}
                        {getCurrencySymbol(portfolioPerformance.currency)}
                        {portfolioPerformance.totalPL.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">Total P/L</div>
                    </div>

                    <div className="text-center">
                      <div
                        className={`text-2xl font-bold ${
                          portfolioPerformance.performancePercent >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {portfolioPerformance.performancePercent >= 0 ? "+" : ""}
                        {portfolioPerformance.performancePercent.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Performance</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Capital Input Form */}
          {showCapitalForm && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">
                  {initialCapital > 0 ? "Update Initial Capital" : "Set Initial Capital"}
                </CardTitle>
                <CardDescription>
                  Enter your starting capital amount to track portfolio performance and returns
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleCapitalSubmit} className="space-y-4">
                  {/* Storage Error Alert */}
                  {capitalFormErrors.storage && (
                    <div className="flex items-center gap-2 p-3 text-sm border rounded-md bg-destructive/10 text-destructive border-destructive/20">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>{capitalFormErrors.storage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Amount Input */}
                    <div className="space-y-2">
                      <Label htmlFor="capital-amount" className="text-sm font-medium">
                        Initial Capital Amount *
                      </Label>
                      <div className="relative">
                        <Input
                          id="capital-amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="1000000000"
                          placeholder="Enter amount (e.g., 10000)"
                          value={capitalInput}
                          onChange={(e) => {
                            setCapitalInput(e.target.value)
                            // Clear amount error when user starts typing
                            if (capitalFormErrors.amount) {
                              setCapitalFormErrors((prev) => ({ ...prev, amount: undefined }))
                            }
                          }}
                          className={`pr-12 ${
                            capitalFormErrors.amount ? "border-destructive focus:border-destructive" : ""
                          }`}
                          disabled={isSubmittingCapital}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                          {getCurrencySymbol(selectedCurrency)}
                        </div>
                      </div>
                      {capitalFormErrors.amount && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {capitalFormErrors.amount}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Enter the total amount you started trading with</p>
                    </div>

                    {/* Currency Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="capital-currency" className="text-sm font-medium">
                        Currency *
                      </Label>
                      <Select
                        value={selectedCurrency}
                        onValueChange={(value) => {
                          setSelectedCurrency(value)
                          // Clear currency error when user selects
                          if (capitalFormErrors.currency) {
                            setCapitalFormErrors((prev) => ({ ...prev, currency: undefined }))
                          }
                        }}
                        disabled={isSubmittingCapital}
                      >
                        <SelectTrigger
                          id="capital-currency"
                          className={capitalFormErrors.currency ? "border-destructive focus:border-destructive" : ""}
                        >
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map((currency) => {
                            const IconComponent = currency.icon
                            return (
                              <SelectItem key={currency.code} value={currency.code}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="h-4 w-4" />
                                  <span className="font-mono">{currency.code}</span>
                                  <span className="text-muted-foreground">- {currency.name}</span>
                                </div>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      {capitalFormErrors.currency && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {capitalFormErrors.currency}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">Select the currency of your initial capital</p>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                    <Button
                      type="submit"
                      disabled={isSubmittingCapital || !capitalInput.trim() || !selectedCurrency}
                      className="flex items-center gap-2"
                    >
                      {isSubmittingCapital ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {initialCapital > 0 ? "Update Capital" : "Save Capital"}
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCapitalForm(false)
                        setCapitalFormErrors({})
                        // Reset form to current values
                        setCapitalInput(initialCapital > 0 ? initialCapital.toString() : "")
                        setSelectedCurrency(initialCapitalCurrency)
                      }}
                      disabled={isSubmittingCapital}
                    >
                      Cancel
                    </Button>
                  </div>

                  {/* Help Text */}
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="font-medium text-blue-900 dark:text-blue-100">Why set initial capital?</p>
                        <ul className="text-blue-800 dark:text-blue-200 space-y-1 ml-2">
                          <li>• Track your overall portfolio performance percentage</li>
                          <li>• Calculate return on investment (ROI)</li>
                          <li>• Monitor capital growth over time</li>
                          <li>• Better understand your trading efficiency</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* No Capital Set Message */}
          {initialCapital <= 0 && !showCapitalForm && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Initial Capital Set</h3>
              <p className="text-sm mb-4">
                Set your initial capital to track portfolio performance and calculate returns.
              </p>
              <Button onClick={() => setShowCapitalForm(true)} className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Set Initial Capital
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Portfolio Performance Chart */}
      {trades.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Portfolio Performance Analytics
              </CardTitle>
              <CardDescription>
                {chartData.length > 0
                  ? `Interactive visualization of your trading performance (${chartData.length} trades with P/L data)`
                  : "Add P/L data to your trades to see performance visualization"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChart(!showChart)}
                className="flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                {showChart ? "Hide Chart" : "Show Chart"}
              </Button>
            </div>
          </CardHeader>

          {showChart && (
            <CardContent>
              {chartData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Chart Data Available</h3>
                  <p className="text-sm mb-4">
                    To see your performance chart, you need to add Profit/Loss data to your trades.
                  </p>
                  <p className="text-xs">
                    Go to your trade cards below and click &quot;Add P/L&quot; or edit existing P/L values.
                  </p>
                </div>
              ) : (
                <>
                  {/* Enhanced Portfolio Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    <div className="text-center p-3 border rounded-lg">
                      <div className={`text-xl font-bold ${stats.totalPL >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {stats.totalPL >= 0 ? "+" : ""}
                        {stats.totalPL.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">Total P/L</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-xl font-bold text-primary">{stats.totalTrades}</div>
                      <div className="text-xs text-muted-foreground">Total Trades</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className={`text-xl font-bold ${stats.winRate >= 50 ? "text-green-600" : "text-red-600"}`}>
                        {stats.winRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Win Rate</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-xl font-bold text-blue-600">
                        {stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : "N/A"}
                      </div>
                      <div className="text-xs text-muted-foreground">Profit Factor</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-xl font-bold text-orange-600">{stats.maxDrawdown.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">Max Drawdown</div>
                    </div>
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-xl font-bold text-purple-600">
                        {stats.avgWin > 0 ? stats.avgWin.toFixed(2) : "0.00"}
                      </div>
                      <div className="text-xs text-muted-foreground">Avg Win</div>
                    </div>
                  </div>

                  {/* Chart Controls */}
                  <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="chart-type" className="text-sm font-medium">
                        Chart Type:
                      </Label>
                      <Select value={chartType} onValueChange={(value: "line" | "area" | "bar") => setChartType(value)}>
                        <SelectTrigger id="chart-type" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="line">Line Chart</SelectItem>
                          <SelectItem value="area">Area Chart</SelectItem>
                          <SelectItem value="bar">Bar Chart</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor="chart-filter" className="text-sm font-medium">
                        Currency:
                      </Label>
                      <Select value={chartFilter} onValueChange={setChartFilter}>
                        <SelectTrigger id="chart-filter" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Pairs</SelectItem>
                          {uniquePairs.map((pair) => (
                            <SelectItem key={pair} value={pair}>
                              {pair}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor="time-filter" className="text-sm font-medium">
                        Time Period:
                      </Label>
                      <Select value={timeFilter} onValueChange={setTimeFilter}>
                        <SelectTrigger id="time-filter" className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="7d">Last 7 Days</SelectItem>
                          <SelectItem value="30d">Last 30 Days</SelectItem>
                          <SelectItem value="90d">Last 90 Days</SelectItem>
                          <SelectItem value="1y">Last Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Interactive Chart */}
                  <div className="h-96 w-full border rounded-lg p-4 bg-background">
                    <ResponsiveContainer width="100%" height="100%">
                      {renderChart()}
                    </ResponsiveContainer>
                  </div>

                  {/* Chart Legend and Info */}
                  <div className="flex flex-wrap items-center justify-between mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 bg-primary"></div>
                        <span>{chartType === "bar" ? "Individual Trade P/L" : "Cumulative P/L"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 border-t-2 border-dashed border-muted-foreground"></div>
                        <span>Break-even Line</span>
                      </div>
                    </div>
                    <div className="text-xs">
                      Showing {chartData.length} trades • Hover over data points for details
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Trade Portfolio</CardTitle>
            <CardDescription>View and manage your saved trades</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export/Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToJSON}>
                <Download className="h-4 w-4 mr-2" />
                Export to JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import from JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="filter">Filter by Currency Pair</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger id="filter">
                  <SelectValue placeholder="Filter by currency pair" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pairs</SelectItem>
                  {uniquePairs.map((pair) => (
                    <SelectItem key={pair} value={pair}>
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-filter">Filter by Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger id="source-filter"><SelectValue placeholder="Filter by source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  {uniqueSources.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No trades found. Add some trades in the Journal tab.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTrades.map((trade) => (
                <Card key={trade.id} className="overflow-hidden">
                  <div
                    className={`h-8 flex items-center justify-between px-3 text-white text-sm font-medium ${
                      trade.action === "buy" ? "bg-green-500" : "bg-red-500"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {trade.action === "buy" ? (
                        <ArrowUpCircle className="h-4 w-4" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4" />
                      )}
                      {trade.action.toUpperCase()}
                    </span>

                    {trade.profitLoss !== undefined ? (
                      <span className="flex items-center gap-1 font-bold">
                        <DollarSign className="h-4 w-4" />
                        {trade.profitLoss >= 0 ? "+" : ""}
                        {trade.profitLoss.toFixed(2)}
                      </span>
                    ) : trade.status === "open" ? (
                      <span className="text-xs opacity-90">OPEN</span>
                    ) : (
                      <span className="text-xs opacity-90">NO P/L</span>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2"><h3 className="text-base font-bold">{trade.currencyPair}</h3>{trade.source === "broker" && <Badge variant="outline" className="h-5 border-blue-500/30 bg-blue-500/10 px-1.5 text-[10px] text-blue-600 dark:text-blue-400">Live</Badge>}</div>
                        <p className="text-xs text-muted-foreground">{formatDate(trade.date)}{trade.sourceName ? ` · ${trade.sourceName}` : " · Manual"}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={trade.action === "buy" ? "default" : "destructive"}
                          className="flex items-center text-xs py-0 h-5"
                        >
                          {trade.action === "buy" ? (
                            <ArrowUpCircle className="mr-1 h-3 w-3" />
                          ) : (
                            <ArrowDownCircle className="mr-1 h-3 w-3" />
                          )}
                          {trade.action.toUpperCase()}
                        </Badge>
                        <Badge variant={trade.status === "open" ? "outline" : "secondary"} className="text-xs py-0 h-5">
                          {trade.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    {/* Trade Details */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mb-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entry:</span>
                        <span>{trade.entryPrice.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size:</span>
                        <span>{trade.positionSize}</span>
                      </div>
                      {trade.stopLossPrice > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Stop Loss:</span>
                          <span>{trade.stopLossPrice.toFixed(5)}</span>
                        </div>
                      )}
                      {trade.takeProfitPrice > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Take Profit:</span>
                          <span>{trade.takeProfitPrice.toFixed(5)}</span>
                        </div>
                      )}
                      {trade.exitPrice && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Exit:</span>
                          <span>{trade.exitPrice.toFixed(5)}</span>
                        </div>
                      )}
                    </div>

                    {/* Profit/Loss Display and Edit */}
                    <div className="mb-2">
                      {editingPL === trade.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Enter P/L"
                              value={plInputValue}
                              onChange={(e) => setPlInputValue(e.target.value)}
                              className="text-sm h-8"
                            />
                            <Button
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => {
                                const newPL = Number.parseFloat(plInputValue)
                                if (!isNaN(newPL)) {
                                  updateProfitLoss(trade.id, newPL)
                                }
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 bg-transparent"
                              onClick={cancelEditingPL}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {trade.status === "closed" && trade.profitLoss !== undefined ? (
                            <div
                              className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer hover:opacity-80 ${
                                trade.profitLoss >= 0
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                              }`}
                              onClick={() => startEditingPL(trade.id, trade.profitLoss)}
                            >
                              <span className="font-medium text-xs flex items-center">
                                <DollarSign className="h-3 w-3 mr-1" />
                                P/L:
                              </span>
                              <span className="font-bold text-xs">
                                {trade.profitLoss >= 0 ? "+" : ""}
                                {trade.profitLoss.toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="grid grid-cols-2 gap-1">
                                {(() => {
                                  const potential = calculatePotentialPL(trade)
                                  return (
                                    <>
                                      <div
                                        className={`p-1 rounded-md text-center text-xs ${
                                          potential.takeProfit >= 0
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                        }`}
                                      >
                                        TP: {potential.takeProfit.toFixed(2)}
                                      </div>
                                      <div
                                        className={`p-1 rounded-md text-center text-xs ${
                                          potential.stopLoss >= 0
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                        }`}
                                      >
                                        SL: {potential.stopLoss.toFixed(2)}
                                      </div>
                                    </>
                                  )
                                })()}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-6 text-xs bg-transparent"
                                onClick={() => startEditingPL(trade.id)}
                              >
                                Add P/L
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-medium">Conditions:</h4>
                      <ul className="text-xs space-y-0.5">
                        {trade.conditions.map((condition) => (
                          <li key={condition.id} className="flex justify-between">
                            <span className="truncate mr-2">{condition.description}</span>
                            <span className="text-muted-foreground shrink-0">{condition.confidence}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Journal Notes Button */}
                    {trade.notes && (
                      <div className="mt-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full h-7 text-xs bg-transparent">
                              <BookOpen className="h-3 w-3 mr-1" />
                              View Notes
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Trade Notes</DialogTitle>
                              <DialogDescription>
                                {formatDate(trade.date)} - {trade.currencyPair} ({trade.action.toUpperCase()})
                              </DialogDescription>
                            </DialogHeader>
                            <div className="mt-2 max-h-[60vh] overflow-y-auto">
                              <div className="whitespace-pre-wrap text-sm">{trade.notes}</div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    )}

                    <div className="mt-2 flex justify-end">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this trade from your portfolio.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTrade(trade.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Chat Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Trading Assistant
          </CardTitle>
          <CardDescription>Get insights and analysis from your trading journal</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Chat Toggle Button - Floating */}
            <div className="fixed bottom-6 right-6 z-50">
              <Button
                onClick={() => setChatOpen(!chatOpen)}
                className={`w-14 h-14 rounded-full shadow-lg transition-all duration-300 ${
                  chatOpen
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                }`}
              >
                {chatOpen ? (
                  <span className="text-white text-xl">×</span>
                ) : (
                  <div className="relative">
                    <Bot className="h-6 w-6 text-white" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                )}
              </Button>
            </div>

            {/* Chat Interface - Popup */}
            {chatOpen && (
              <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-background border border-border rounded-lg shadow-2xl z-40 flex flex-col overflow-hidden">
                {/* Chat Header */}
                <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Trading Assistant</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isLoading ? "Thinking..." : "Here to help with trading & emotions"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChatOpen(false)}
                    className="text-gray-500 hover:text-gray-700 h-8 w-8 p-0"
                  >
                    ×
                  </Button>
                </div>

                {/* Chat Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {/* Welcome Message */}
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center mx-auto mb-4">
                          <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Welcome to Trading Support!
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          I&apos;m here to help with trading questions and provide emotional support during your trading
                          journey.
                        </p>
                        <div className="grid grid-cols-1 gap-2 text-xs">
                          <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            💡 Ask about trading strategies
                          </div>
                          <div className="p-2 bg-green-50 dark:bg-green-950 rounded-lg">📊 Get portfolio insights</div>
                          <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg">
                            🧘 Receive emotional support
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chat Messages */}
                    {chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {message.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}

                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.role === "user"
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                          <div
                            className={`text-xs mt-2 opacity-70 ${
                              message.role === "user" ? "text-blue-100" : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>

                        {message.role === "user" && (
                          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">You</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Typing Indicator */}
                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Quick Action Buttons */}
                <div className="p-3 border-t bg-gray-50 dark:bg-gray-900">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const message = "How can I improve my trading performance?"
                        setUserInput(message)
                        sendMessage()
                      }}
                      className="text-xs bg-transparent"
                    >
                      📈 Performance
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const message = "I'm feeling stressed about my recent losses. Can you help?"
                        setUserInput(message)
                        sendMessage()
                      }}
                      className="text-xs bg-transparent"
                    >
                      😰 Support
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const message = "What should I do when I'm on a losing streak?"
                        setUserInput(message)
                        sendMessage()
                      }}
                      className="text-xs bg-transparent"
                    >
                      🎯 Strategy
                    </Button>
                  </div>
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Ask me anything about trading..."
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && userInput.trim()) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      disabled={isLoading}
                    />
                    <Button onClick={sendMessage} disabled={!userInput.trim() || isLoading} size="sm" className="px-3">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Mobile Responsive Overlay */}
            {chatOpen && (
              <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setChatOpen(false)} />
            )}

            {/* Mobile Chat Interface */}
            {chatOpen && (
              <div className="md:hidden fixed inset-x-4 bottom-4 top-20 bg-background border border-border rounded-lg shadow-2xl z-40 flex flex-col overflow-hidden">
                {/* Same header as desktop but with close button */}
                <div className="flex items-center gap-3 p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Trading Assistant</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {isLoading ? "Thinking..." : "Here to help with trading & emotions"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setChatOpen(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ×
                  </Button>
                </div>

                {/* Mobile Messages - Same as desktop */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 flex items-center justify-center mx-auto mb-4">
                          <Bot className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Welcome to Trading Support!
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          I&apos;m here to help with trading questions and provide emotional support.
                        </p>
                      </div>
                    )}

                    {chatMessages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                      >
                        {message.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-4 w-4 text-white" />
                          </div>
                        )}

                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            message.role === "user"
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        </div>

                        {message.role === "user" && (
                          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">You</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Mobile Quick Actions */}
                <div className="p-3 border-t bg-gray-50 dark:bg-gray-900">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const message = "How can I improve my trading performance?"
                        setUserInput(message)
                        sendMessage()
                      }}
                      className="text-xs bg-transparent"
                    >
                      📈 Tips
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const message = "I'm feeling stressed about my recent losses. Can you help?"
                        setUserInput(message)
                        sendMessage()
                      }}
                      className="text-xs bg-transparent"
                    >
                      😰 Help
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const message = "What should I do when I'm on a losing streak?"
                        setUserInput(message)
                        sendMessage()
                      }}
                      className="text-xs bg-transparent"
                    >
                      🎯 Guide
                    </Button>
                  </div>
                </div>

                {/* Mobile Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Ask me anything..."
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && userInput.trim()) {
                          e.preventDefault()
                          sendMessage()
                        }
                      }}
                      disabled={isLoading}
                    />
                    <Button onClick={sendMessage} disabled={!userInput.trim() || isLoading} size="sm" className="px-3">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Trades from JSON</DialogTitle>
            <DialogDescription>
              Import trades from a JSON file. This will merge the imported trades with your existing trades.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                JSON Data
              </Label>
              <Textarea
                id="name"
                className="col-span-3"
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste your JSON data here"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="import-file" className="text-sm font-medium">
                Or upload a file:
              </Label>
              <Input type="file" id="import-file" className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="import-file" className="cursor-pointer">
                  Choose File
                </label>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button type="submit" onClick={importFromJSON}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
