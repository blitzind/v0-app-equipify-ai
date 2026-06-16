import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { getGrowthEngagementAlert, parseEngagementAlertFilters } from "@/lib/growth/engagement/growth-engagement-alert-service"
import { GROWTH_ENGAGEMENT_ALERT_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-alert-types"

export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ alertId: string }> }) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const { alertId: rawAlertId } = await context.params
  const alertId = decodeURIComponent(rawAlertId)
  const filters = parseEngagementAlertFilters(access.organizationId, new URL(request.url).searchParams)

  try {
    const payload = await getGrowthEngagementAlert(access.admin, alertId, filters)
    if (!payload) {
      return NextResponse.json({ ok: false, error: "alert_not_found", message: "Unknown alert." }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ...payload, qa_marker: GROWTH_ENGAGEMENT_ALERT_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load engagement alert."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
