import { type NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/supabase-server"
import { deleteAccount, MetaApiRequestError } from "@/lib/metaapi"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request)
  if ("error" in auth) return auth.error
  const { supabase, user } = auth
  const { id } = await params

  const { data: row, error: fetchError } = await supabase
    .from("broker_connections")
    .select("id, metaapi_account_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 })
  }

  if (row.metaapi_account_id) {
    try {
      await deleteAccount(row.metaapi_account_id)
    } catch (err) {
      // If MetaApi already doesn't know about it, that's fine — proceed to
      // remove our own record either way rather than leaving it stuck.
      if (!(err instanceof MetaApiRequestError && err.status === 404)) {
        console.error("broker-accounts DELETE (metaapi):", err)
      }
    }
  }

  const { error: deleteError } = await supabase.from("broker_connections").delete().eq("id", id).eq("user_id", user.id)

  if (deleteError) {
    console.error("broker-accounts DELETE (supabase):", deleteError)
    return NextResponse.json({ error: "Couldn't remove the connection." }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
