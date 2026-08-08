import { type NextRequest, NextResponse } from "next/server"

// Fallback AI analysis when OpenAI API is unavailable
function generateFallbackAnalysis(events: any[], analysisType: string) {
  const fallbackAnalysis = events.map((event) => {
    const eventName = event.event

    switch (analysisType) {
      case "summarize":
        return {
          eventName,
          summary: `${event.event} is a ${event.impact}-impact economic indicator for ${event.currency}. This event typically affects currency volatility and trading volumes.`,
          marketImpact: `Expected to influence ${event.currency} pairs, particularly during ${event.time} release time.`,
          affectedMarkets: `${event.currency}/USD, ${event.currency}/EUR, and related currency pairs`,
        }

      case "sentiment":
        // Simple sentiment based on forecast vs previous
        let sentiment = "neutral"
        if (event.forecast && event.previous) {
          const forecast = Number.parseFloat(event.forecast.replace(/[^\d.-]/g, ""))
          const previous = Number.parseFloat(event.previous.replace(/[^\d.-]/g, ""))
          if (!isNaN(forecast) && !isNaN(previous)) {
            sentiment = forecast > previous ? "positive" : forecast < previous ? "negative" : "neutral"
          }
        }

        return {
          eventName,
          sentiment,
          confidence: event.impact === "high" ? 8 : event.impact === "medium" ? 6 : 4,
          reasoning: `Based on ${event.impact} impact level and forecast vs previous data comparison.`,
        }

      case "context":
        return {
          eventName,
          description: `${event.event} measures economic activity in ${event.currency} region.`,
          importance: `This ${event.impact}-impact indicator is closely watched by traders and central banks.`,
          historicalContext: `Historical data shows this event typically causes ${event.impact} volatility in ${event.currency} markets.`,
          tradingStrategies: `Consider volatility-based strategies around ${event.time} release time. Monitor ${event.currency} pairs for breakout opportunities.`,
        }

      default:
        return { eventName, error: "Unknown analysis type" }
    }
  })

  return fallbackAnalysis
}

export async function POST(request: NextRequest) {
  try {
    const { events, analysisType } = await request.json()

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: "Invalid events data provided" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY

    // Check if OpenAI API key is available
    if (!apiKey) {
      console.log("OpenAI API key not configured, using fallback analysis")
      const fallbackAnalysis = generateFallbackAnalysis(events, analysisType)

      return NextResponse.json({
        analysis: fallbackAnalysis,
        fallback: true,
        message: "Using built-in analysis (OpenAI API key not configured)",
      })
    }

    // Try OpenAI API with proper error handling
    try {
      const { generateText } = await import("ai")
      const { openai } = await import("@ai-sdk/openai")

      let prompt = ""

      switch (analysisType) {
        case "summarize":
          prompt = `Analyze these economic events and provide concise summaries highlighting key aspects and potential market impact:

${events
  .map(
    (event) => `
Event: ${event.event}
Currency: ${event.currency}
Impact: ${event.impact}
Time: ${event.time}
Forecast: ${event.forecast || "N/A"}
Previous: ${event.previous || "N/A"}
`,
  )
  .join("\n")}

For each event, provide:
1. A brief summary (2-3 sentences)
2. Potential market impact
3. Key currencies/markets affected

Format as JSON array with objects containing: eventName, summary, marketImpact, affectedMarkets`

          break

        case "sentiment":
          prompt = `Perform sentiment analysis on these economic events and determine their likely market impact:

${events
  .map(
    (event) => `
Event: ${event.event}
Currency: ${event.currency}
Impact: ${event.impact}
Forecast: ${event.forecast || "N/A"}
Previous: ${event.previous || "N/A"}
`,
  )
  .join("\n")}

For each event, determine:
1. Sentiment: positive, negative, or neutral
2. Confidence level (1-10)
3. Reasoning (brief explanation)

Format as JSON array with objects containing: eventName, sentiment, confidence, reasoning`

          break

        case "context":
          prompt = `Provide detailed contextual information about these economic events:

${events
  .map(
    (event) => `
Event: ${event.event}
Currency: ${event.currency}
Impact: ${event.impact}
`,
  )
  .join("\n")}

For each event, provide:
1. What this indicator measures
2. Why it's important for traders
3. Historical context and typical market reactions
4. Trading strategies to consider

Format as JSON array with objects containing: eventName, description, importance, historicalContext, tradingStrategies`

          break

        default:
          return NextResponse.json({ error: "Invalid analysis type" }, { status: 400 })
      }

      const { text } = await generateText({
        model: openai("gpt-4o"),
        prompt,
        system:
          "You are an expert financial analyst specializing in economic events and forex markets. Provide accurate, actionable insights for traders.",
      })

      try {
        const analysis = JSON.parse(text)
        return NextResponse.json({ analysis })
      } catch (parseError) {
        // If JSON parsing fails, return the raw text
        return NextResponse.json({
          analysis: text,
          warning: "Response was not in expected JSON format",
        })
      }
    } catch (openaiError: any) {
      console.error("OpenAI API Error:", openaiError)

      // Handle specific OpenAI errors and provide fallback
      if (openaiError.message?.includes("quota") || openaiError.message?.includes("billing")) {
        console.log("OpenAI quota exceeded, using fallback analysis")
        const fallbackAnalysis = generateFallbackAnalysis(events, analysisType)

        return NextResponse.json({
          analysis: fallbackAnalysis,
          fallback: true,
          message: "OpenAI quota exceeded. Using built-in analysis instead.",
        })
      }

      if (openaiError.message?.includes("rate limit")) {
        console.log("OpenAI rate limit hit, using fallback analysis")
        const fallbackAnalysis = generateFallbackAnalysis(events, analysisType)

        return NextResponse.json({
          analysis: fallbackAnalysis,
          fallback: true,
          message: "Rate limit exceeded. Using built-in analysis instead.",
        })
      }

      // For any other OpenAI error, use fallback
      console.log("OpenAI API error, using fallback analysis")
      const fallbackAnalysis = generateFallbackAnalysis(events, analysisType)

      return NextResponse.json({
        analysis: fallbackAnalysis,
        fallback: true,
        message: "AI service temporarily unavailable. Using built-in analysis.",
      })
    }
  } catch (error) {
    console.error("General API Error:", error)

    // Final fallback for any unexpected errors
    try {
      const { events: eventsData, analysisType } = await request.json()
      const fallbackAnalysis = generateFallbackAnalysis(eventsData, analysisType)

      return NextResponse.json({
        analysis: fallbackAnalysis,
        fallback: true,
        message: "Service temporarily unavailable. Using built-in analysis.",
      })
    } catch (fallbackError) {
      return NextResponse.json(
        {
          error: "Analysis service temporarily unavailable. Please try again later.",
        },
        { status: 500 },
      )
    }
  }
}
