import { NextResponse } from "next/server"
import { requireEngagementDashboardPlatformAccess } from "@/lib/growth/engagement/growth-engagement-dashboard-service"
import {
  growthHomeNoStoreJson,
} from "@/lib/growth/home/growth-home-no-store-response"
import {
  getGrowthEngagementCommandCenter,
  parseEngagementCommandCenterFilters,
} from "@/lib/growth/engagement/growth-engagement-command-center-service"
import { GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-command-center-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireEngagementDashboardPlatformAccess()
  if (!access.ok) return access.response

  const filters = parseEngagementCommandCenterFilters(access.organizationId, new URL(request.url).searchParams)

  try {
    const payload = await getGrowthEngagementCommandCenter(access.admin, filters)
    return growthHomeNoStoreJson({ ok: true, ...payload, qa_marker: GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load engagement command center."
    return growthHomeNoStoreJson({ ok: false, error: "fetch_failed", message }, { status: 500 })
  }
}
