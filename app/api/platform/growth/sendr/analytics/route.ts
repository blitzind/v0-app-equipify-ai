import { NextResponse } from "next/server"
import { GROWTH_SENDR_ANALYTICS_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import {
  getSendrAnalyticsWorkspaceSummary,
  parseSendrAnalyticsWorkspaceInput,
} from "@/lib/growth/sendr/growth-sendr-analytics-service"
import { assertSendrAnalyticsAccess } from "@/lib/growth/sendr/growth-sendr-analytics-guardrails"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const dateRange = parseSendrAnalyticsWorkspaceInput(url.searchParams)

  try {
    const analyticsAccess = await assertSendrAnalyticsAccess(access.admin, access.organizationId)
    if (!analyticsAccess.allowed) {
      const status = analyticsAccess.throttled ? 429 : 503
      return NextResponse.json(
        {
          ok: false,
          message: analyticsAccess.reason ?? "sendr_analytics_unavailable",
          qa_marker: GROWTH_SENDR_ANALYTICS_QA_MARKER,
        },
        { status },
      )
    }

    const summary = await getSendrAnalyticsWorkspaceSummary(access.admin, {
      organizationId: access.organizationId,
      dateRange,
    })

    return NextResponse.json({
      ok: true,
      summary,
      qa_marker: GROWTH_SENDR_ANALYTICS_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "sendr_analytics_load_failed",
        qa_marker: GROWTH_SENDR_ANALYTICS_QA_MARKER,
      },
      { status: 500 },
    )
  }
}
