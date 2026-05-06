import "server-only"

import { getQuickBooksApiBaseUrl } from "@/lib/integrations/quickbooks-env"

export const QB_MINOR_VERSION = "65"

export type QbFetchResult<T = unknown> = {
  ok: boolean
  status: number
  data?: T
  rawText?: string
  intuitTid?: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * QuickBooks Online REST JSON call for one company (realm).
 */
export async function qbFetchJson<T = unknown>(params: {
  realmId: string
  accessToken: string
  method: "GET" | "POST"
  /** Path after `/v3/company/{realmId}/` e.g. `customer` or `query` */
  resourcePath: string
  /** Query string without leading `?` */
  searchParams?: Record<string, string>
  body?: Record<string, unknown>
  /** Retry once after refreshing token (caller supplies new token). */
  onUnauthorized?: () => Promise<string | null>
}): Promise<QbFetchResult<T>> {
  const base = getQuickBooksApiBaseUrl().replace(/\/$/, "")
  const sp = new URLSearchParams()
  sp.set("minorversion", QB_MINOR_VERSION)
  if (params.searchParams) {
    for (const [k, v] of Object.entries(params.searchParams)) {
      sp.set(k, v)
    }
  }

  const url = `${base}/v3/company/${encodeURIComponent(params.realmId)}/${params.resourcePath.replace(/^\//, "")}?${sp.toString()}`

  async function once(token: string): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    }
    if (params.method === "POST") {
      headers["Content-Type"] = "application/json"
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90_000)

    try {
      return await fetch(url, {
        method: params.method,
        headers,
        body: params.method === "POST" && params.body ? JSON.stringify(params.body) : undefined,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  let res = await once(params.accessToken)

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "2") * 1000 || 2000
    await sleep(Math.min(retryAfter, 8000))
    res = await once(params.accessToken)
  }

  if (res.status === 401 && params.onUnauthorized) {
    const newTok = await params.onUnauthorized()
    if (newTok) {
      res = await once(newTok)
    }
  }

  const intuitTid = res.headers.get("intuit_tid")
  const rawText = await res.text()
  let data: T | undefined
  try {
    data = rawText ? (JSON.parse(rawText) as T) : undefined
  } catch {
    data = undefined
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    rawText,
    intuitTid,
  }
}

/** Escape single quotes for QuickBooks query language literals. */
export function qbSqlEscape(value: string): string {
  return value.replace(/'/g, "''")
}
