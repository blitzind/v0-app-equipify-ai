import { NextResponse } from "next/server"
import { GROWTH_SENDR_ANALYTICS_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import {
  getSendrAnalyticsPages,
  parseSendrAnalyticsPagesInput,
} from "@/lib/growth/sendr/growth-sendr-analytics-pages-service"
import { assertSendrAnalyticsAccess } from "@/lib/growth/sendr/growth-sendr-analytics-guardrails"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = parseSendrAnalyticsPagesInput(url.searchParams)

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

    const pages = await getSendrAnalyticsPages(access.admin, {
      organizationId: access.organizationId,
      dateRange: parsed.dateRange,
      sort: parsed.sort,
      page: parsed.page,
      pageSize: parsed.pageSize,
    })

    return NextResponse.json({
      ok: true,
      pages,
      qa_marker: GROWTH_SENDR_ANALYTICS_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "sendr_pages_load_failed",
        qa_marker: GROWTH_SENDR_ANALYTICS_QA_MARKER,
      },
      { status: 500 },
    )
  }
}
