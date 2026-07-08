import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER,
  type GrowthBusinessIntelligenceResearchApiResponse,
  type GrowthBusinessIntelligenceResearchRequest,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import { runBusinessIntelligenceOperatorResearch } from "@/lib/growth/business-intelligence/business-intelligence-research-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parseResearchRequest(body: unknown): GrowthBusinessIntelligenceResearchRequest {
  if (!body || typeof body !== "object") return {}
  const record = body as Record<string, unknown>
  return {
    forceRefresh: record.forceRefresh === true,
    websiteUrl: typeof record.websiteUrl === "string" ? record.websiteUrl : null,
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER,
        message: "Growth Engine AI organization is not configured for this deployment.",
      } satisfies GrowthBusinessIntelligenceResearchApiResponse,
      { status: 503 },
    )
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const researchRequest = parseResearchRequest(body)

  try {
    const result = await runBusinessIntelligenceOperatorResearch(access.admin, {
      organizationId,
      forceRefresh: researchRequest.forceRefresh,
      websiteUrl: researchRequest.websiteUrl,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          qa_marker: GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER,
          message: result.message,
        } satisfies GrowthBusinessIntelligenceResearchApiResponse,
        { status: 422 },
      )
    }

    const response: GrowthBusinessIntelligenceResearchApiResponse = {
      ok: true,
      qa_marker: GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER,
      cached: result.cached,
      recently_researched: result.cached,
      payload: result.payload,
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not research your company."
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_RESEARCH_QA_MARKER,
        message,
      } satisfies GrowthBusinessIntelligenceResearchApiResponse,
      { status: 500 },
    )
  }
}
