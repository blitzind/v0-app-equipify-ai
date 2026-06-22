import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import { getGrowthUnifiedEngagementFeed } from "@/lib/growth/engagement/growth-unified-engagement-read-service"
import { GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER } from "@/lib/growth/engagement/growth-unified-engagement-read-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId() ?? access.organizationId
  const url = new URL(request.url)
  const dateRange = url.searchParams.get("dateRange")
  const limitRaw = url.searchParams.get("limit")
  const limit = limitRaw ? Number(limitRaw) : undefined

  try {
    const feed = await getGrowthUnifiedEngagementFeed(access.admin, {
      organizationId,
      dateRangePreset: dateRange,
      limit,
    })
    return NextResponse.json({ ok: true, feed, qa_marker: GE_V1_2_UNIFIED_ENGAGEMENT_READ_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load unified engagement feed."
    return NextResponse.json({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
