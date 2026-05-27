import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthEngagementDashboard } from "@/lib/growth/engagement-dashboard-repository"
import { fetchEngagementAttributionDashboard } from "@/lib/growth/tracking/tracking-repository"
import { isGrowthEngagementTrackingSchemaReady } from "@/lib/growth/tracking/tracking-schema-health"
import { GROWTH_ENGAGEMENT_ATTRIBUTION_PRIVACY_NOTE } from "@/lib/growth/tracking/tracking-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const [dashboard, attributionReady] = await Promise.all([
      fetchGrowthEngagementDashboard(access.admin),
      isGrowthEngagementTrackingSchemaReady(access.admin),
    ])

    const attribution = attributionReady
      ? await fetchEngagementAttributionDashboard(access.admin)
      : null

    return NextResponse.json({
      ok: true,
      dashboard,
      attribution,
      privacy_note: GROWTH_ENGAGEMENT_ATTRIBUTION_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
