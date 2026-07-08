import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER,
  type GrowthBusinessIntelligenceLeadDiscoveryContextApiResponse,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import { loadBusinessIntelligenceLeadDiscoverySignals } from "@/lib/growth/business-intelligence/business-intelligence-lead-discovery-read-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER,
        message: "Growth Engine AI organization is not configured for this deployment.",
      } satisfies GrowthBusinessIntelligenceLeadDiscoveryContextApiResponse,
      { status: 503 },
    )
  }

  try {
    const signals = await loadBusinessIntelligenceLeadDiscoverySignals(access.admin, organizationId)

    return NextResponse.json(
      {
        ok: true,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER,
        signals,
      } satisfies GrowthBusinessIntelligenceLeadDiscoveryContextApiResponse,
      { headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL } },
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load Business Intelligence lead discovery context."
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_LEAD_DISCOVERY_QA_MARKER,
        message,
      } satisfies GrowthBusinessIntelligenceLeadDiscoveryContextApiResponse,
      { status: 500 },
    )
  }
}
