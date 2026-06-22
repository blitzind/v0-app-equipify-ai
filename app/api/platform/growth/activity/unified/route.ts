import { NextResponse } from "next/server"
import { getGrowthActivityUnifiedFeed } from "@/lib/growth/activity/growth-activity-unified-read-service"
import { GROWTH_ACTIVITY_UNIFIED_FEED_QA_MARKER } from "@/lib/growth/activity/growth-activity-workspace-constants"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const dateRange = url.searchParams.get("dateRange")
  const limitParam = Number(url.searchParams.get("limit") ?? "200")
  const limit = Number.isFinite(limitParam) ? limitParam : 200

  try {
    const feed = await getGrowthActivityUnifiedFeed(access.admin, {
      organizationId: access.organizationId,
      dateRangePreset: dateRange,
      limit,
    })
    return NextResponse.json({ ok: true, ...feed, qa_marker: GROWTH_ACTIVITY_UNIFIED_FEED_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activity feed unavailable"
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
