import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzeTradingPsychology, type TradeForAnalysis } from "@/lib/trading-psychology"

// This route is intentionally separate from /api/openai/chat, which powers
// the economic-events assistant with a different system prompt and no user
// data. Mixing the two would risk regressing that feature every time the
// coach prompt changes.

const COACH_SYSTEM_PROMPT_BASE = `You are an experienced trading psychology coach. Your job is to help this trader manage emotion and risk — not to give market predictions or specific trade calls.

Ground every response in the trader's actual behavior data below, not generic advice. If you see a revenge-trading or overconfidence pattern in the data, name it directly and kindly. If the data shows no problems, don't invent any — acknowledge what's working.

Keep responses concise and actionable. Never suggest specific entries/exits or predict price direction — that's outside your role. Your focus is discipline, position sizing, and emotional regulation.`

function getSupabaseForUser(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Invalid messages format" }, { status: 400 })
    }

    const authHeader = request.headers.get("authorization")
    const accessToken = authHeader?.replace(/^Bearer\s+/i, "")

    if (!accessToken) {
      return NextResponse.json(
        { error: "Sign in required — the coach needs your trade history to give personalized guidance." },
        { status: 401 },
      )
    }

    const supabase = getSupabaseForUser(accessToken)
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase isn't configured on this deployment, so the coach can't access trade history." },
        { status: 503 },
      )
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 })
    }

    const { data: trades, error: tradesError } = await supabase
      .from("trades")
      .select("id, currency_pair, action, position_size, status, profit_loss, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(200)

    if (tradesError) {
      console.error("Coach: failed to load trades", tradesError)
      return NextResponse.json({ error: "Couldn't load trade history." }, { status: 500 })
    }

    const insights = analyzeTradingPsychology((trades ?? []) as TradeForAnalysis[])
    const systemPrompt = `${COACH_SYSTEM_PROMPT_BASE}\n\nTrader's behavior data: ${insights.summary}`

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "AI coaching isn't configured on this deployment (missing OPENAI_API_KEY). Here's what the data shows: " +
            insights.summary,
        },
        { status: 503 },
      )
    }

    // Persist the user's message right away; the assistant's reply is saved
    // in onFinish once streaming completes, so a device switch mid-stream
    // still keeps the user's half of the conversation.
    const lastUserMessage = messages[messages.length - 1]
    if (lastUserMessage?.role === "user") {
      await supabase.from("coach_messages").insert({
        user_id: user.id,
        role: "user",
        content: lastUserMessage.content,
      })
    }

    const { streamText } = await import("ai")
    const { openai } = await import("@ai-sdk/openai")

    const result = await streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages: messages.map((msg: any) => ({ role: msg.role, content: msg.content })),
      onFinish: async ({ text }) => {
        await supabase.from("coach_messages").insert({
          user_id: user.id,
          role: "assistant",
          content: text,
        })
      },
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error("Coach chat error:", error)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  // Fetch conversation history so it follows the user across devices.
  const authHeader = request.headers.get("authorization")
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "")
  if (!accessToken) return NextResponse.json({ error: "Sign in required." }, { status: 401 })

  const supabase = getSupabaseForUser(accessToken)
  if (!supabase) return NextResponse.json({ error: "Supabase isn't configured." }, { status: 503 })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: "Session expired." }, { status: 401 })

  const { data, error } = await supabase
    .from("coach_messages")
    .select("role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(100)

  if (error) return NextResponse.json({ error: "Couldn't load conversation history." }, { status: 500 })
  return NextResponse.json({ messages: data ?? [] })
}
