import { NextResponse } from "next/server"
import { GROWTH_SENDR_ANALYTICS_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import {
  getSendrAnalyticsLaunches,
  parseSendrAnalyticsLaunchesInput,
} from "@/lib/growth/sendr/growth-sendr-analytics-launches-service"
import { assertSendrAnalyticsAccess } from "@/lib/growth/sendr/growth-sendr-analytics-guardrails"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = parseSendrAnalyticsLaunchesInput(url.searchParams)

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

    const launches = await getSendrAnalyticsLaunches(access.admin, {
      organizationId: access.organizationId,
      dateRange: parsed.dateRange,
      page: parsed.page,
      pageSize: parsed.pageSize,
      attentionOnly: parsed.attentionOnly,
    })

    return NextResponse.json({
      ok: true,
      launches,
      qa_marker: GROWTH_SENDR_ANALYTICS_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "sendr_launches_load_failed",
        qa_marker: GROWTH_SENDR_ANALYTICS_QA_MARKER,
      },
      { status: 500 },
    )
  }
}
