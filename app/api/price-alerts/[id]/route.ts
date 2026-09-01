import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase-server"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request)
  if ("error" in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params

  const { error } = await supabase.from("price_alerts").delete().eq("id", id).eq("user_id", user.id)

  if (error) return NextResponse.json({ error: "Couldn't delete alert." }, { status: 500 })
  return NextResponse.json({ success: true })
}
