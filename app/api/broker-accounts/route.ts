import { type NextRequest, NextResponse } from "next/server"

const accountsStore = new Map<string, any>()

export async function GET() {
  const accounts = Array.from(accountsStore.values())
  return NextResponse.json(accounts.length ? accounts : [])
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { platform, server, accountNumber, password } = body

    if (!platform || !server || !accountNumber || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const account = {
      id,
      platform,
      server,
      accountNumber: `•••${accountNumber.slice(-4)}`,
      status: "Connected",
      lastSynced: "Just now",
    }

    accountsStore.set(id, account)
    return NextResponse.json(account, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}
