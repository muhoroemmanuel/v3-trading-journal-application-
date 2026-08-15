import { type NextRequest, NextResponse } from "next/server"

const accountsStore = new Map<string, any>()

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!accountsStore.has(id)) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }
  accountsStore.delete(id)
  return NextResponse.json({ success: true })
}
