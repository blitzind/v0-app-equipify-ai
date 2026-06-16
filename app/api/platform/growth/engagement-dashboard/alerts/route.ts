import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { listGrowthEngagementAlerts, parseEngagementAlertFilters } from "@/lib/growth/engagement/growth-engagement-alert-service"
import { GROWTH_ENGAGEMENT_ALERT_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-alert-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const filters = parseEngagementAlertFilters(access.organizationId, new URL(request.url).searchParams)

  try {
    const payload = await listGrowthEngagementAlerts(access.admin, filters)
    return NextResponse.json({ ok: true, ...payload, qa_marker: GROWTH_ENGAGEMENT_ALERT_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load engagement alerts."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
