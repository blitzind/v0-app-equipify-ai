import { NextResponse } from "next/server"
import { GROWTH_SENDR_ACTIVITY_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import {
  getSendrActivityFeed,
  parseSendrActivityFeedInput,
} from "@/lib/growth/sendr/growth-sendr-activity-feed-service"
import { assertSendrActivityAccess } from "@/lib/growth/sendr/growth-sendr-activity-guardrails"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = parseSendrActivityFeedInput(url.searchParams)

  try {
    const activityAccess = await assertSendrActivityAccess(access.admin, access.organizationId)
    if (!activityAccess.allowed) {
      const status = activityAccess.throttled ? 429 : 503
      return NextResponse.json(
        {
          ok: false,
          message: activityAccess.reason ?? "sendr_activity_unavailable",
          qa_marker: GROWTH_SENDR_ACTIVITY_QA_MARKER,
        },
        { status },
      )
    }

    const feed = await getSendrActivityFeed(access.admin, {
      organizationId: access.organizationId,
      dateRange: parsed.dateRange,
      page: parsed.page,
      pageSize: parsed.pageSize,
    })

    return NextResponse.json({
      ok: true,
      feed,
      qa_marker: GROWTH_SENDR_ACTIVITY_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "sendr_activity_feed_failed",
        qa_marker: GROWTH_SENDR_ACTIVITY_QA_MARKER,
      },
      { status: 500 },
    )
  }
}
