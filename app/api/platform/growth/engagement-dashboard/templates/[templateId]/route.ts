import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import {
  getGrowthEngagementTemplateDrilldown,
  parseEngagementTimelineFilters,
} from "@/lib/growth/engagement/growth-engagement-timeline-service"
import { GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-timeline-types"

export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const { templateId } = await context.params
  const filters = parseEngagementTimelineFilters(access.organizationId, new URL(request.url).searchParams)

  try {
    const drilldown = await getGrowthEngagementTemplateDrilldown(access.admin, templateId, filters)
    if (!drilldown) {
      return NextResponse.json({ ok: false, error: "not_found", message: "Template drilldown not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, drilldown, qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load template drilldown."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
