import { type NextRequest, NextResponse } from "next/server"

// Fallback chat responses when OpenAI is unavailable
function generateFallbackResponse(message: string, context?: any): string {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes("non-farm") || lowerMessage.includes("nfp")) {
    return "Non-Farm Payrolls (NFP) is one of the most important economic indicators for USD. It measures employment changes in the US economy excluding farm workers. Higher than expected NFP typically strengthens USD, while lower readings can weaken it. This high-impact event usually causes significant volatility in USD pairs."
  }

  if (lowerMessage.includes("interest rate") || lowerMessage.includes("fed") || lowerMessage.includes("central bank")) {
    return "Interest rate decisions are among the most market-moving events. When central banks raise rates, it typically strengthens the currency as higher rates attract foreign investment. Conversely, rate cuts usually weaken the currency. Traders should watch for both the decision and the accompanying statement for future policy hints."
  }

  if (lowerMessage.includes("gdp")) {
    return "Gross Domestic Product (GDP) measures the total economic output of a country. It's a key indicator of economic health. Higher GDP growth typically supports currency strength, while declining GDP can signal economic weakness and potential currency depreciation. GDP releases often cause significant market volatility."
  }

  if (lowerMessage.includes("inflation") || lowerMessage.includes("cpi") || lowerMessage.includes("ppi")) {
    return "Inflation indicators like CPI (Consumer Price Index) and PPI (Producer Price Index) are crucial for central bank policy decisions. Rising inflation often leads to expectations of higher interest rates, which can strengthen a currency. However, excessive inflation can be negative for economic stability."
  }

  if (lowerMessage.includes("unemployment")) {
    return "Unemployment data reflects labor market health. Lower unemployment typically indicates a strong economy and can support currency strength. However, very low unemployment might signal an overheating economy, while rising unemployment suggests economic weakness."
  }

  if (lowerMessage.includes("trading strategy") || lowerMessage.includes("how to trade")) {
    return "For economic events, consider these strategies: 1) News trading - enter positions immediately after releases, 2) Pre-event positioning based on forecasts, 3) Volatility trading using options or wide stop-losses, 4) Avoid trading during high-impact events if you prefer stability. Always use proper risk management and be aware of increased spreads during news releases."
  }

  if (lowerMessage.includes("risk") || lowerMessage.includes("management")) {
    return "Risk management during economic events is crucial: 1) Reduce position sizes before high-impact news, 2) Use wider stop-losses to account for volatility, 3) Be aware of spread widening during releases, 4) Consider closing positions before major events if uncertain, 5) Never risk more than you can afford to lose. Economic events can cause rapid, unpredictable price movements."
  }

  if (lowerMessage.includes("sentiment") || lowerMessage.includes("market mood")) {
    return "Market sentiment around economic events depends on: 1) Actual vs forecast results, 2) Previous trend of the indicator, 3) Current economic context, 4) Central bank policy expectations. Positive surprises (better than forecast) typically boost currency sentiment, while negative surprises can hurt it. Context matters - the same data can have different impacts in different economic environments."
  }

  // Default response
  return "I'm a trading assistant focused on economic events and forex analysis. While my AI capabilities are currently limited, I can help you understand economic indicators, their market impact, and basic trading strategies. For specific events, I can provide general guidance on what they measure and how they typically affect currency markets. What would you like to know about economic events or trading?"
}

export async function POST(request: NextRequest) {
  try {
    const { messages, context } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    const lastMessage = messages[messages.length - 1]?.content || ""

    // Check if OpenAI API key is available
    if (!apiKey) {
      console.log("OpenAI API key not configured, using fallback chat")
      const fallbackResponse = generateFallbackResponse(lastMessage, context)

      return new Response(fallbackResponse, {
        headers: {
          "Content-Type": "text/plain",
        },
      })
    }

    // Try OpenAI API with proper error handling
    try {
      const { streamText } = await import("ai")
      const { openai } = await import("@ai-sdk/openai")

      const systemPrompt = `You are an expert trading assistant with deep knowledge of forex markets, economic indicators, and trading strategies. 

${context ? `Current market context: ${JSON.stringify(context)}` : ""}

You can help with:
- Economic event analysis and interpretation
- Market sentiment analysis
- Trading strategy recommendations
- Risk management advice
- Technical and fundamental analysis

Provide clear, actionable insights while always emphasizing proper risk management.`

      const result = await streamText({
        model: openai("gpt-4o"),
        system: systemPrompt,
        messages: messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content,
        })),
      })

      return result.toAIStreamResponse()
    } catch (openaiError: any) {
      console.error("OpenAI Chat Error:", openaiError)

      // Handle specific errors and provide fallback
      if (
        openaiError.message?.includes("quota") ||
        openaiError.message?.includes("billing") ||
        openaiError.message?.includes("rate limit")
      ) {
        console.log("OpenAI unavailable, using fallback chat")
        const fallbackResponse = generateFallbackResponse(lastMessage, context)

        return new Response(fallbackResponse, {
          headers: {
            "Content-Type": "text/plain",
          },
        })
      }

      // For any other OpenAI error, use fallback
      const fallbackResponse = generateFallbackResponse(lastMessage, context)

      return new Response(fallbackResponse, {
        headers: {
          "Content-Type": "text/plain",
        },
      })
    }
  } catch (error) {
    console.error("Chat API Error:", error)

    // Final fallback
    const fallbackResponse =
      "I'm experiencing technical difficulties but I'm still here to help with trading and economic analysis questions. Please try asking your question again."

    return new Response(fallbackResponse, {
      headers: {
        "Content-Type": "text/plain",
      },
    })
  }
}
