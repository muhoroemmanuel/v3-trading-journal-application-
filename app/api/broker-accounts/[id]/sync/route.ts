import { type NextRequest, NextResponse } from "next/server"

const accountsStore = new Map<string, any>()

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!accountsStore.has(id)) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 })
  }
  const account = accountsStore.get(id)
  account.status = "Connected"
  account.lastSynced = "Just now"
  accountsStore.set(id, account)
  return NextResponse.json(account)
}
