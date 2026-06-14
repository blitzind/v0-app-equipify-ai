import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadGrowthSignalFeed } from "@/lib/growth/signal-intelligence/signal-feed-repository"
import {
  SIGNAL_FEED_FILTERS,
  SIGNAL_FEED_SORT_FIELDS,
  type SignalFeedFilter,
  type SignalFeedSortField,
} from "@/lib/growth/signal-intelligence/signal-feed-types"

export const runtime = "nodejs"
export const maxDuration = 120

function parseFilter(value: string | null): SignalFeedFilter | null {
  if (!value) return null
  return SIGNAL_FEED_FILTERS.includes(value as SignalFeedFilter) ? (value as SignalFeedFilter) : null
}

function parseSort(value: string | null): SignalFeedSortField {
  if (value && SIGNAL_FEED_SORT_FIELDS.includes(value as SignalFeedSortField)) {
    return value as SignalFeedSortField
  }
  return "occurred_at"
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const filter = parseFilter(url.searchParams.get("filter"))
  const sort = parseSort(url.searchParams.get("sort"))
  const limit = Number(url.searchParams.get("limit") ?? "50")
  const since = url.searchParams.get("since")

  try {
    const feed = await loadGrowthSignalFeed(access.admin, {
      filter,
      sort,
      limit: Number.isFinite(limit) ? limit : 50,
      since,
    })
    return NextResponse.json({ ok: true, feed })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
