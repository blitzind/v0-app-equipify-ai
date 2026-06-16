import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import {
  getGrowthEngagementReportCsv,
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
  const accept = request.headers.get("accept") ?? ""

  try {
    const payload = await getGrowthEngagementReportCsv(access.admin, reportType, filters)

    if (accept.includes("text/csv") || new URL(request.url).searchParams.get("format") === "csv") {
      return new NextResponse(payload.csvText, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${payload.csv.filename}"`,
          "X-Engagement-Report-QA-Marker": GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
        },
      })
    }

    return NextResponse.json({ ok: true, ...payload, qa_marker: GROWTH_ENGAGEMENT_REPORT_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export engagement report."
    return NextResponse.json({ ok: false, error: "export_failed", message }, { status: 500 })
  }
}
