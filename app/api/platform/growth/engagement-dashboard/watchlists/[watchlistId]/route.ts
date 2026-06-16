import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { listGrowthEngagementAlerts, parseEngagementAlertFilters } from "@/lib/growth/engagement/growth-engagement-alert-service"
import { getGrowthEngagementWatchlist } from "@/lib/growth/engagement/growth-engagement-watchlist-service"
import { GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-watchlist-types"

export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ watchlistId: string }> }) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const { watchlistId } = await context.params
  const filters = parseEngagementAlertFilters(access.organizationId, new URL(request.url).searchParams)

  try {
    const alerts = await listGrowthEngagementAlerts(access.admin, {
      ...filters,
      watchlistId,
      limit: filters.limit,
    })
    const payload = await getGrowthEngagementWatchlist(watchlistId, alerts.total, alerts.sourceAvailability)
    if (!payload) {
      return NextResponse.json({ ok: false, error: "watchlist_not_found", message: "Unknown watchlist." }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ...payload, qa_marker: GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load engagement watchlist."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
