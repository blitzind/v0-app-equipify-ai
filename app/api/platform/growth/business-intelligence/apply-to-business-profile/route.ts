import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applyBusinessIntelligenceReviewToBusinessProfileDraft } from "@/lib/growth/business-intelligence/business-intelligence-apply-to-profile-service"
import {
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
  type GrowthBusinessIntelligenceApplyToProfileApiResponse,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
        message: "Growth Engine AI organization is not configured for this deployment.",
      } satisfies GrowthBusinessIntelligenceApplyToProfileApiResponse,
      { status: 503 },
    )
  }

  try {
    await request.json().catch(() => ({}))

    const result = await applyBusinessIntelligenceReviewToBusinessProfileDraft(access.admin, {
      organizationId,
      createdBy: access.userId,
    })

    const response: GrowthBusinessIntelligenceApplyToProfileApiResponse = {
      ok: true,
      qa_marker: GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
      profileId: result.profileId,
      created: result.created,
      message: result.created
        ? "Created a Business Profile draft from your approved review decisions."
        : "Updated the existing Business Profile draft from your approved review decisions.",
    }

    return NextResponse.json(response, {
      status: 201,
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not apply review decisions to Business Profile."
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
        message,
      } satisfies GrowthBusinessIntelligenceApplyToProfileApiResponse,
      { status: 422 },
    )
  }
}
