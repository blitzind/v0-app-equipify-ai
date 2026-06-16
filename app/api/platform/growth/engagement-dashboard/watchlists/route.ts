import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { listGrowthEngagementWatchlists } from "@/lib/growth/engagement/growth-engagement-watchlist-service"
import { GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-watchlist-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const payload = listGrowthEngagementWatchlists()
  return NextResponse.json({ ok: true, ...payload, qa_marker: GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER })
}
