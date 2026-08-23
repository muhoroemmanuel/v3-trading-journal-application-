import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export function getSupabaseForUser(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

/**
 * Verifies the request's bearer token against Supabase and returns a client
 * scoped to that user (so RLS applies) plus the user object. Returns a
 * ready-to-send NextResponse instead if auth fails for any reason — callers
 * just need to check which field is set.
 */
export async function requireUser(
  request: NextRequest,
): Promise<{ supabase: SupabaseClient; user: { id: string } } | { error: NextResponse }> {
  const authHeader = request.headers.get("authorization")
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "")

  if (!accessToken) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) }
  }

  const supabase = getSupabaseForUser(accessToken)
  if (!supabase) {
    return { error: NextResponse.json({ error: "Supabase isn't configured on this deployment." }, { status: 503 }) }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 }) }
  }

  return { supabase, user }
}
