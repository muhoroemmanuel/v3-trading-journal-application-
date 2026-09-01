// Thin wrapper around MetaApi.cloud's REST API (https://metaapi.cloud/docs/).
// MetaApi is the bridge that makes MT4/MT5 syncing possible at all — MetaTrader
// itself has no public API, so this is what actually connects to the broker's
// terminal using the investor (read-only) password and exposes trade history.
//
// Two separate API hosts are involved:
//   - Provisioning API: create/read/remove the MT account connection itself
//   - Client API: read live data (deals, account info) — this one is
//     region-specific, so we always read `region` off the account object
//     first rather than assuming a region.

const PROVISIONING_HOST = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai"

function getToken(): string {
  const token = process.env.METAAPI_TOKEN
  if (!token) throw new MetaApiNotConfiguredError()
  return token
}

export class MetaApiNotConfiguredError extends Error {
  constructor() {
    super("METAAPI_TOKEN is not configured on this deployment.")
    this.name = "MetaApiNotConfiguredError"
  }
}

export class MetaApiRequestError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = "MetaApiRequestError"
    this.status = status
    this.body = body
  }
}

async function metaApiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "auth-token": getToken(),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new MetaApiRequestError(
      (body as any)?.message || `MetaApi request failed (${res.status})`,
      res.status,
      body,
    )
  }
  if (res.status === 204) return null
  return res.json()
}

export interface ProvisionAccountInput {
  platform: "mt4" | "mt5"
  server: string
  login: string
  /** Investor (read-only) password — never persisted by us, only forwarded to MetaApi. */
  password: string
  name: string
}

export interface MetaApiAccount {
  _id: string
  login: string
  server: string
  state: string // e.g. "DEPLOYING" | "DEPLOYED" | "UNDEPLOYED"
  connectionStatus: string // e.g. "DISCONNECTED" | "CONNECTED"
  region: string
}

/** Provisions a new MT4/MT5 account connection. Returns MetaApi's account id. */
export async function provisionAccount(input: ProvisionAccountInput): Promise<{ id: string; state: string }> {
  return metaApiFetch(`${PROVISIONING_HOST}/users/current/accounts`, {
    method: "POST",
    headers: { "transaction-id": crypto.randomUUID() },
    body: JSON.stringify({
      login: input.login,
      password: input.password,
      name: input.name,
      server: input.server,
      platform: input.platform,
      magic: 0,
    }),
  })
}

/** Reads current deployment/connection state + region for an account. */
export async function getAccount(metaApiAccountId: string): Promise<MetaApiAccount> {
  return metaApiFetch(`${PROVISIONING_HOST}/users/current/accounts/${metaApiAccountId}`)
}

/** Removes the account connection from MetaApi entirely (used on disconnect). */
export async function deleteAccount(metaApiAccountId: string): Promise<void> {
  await metaApiFetch(`${PROVISIONING_HOST}/users/current/accounts/${metaApiAccountId}`, { method: "DELETE" })
}

export interface MetatraderDeal {
  id: string
  positionId?: string
  orderId?: string
  symbol?: string
  type: string // "DEAL_TYPE_BUY" | "DEAL_TYPE_SELL" | "DEAL_TYPE_BALANCE" | ...
  entryType?: string // "DEAL_ENTRY_IN" | "DEAL_ENTRY_OUT" | "DEAL_ENTRY_INOUT"
  price?: number
  volume?: number
  profit?: number
  commission?: number
  swap?: number
  time: string
  brokerTime?: string
}

/**
 * Reads history deals for an account within a time range. Region-specific —
 * pass the `region` string from getAccount(), not a hardcoded guess.
 */
export async function getHistoryDeals(
  metaApiAccountId: string,
  region: string,
  startTime: Date,
  endTime: Date,
): Promise<MetatraderDeal[]> {
  const host = `https://mt-client-api-v1.${region}.agiliumtrade.ai`
  const path = `/users/current/accounts/${metaApiAccountId}/history-deals/time/${startTime.toISOString()}/${endTime.toISOString()}`
  return metaApiFetch(`${host}${path}`)
}
