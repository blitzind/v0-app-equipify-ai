import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { acceptOpportunityRecommendation } from "@/lib/growth/opportunity-intelligence/crm-intelligence"
import { isGrowthOpportunityIntelligenceSchemaReady } from "@/lib/growth/opportunity-intelligence/schema-health"
import { GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE } from "@/lib/growth/opportunity-intelligence/opportunity-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  humanApprovalConfirmed: z.boolean().optional(),
  note: z.string().max(500).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthOpportunityIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid accept payload." }, { status: 400 })
  }
  if (parsed.data.humanApprovalConfirmed !== true) {
    return NextResponse.json(
      { error: "human_approval_required", message: "Human approval confirmation required." },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const recommendation = await acceptOpportunityRecommendation(access.admin, {
      recommendationId: id,
      actorUserId: access.userId,
    })
    return NextResponse.json({
      ok: true,
      recommendation,
      privacy_note: GROWTH_OPPORTUNITY_INTELLIGENCE_PRIVACY_NOTE,
      message: "Acceptance recorded — perform CRM action manually.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not accept recommendation."
    const status = message === "recommendation_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "accept_failed", message }, { status })
  }
}
