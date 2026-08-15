import { type NextRequest, NextResponse } from "next/server"

const accountsStore = new Map<string, any>()

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!accountsStore.has(id)) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }
  accountsStore.delete(id)
  return NextResponse.json({ success: true })
}
