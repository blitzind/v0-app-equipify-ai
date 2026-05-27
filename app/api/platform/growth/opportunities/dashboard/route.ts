import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthOpportunityDashboard } from "@/lib/growth/opportunity-dashboard-repository"
import { fetchGrowthOpportunityIntelligenceDashboard } from "@/lib/growth/opportunity-intelligence/dashboard"
import { isGrowthOpportunityIntelligenceSchemaReady } from "@/lib/growth/opportunity-intelligence/schema-health"
import { GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE } from "@/lib/growth/opportunity-intelligence/opportunity-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId") ?? undefined

  try {
    const readiness = await fetchGrowthOpportunityDashboard(access.admin)
    const intelligenceReady = await isGrowthOpportunityIntelligenceSchemaReady(access.admin)
    const intelligence = intelligenceReady
      ? await fetchGrowthOpportunityIntelligenceDashboard(access.admin, { leadId: leadId ?? undefined })
      : null

    return NextResponse.json({
      ok: true,
      dashboard: readiness,
      intelligence,
      privacy_note: GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
