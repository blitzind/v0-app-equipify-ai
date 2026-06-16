import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import {
  getGrowthEngagementReport,
  parseEngagementReportFilters,
  parseEngagementReportType,
} from "@/lib/growth/engagement/growth-engagement-report-service"
import { GROWTH_ENGAGEMENT_REPORT_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-report-types"

export const runtime = "nodejs"

export async function GET(request: Request, context: { params: Promise<{ reportType: string }> }) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const { reportType: rawType } = await context.params
  const reportType = parseEngagementReportType(rawType)
  if (!reportType) {
    return NextResponse.json({ ok: false, error: "invalid_report_type", message: "Unknown report type." }, { status: 400 })
  }

  const filters = parseEngagementReportFilters(access.organizationId, new URL(request.url).searchParams)

  try {
    const payload = await getGrowthEngagementReport(access.admin, reportType, filters)
    return NextResponse.json({ ok: true, ...payload, qa_marker: GROWTH_ENGAGEMENT_REPORT_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load engagement report."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
