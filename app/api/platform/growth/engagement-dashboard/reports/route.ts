import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { listGrowthEngagementReports } from "@/lib/growth/engagement/growth-engagement-report-service"
import { GROWTH_ENGAGEMENT_REPORT_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-report-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const reports = listGrowthEngagementReports()
  return NextResponse.json({ ok: true, ...reports, qa_marker: GROWTH_ENGAGEMENT_REPORT_QA_MARKER })
}
