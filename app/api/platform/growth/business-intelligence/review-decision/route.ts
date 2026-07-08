import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
  type GrowthBusinessIntelligenceReviewDecisionApiResponse,
} from "@/lib/growth/business-intelligence/business-intelligence-api-contract"
import { saveBusinessIntelligenceReviewDecision } from "@/lib/growth/business-intelligence/business-intelligence-review-service"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const BodySchema = z.object({
  fieldKey: z.string().min(3).max(120),
  decision: z.enum([
    "approved",
    "edited",
    "dismissed",
    "marked_unknown",
    "needs_more_info",
  ]),
  approvedValue: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
})

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
      } satisfies GrowthBusinessIntelligenceReviewDecisionApiResponse,
      { status: 503 },
    )
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
        message: "Invalid review decision payload.",
      } satisfies GrowthBusinessIntelligenceReviewDecisionApiResponse,
      { status: 400 },
    )
  }

  try {
    const result = await saveBusinessIntelligenceReviewDecision(access.admin, {
      organizationId,
      fieldKey: parsed.data.fieldKey,
      decision: parsed.data.decision,
      approvedValue: parsed.data.approvedValue,
      decidedBy: access.userId,
    })

    const response: GrowthBusinessIntelligenceReviewDecisionApiResponse = {
      ok: true,
      qa_marker: GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
      decision: {
        field_key: result.decision.field_key,
        decision: result.decision.decision,
        approved_value_json: result.decision.approved_value_json,
        decided_at: result.decision.decided_at,
      },
      review_progress: result.progress,
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save review decision."
    return NextResponse.json(
      {
        ok: false,
        qa_marker: GROWTH_BUSINESS_INTELLIGENCE_REVIEW_QA_MARKER,
        message,
      } satisfies GrowthBusinessIntelligenceReviewDecisionApiResponse,
      { status: 422 },
    )
  }
}
