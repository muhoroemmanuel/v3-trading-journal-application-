"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import {
  Calendar,
  RefreshCw,
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Bot,
  Sparkles,
  MessageSquare,
  BarChart3,
  AlertCircle,
  Loader2,
  Info,
  Zap,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface EconomicEvent {
  id: string
  time: string
  currency: string
  impact: "high" | "medium" | "low"
  event: string
  actual?: string
  forecast?: string
  previous?: string
  aiSummary?: string
  sentiment?: "positive" | "negative" | "neutral"
  sentimentConfidence?: number
  contextualInfo?: string
}

interface AIAnalysis {
  eventName: string
  summary?: string
  marketImpact?: string
  affectedMarkets?: string
  sentiment?: "positive" | "negative" | "neutral"
  confidence?: number
  reasoning?: string
  description?: string
  importance?: string
  historicalContext?: string
  tradingStrategies?: string
}

export default function ForexFactoryEvents() {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [filteredEvents, setFilteredEvents] = useState<EconomicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Filter states
  const [currencyFilter, setCurrencyFilter] = useState("all")
  const [impactFilter, setImpactFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"time" | "impact" | "currency" | "event">("time")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  // AI Analysis states
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, AIAnalysis>>({})
  const [selectedEvent, setSelectedEvent] = useState<EconomicEvent | null>(null)
  const [contextQuery, setContextQuery] = useState("")
  const [contextLoading, setContextLoading] = useState(false)
  const [contextResponse, setContextResponse] = useState("")
  const [usingFallback, setUsingFallback] = useState(false)

  // Mock data - replace with real Forex Factory API
  const mockEvents: EconomicEvent[] = [
    {
      id: "1",
      time: "08:30",
      currency: "USD",
      impact: "high",
      event: "Non-Farm Payrolls",
      forecast: "200K",
      previous: "187K",
    },
    {
      id: "2",
      time: "10:00",
      currency: "EUR",
      impact: "medium",
      event: "German Factory Orders",
      forecast: "0.5%",
      previous: "-0.2%",
    },
    {
      id: "3",
      time: "12:30",
      currency: "GBP",
      impact: "high",
      event: "BOE Interest Rate Decision",
      forecast: "5.25%",
      previous: "5.25%",
    },
    {
      id: "4",
      time: "14:00",
      currency: "USD",
      impact: "low",
      event: "Consumer Credit",
      forecast: "15.0B",
      previous: "12.1B",
    },
    {
      id: "5",
      time: "15:30",
      currency: "CAD",
      impact: "medium",
      event: "Employment Change",
      forecast: "25.0K",
      previous: "21.8K",
    },
  ]

  // Load events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true)
        setError(null)

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        setEvents(mockEvents)
        setLastUpdated(new Date())
      } catch (err) {
        setError("Failed to load economic events. Please try again.")
        console.error("Error loading events:", err)
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
  }, [])

  // Filter and sort events
  useEffect(() => {
    let filtered = [...events]

    // Apply filters
    if (currencyFilter !== "all") {
      filtered = filtered.filter((event) => event.currency === currencyFilter)
    }

    if (impactFilter !== "all") {
      filtered = filtered.filter((event) => event.impact === impactFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (event) =>
          event.event.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.currency.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortBy) {
        case "time":
          aValue = a.time
          bValue = b.time
          break
        case "impact":
          const impactOrder = { high: 3, medium: 2, low: 1 }
          aValue = impactOrder[a.impact]
          bValue = impactOrder[b.impact]
          break
        case "currency":
          aValue = a.currency
          bValue = b.currency
          break
        case "event":
          aValue = a.event
          bValue = b.event
          break
        default:
          aValue = a.time
          bValue = b.time
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

    setFilteredEvents(filtered)
  }, [events, currencyFilter, impactFilter, dateFilter, searchTerm, sortBy, sortOrder])

  // AI Analysis Functions
  const analyzeEvents = async (analysisType: "summarize" | "sentiment" | "context") => {
    if (filteredEvents.length === 0) {
      toast({
        title: "No Events",
        description: "No events available for analysis",
        variant: "destructive",
      })
      return
    }

    setAiAnalyzing(true)
    setUsingFallback(false)

    try {
      const response = await fetch("/api/openai/analyze-events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          events: filteredEvents,
          analysisType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Analysis failed")
      }

      const { analysis, fallback, message } = await response.json()

      // Update events with AI analysis
      const analysisMap: Record<string, AIAnalysis> = {}

      if (Array.isArray(analysis)) {
        analysis.forEach((item: AIAnalysis) => {
          analysisMap[item.eventName] = item
        })
      }

      setAiAnalysis((prev) => ({ ...prev, ...analysisMap }))

      if (fallback) {
        setUsingFallback(true)
        toast({
          title: "Analysis Complete (Fallback Mode)",
          description: message || `Built-in ${analysisType} analysis completed for ${analysis.length || 0} events`,
        })
      } else {
        toast({
          title: "AI Analysis Complete",
          description: `AI ${analysisType} analysis completed for ${analysis.length || 0} events`,
        })
      }
    } catch (error) {
      console.error("AI Analysis Error:", error)
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze events",
        variant: "destructive",
      })
    } finally {
      setAiAnalyzing(false)
    }
  }

  const queryEventContext = async () => {
    if (!selectedEvent || !contextQuery.trim()) {
      toast({
        title: "Invalid Query",
        description: "Please select an event and enter a query",
        variant: "destructive",
      })
      return
    }

    setContextLoading(true)
    setContextResponse("")

    try {
      const response = await fetch("/api/openai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Regarding the economic event "${selectedEvent.event}" (${selectedEvent.currency}): ${contextQuery}`,
            },
          ],
          context: {
            event: selectedEvent,
            currentEvents: filteredEvents,
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get contextual information")
      }

      const reader = response.body?.getReader()
      if (!reader) {
        // Fallback for non-streaming response
        const text = await response.text()
        setContextResponse(text)
        return
      }

      // Handle streaming response
      let result = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        result += chunk
        setContextResponse(result)
      }
    } catch (error) {
      console.error("Context Query Error:", error)

      // Provide fallback response
      const fallbackResponse = `I can provide some general information about ${selectedEvent.event}:

This is a ${selectedEvent.impact}-impact economic indicator for ${selectedEvent.currency}. Economic events like this typically affect currency volatility and can influence trading decisions.

For specific analysis, the AI service is currently unavailable, but you can monitor this event for potential market movements around ${selectedEvent.time}.`

      setContextResponse(fallbackResponse)

      toast({
        title: "Using Fallback Response",
        description: "AI service unavailable, showing general information",
      })
    } finally {
      setContextLoading(false)
    }
  }

  const refreshEvents = async () => {
    setLoading(true)
    setError(null)

    try {
      // Simulate API call with delay
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setEvents(mockEvents)
      setLastUpdated(new Date())

      toast({
        title: "Events Updated",
        description: "Economic events have been refreshed",
      })
    } catch (err) {
      setError("Failed to refresh events")
      toast({
        title: "Refresh Failed",
        description: "Could not refresh economic events",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100"
    }
  }

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case "negative":
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case "neutral":
        return <Minus className="h-4 w-4 text-gray-600" />
      default:
        return null
    }
  }

  const uniqueCurrencies = Array.from(new Set(events.map((event) => event.currency)))

  if (loading && events.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Economic Calendar
          </CardTitle>
          <CardDescription>Loading economic events...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Economic Calendar with AI Analysis
              </CardTitle>
              <CardDescription>
                Real-time economic events with AI-powered insights and sentiment analysis
                {lastUpdated && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshEvents}
                disabled={loading}
                className="flex items-center gap-2 bg-transparent"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Fallback Mode Notice */}
          {usingFallback && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Fallback Mode Active:</strong> AI service is currently unavailable. Using built-in analysis
                instead. Analysis quality may be reduced but basic functionality remains available.
              </AlertDescription>
            </Alert>
          )}

          {/* AI Analysis Controls */}
          <div className="flex flex-wrap items-center gap-2 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border">
            <div className="flex items-center gap-2 text-sm font-medium">
              {usingFallback ? (
                <Zap className="h-4 w-4 text-orange-600" />
              ) : (
                <Sparkles className="h-4 w-4 text-blue-600" />
              )}
              {usingFallback ? "Built-in Analysis:" : "AI Analysis:"}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => analyzeEvents("summarize")}
              disabled={aiAnalyzing || filteredEvents.length === 0}
              className="flex items-center gap-2"
            >
              {aiAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
              Summarize Events
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => analyzeEvents("sentiment")}
              disabled={aiAnalyzing || filteredEvents.length === 0}
              className="flex items-center gap-2"
            >
              {aiAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
              Sentiment Analysis
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => analyzeEvents("context")}
              disabled={aiAnalyzing || filteredEvents.length === 0}
              className="flex items-center gap-2"
            >
              {aiAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
              Get Context
            </Button>
          </div>

          {/* Filters and Search */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Events</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search events or currency..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency-filter">Currency</Label>
              <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                <SelectTrigger id="currency-filter">
                  <SelectValue placeholder="All currencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Currencies</SelectItem>
                  {uniqueCurrencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="impact-filter">Impact Level</Label>
              <Select value={impactFilter} onValueChange={setImpactFilter}>
                <SelectTrigger id="impact-filter">
                  <SelectValue placeholder="All impacts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Impacts</SelectItem>
                  <SelectItem value="high">High Impact</SelectItem>
                  <SelectItem value="medium">Medium Impact</SelectItem>
                  <SelectItem value="low">Low Impact</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort-by">Sort By</Label>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger id="sort-by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">Time</SelectItem>
                    <SelectItem value="impact">Impact</SelectItem>
                    <SelectItem value="currency">Currency</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Events Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-primary">{filteredEvents.length}</div>
              <div className="text-sm text-muted-foreground">Total Events</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {filteredEvents.filter((e) => e.impact === "high").length}
              </div>
              <div className="text-sm text-muted-foreground">High Impact</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {filteredEvents.filter((e) => e.impact === "medium").length}
              </div>
              <div className="text-sm text-muted-foreground">Medium Impact</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {filteredEvents.filter((e) => e.impact === "low").length}
              </div>
              <div className="text-sm text-muted-foreground">Low Impact</div>
            </div>
          </div>

          {/* Events Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead className="w-16">Currency</TableHead>
                  <TableHead className="w-24">Impact</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead className="w-20">Forecast</TableHead>
                  <TableHead className="w-20">Previous</TableHead>
                  <TableHead className="w-24">Analysis</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No events found matching your criteria
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => {
                    const analysis = aiAnalysis[event.event]
                    const isUpcoming =
                      event.time >
                      new Date().toLocaleTimeString("en-US", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                      })

                    return (
                      <TableRow key={event.id} className={isUpcoming ? "bg-blue-50 dark:bg-blue-950" : ""}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {event.time}
                            {isUpcoming && (
                              <Badge variant="secondary" className="text-xs">
                                SOON
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {event.currency}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getImpactColor(event.impact)} text-xs`}>
                            {event.impact.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{event.event}</div>
                            {analysis?.summary && (
                              <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-2 rounded">
                                <div className="flex items-center gap-1 mb-1">
                                  {usingFallback ? (
                                    <Zap className="h-3 w-3 text-orange-500" />
                                  ) : (
                                    <Bot className="h-3 w-3" />
                                  )}
                                  <span className="font-medium">
                                    {usingFallback ? "Built-in Summary:" : "AI Summary:"}
                                  </span>
                                </div>
                                {analysis.summary}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{event.forecast || "-"}</TableCell>
                        <TableCell className="text-sm">{event.previous || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSentimentIcon(analysis?.sentiment)}
                            {analysis?.sentiment && (
                              <div className="text-xs">
                                <div className="capitalize">{analysis.sentiment}</div>
                                {analysis.confidence && (
                                  <div className="text-muted-foreground">{analysis.confidence}/10</div>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedEvent(event)
                                  setContextQuery("")
                                  setContextResponse("")
                                }}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  {usingFallback ? (
                                    <Zap className="h-5 w-5 text-orange-500" />
                                  ) : (
                                    <Bot className="h-5 w-5" />
                                  )}
                                  {usingFallback ? "Built-in Analysis" : "AI Analysis"}: {event.event}
                                </DialogTitle>
                              </DialogHeader>

                              <div className="space-y-4">
                                {/* Event Details */}
                                <div className="p-4 bg-muted/50 rounded-lg">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <strong>Currency:</strong> {event.currency}
                                    </div>
                                    <div>
                                      <strong>Time:</strong> {event.time}
                                    </div>
                                    <div>
                                      <strong>Impact:</strong> {event.impact}
                                    </div>
                                    <div>
                                      <strong>Forecast:</strong> {event.forecast || "N/A"}
                                    </div>
                                  </div>
                                </div>

                                {/* Analysis Results */}
                                {analysis && (
                                  <div className="space-y-3">
                                    {analysis.summary && (
                                      <div>
                                        <h4 className="font-medium mb-2">Summary</h4>
                                        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                                      </div>
                                    )}

                                    {analysis.sentiment && (
                                      <div>
                                        <h4 className="font-medium mb-2">Sentiment Analysis</h4>
                                        <div className="flex items-center gap-2">
                                          {getSentimentIcon(analysis.sentiment)}
                                          <span className="capitalize">{analysis.sentiment}</span>
                                          {analysis.confidence && (
                                            <Badge variant="outline">Confidence: {analysis.confidence}/10</Badge>
                                          )}
                                        </div>
                                        {analysis.reasoning && (
                                          <p className="text-sm text-muted-foreground mt-2">{analysis.reasoning}</p>
                                        )}
                                      </div>
                                    )}

                                    {analysis.tradingStrategies && (
                                      <div>
                                        <h4 className="font-medium mb-2">Trading Strategies</h4>
                                        <p className="text-sm text-muted-foreground">{analysis.tradingStrategies}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Contextual Query */}
                                <div className="space-y-3 border-t pt-4">
                                  <h4 className="font-medium">
                                    Ask {usingFallback ? "Built-in Assistant" : "AI"} About This Event
                                  </h4>
                                  <Textarea
                                    placeholder="Ask a specific question about this economic event..."
                                    value={contextQuery}
                                    onChange={(e) => setContextQuery(e.target.value)}
                                    className="min-h-[80px]"
                                  />
                                  <Button
                                    onClick={queryEventContext}
                                    disabled={contextLoading || !contextQuery.trim()}
                                    className="w-full"
                                  >
                                    {contextLoading ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Getting Response...
                                      </>
                                    ) : (
                                      <>
                                        {usingFallback ? (
                                          <Zap className="mr-2 h-4 w-4" />
                                        ) : (
                                          <Bot className="mr-2 h-4 w-4" />
                                        )}
                                        Get Insights
                                      </>
                                    )}
                                  </Button>

                                  {contextResponse && (
                                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                      <h5 className="font-medium mb-2 flex items-center gap-2">
                                        {usingFallback ? (
                                          <Zap className="h-4 w-4 text-orange-500" />
                                        ) : (
                                          <Bot className="h-4 w-4" />
                                        )}
                                        Response:
                                      </h5>
                                      <ScrollArea className="max-h-60">
                                        <div className="text-sm whitespace-pre-wrap">{contextResponse}</div>
                                      </ScrollArea>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
