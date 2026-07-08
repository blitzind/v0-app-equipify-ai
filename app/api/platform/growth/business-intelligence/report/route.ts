import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER,
  type GrowthBusinessIntelligenceReportApiResponse,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import { fetchBusinessIntelligenceReportReadModel } from "@/lib/growth/business-intelligence/business-intelligence-report-read-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseIncludeAiRecommendations(request: Request): boolean {
  const url = new URL(request.url)
  return url.searchParams.get("includeAiRecommendations") === "true"
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER,
        message: "Growth Engine AI organization is not configured for this deployment.",
      } satisfies GrowthBusinessIntelligenceReportApiResponse,
      { status: 503 },
    )
  }

  try {
    const includeAiRecommendations = parseIncludeAiRecommendations(request)
    const readModel = await fetchBusinessIntelligenceReportReadModel(access.admin, {
      organizationId,
      includeAiRecommendations,
    })

    const response: GrowthBusinessIntelligenceReportApiResponse = {
      ok: true,
      qa_marker: GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER,
      schemaReady: readModel.schemaReady,
      empty_state: readModel.empty_state,
      message: readModel.message,
      payload: readModel.payload ?? undefined,
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Business Intelligence report."
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_UI_QA_MARKER,
        message,
      } satisfies GrowthBusinessIntelligenceReportApiResponse,
      { status: 500 },
    )
  }
}
