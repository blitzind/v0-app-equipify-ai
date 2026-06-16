import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import {
  getGrowthEngagementTimeline,
  parseEngagementTimelineFilters,
} from "@/lib/growth/engagement/growth-engagement-timeline-service"
import { GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-timeline-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const filters = parseEngagementTimelineFilters(access.organizationId, new URL(request.url).searchParams)

  try {
    const timeline = await getGrowthEngagementTimeline(access.admin, filters)
    return NextResponse.json({ ok: true, timeline, qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load engagement timeline."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
