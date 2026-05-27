import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createGrowthSignalWatchlist,
  listGrowthSignalWatchlists,
} from "@/lib/growth/signals/signal-watchlist-repository"
import {
  GROWTH_SIGNAL_WATCHLIST_SIGNAL_TYPES,
  GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
  normalizeSignalWatchlistFilters,
  type GrowthSignalWatchlistFilters,
} from "@/lib/growth/signals/signal-watchlist-types"
import { GROWTH_SIGNAL_WATCHLIST_SCHEMA_SETUP_MESSAGE } from "@/lib/growth/signals/signal-watchlist-schema-health"
import type { GrowthSignalType } from "@/lib/growth/signals/signal-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const watchlists = await listGrowthSignalWatchlists(access.admin)

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
    items: watchlists,
    total: watchlists.length,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    description?: string | null
    signal_types?: string[]
    filters?: Partial<GrowthSignalWatchlistFilters>
    organization_id?: string | null
    metadata?: Record<string, unknown>
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Watchlist name is required." },
      { status: 400 },
    )
  }

  const signal_types = Array.isArray(body.signal_types)
    ? body.signal_types.filter((value): value is GrowthSignalType =>
        GROWTH_SIGNAL_WATCHLIST_SIGNAL_TYPES.includes(value as GrowthSignalType),
      )
    : []

  const watchlist = await createGrowthSignalWatchlist(access.admin, {
    name,
    description: body.description ?? null,
    signal_types,
    filters: normalizeSignalWatchlistFilters(body.filters),
    organization_id: body.organization_id ?? null,
    created_by: access.userId,
    metadata: body.metadata ?? {},
  })

  if (!watchlist) {
    return NextResponse.json(
      {
        ok: false,
        error: "schema_not_ready",
        message: GROWTH_SIGNAL_WATCHLIST_SCHEMA_SETUP_MESSAGE,
      },
      { status: 503 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
    watchlist,
  })
}
