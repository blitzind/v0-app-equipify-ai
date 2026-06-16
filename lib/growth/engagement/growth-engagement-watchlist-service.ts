import "server-only"

import {
  GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS,
  GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
  GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
  findEngagementWatchlist,
} from "@/lib/growth/engagement/growth-engagement-watchlist-utils"
import type {
  GrowthEngagementWatchlistDetailResponse,
  GrowthEngagementWatchlistsListResponse,
} from "@/lib/growth/engagement/growth-engagement-watchlist-types"

export function listGrowthEngagementWatchlists(): GrowthEngagementWatchlistsListResponse {
  return {
    qa_marker: GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
    watchlists: GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS,
    safety: GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
  }
}

export async function getGrowthEngagementWatchlist(
  watchlistId: string,
  alertCount: number,
  sourceAvailability: GrowthEngagementWatchlistDetailResponse["sourceAvailability"],
): Promise<GrowthEngagementWatchlistDetailResponse | null> {
  const watchlist = findEngagementWatchlist(watchlistId)
  if (!watchlist) return null

  return {
    qa_marker: GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
    watchlist,
    alertCount,
    safety: GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
    sourceAvailability,
  }
}

export { findEngagementWatchlist, GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS }
