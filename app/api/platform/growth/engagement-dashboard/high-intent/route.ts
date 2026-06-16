import { NextResponse } from "next/server"
import {
  getGrowthEngagementDashboardHighIntent,
  parseEngagementDashboardFilters,
  requireEngagementDashboardPlatformAccess,
} from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const filters = parseEngagementDashboardFilters(access.organizationId, new URL(request.url).searchParams)

  try {
    const highIntent = await getGrowthEngagementDashboardHighIntent(access.admin, filters)
    return NextResponse.json({ ok: true, highIntent, qa_marker: GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load high-intent engagement signals."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
