import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getGrowthSignalWatchlist,
  updateGrowthSignalWatchlist,
} from "@/lib/growth/signals/signal-watchlist-repository"
import {
  GROWTH_SIGNAL_WATCHLIST_SIGNAL_TYPES,
  GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
  normalizeSignalWatchlistFilters,
  type GrowthSignalWatchlistFilters,
} from "@/lib/growth/signals/signal-watchlist-types"
import type { GrowthSignalType } from "@/lib/growth/signals/signal-types"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const watchlist = await getGrowthSignalWatchlist(access.admin, id?.trim() ?? "")
  if (!watchlist || watchlist.archived_at) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Watchlist not found." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
    watchlist,
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const watchlistId = id?.trim()
  if (!watchlistId) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Watchlist id is required." },
      { status: 400 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    description?: string | null
    signal_types?: string[]
    filters?: Partial<GrowthSignalWatchlistFilters>
    metadata?: Record<string, unknown>
    archive?: boolean
  }

  const signal_types = Array.isArray(body.signal_types)
    ? body.signal_types.filter((value): value is GrowthSignalType =>
        GROWTH_SIGNAL_WATCHLIST_SIGNAL_TYPES.includes(value as GrowthSignalType),
      )
    : undefined

  const watchlist = await updateGrowthSignalWatchlist(access.admin, watchlistId, {
    name: body.name,
    description: body.description,
    signal_types,
    filters: body.filters ? normalizeSignalWatchlistFilters(body.filters) : undefined,
    metadata: body.metadata,
    archive: body.archive === true,
  })

  if (!watchlist) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Watchlist not found or update failed." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
    watchlist,
  })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const watchlist = await updateGrowthSignalWatchlist(access.admin, id?.trim() ?? "", { archive: true })
  if (!watchlist) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Watchlist not found." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
    watchlist,
    message: "Watchlist archived.",
  })
}
