import { NextResponse } from "next/server"
import { GROWTH_SENDR_ACTIVITY_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { assertSendrActivityAccess } from "@/lib/growth/sendr/growth-sendr-activity-guardrails"
import {
  getSendrActivityWorkspaceSummary,
  parseSendrActivityWorkspaceInput,
} from "@/lib/growth/sendr/growth-sendr-activity-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const dateRange = parseSendrActivityWorkspaceInput(url.searchParams)

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

    const summary = await getSendrActivityWorkspaceSummary(access.admin, {
      organizationId: access.organizationId,
      dateRange,
    })

    return NextResponse.json({
      ok: true,
      summary,
      qa_marker: GROWTH_SENDR_ACTIVITY_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "sendr_activity_load_failed",
        qa_marker: GROWTH_SENDR_ACTIVITY_QA_MARKER,
      },
      { status: 500 },
    )
  }
}
