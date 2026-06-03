import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { dismissOpportunityRecommendation } from "@/lib/growth/opportunity-intelligence/crm-intelligence"
import { isGrowthOpportunityIntelligenceSchemaReady } from "@/lib/growth/opportunity-intelligence/schema-health"

export const runtime = "nodejs"

const BodySchema = z.object({
  reason: z.string().max(500).optional(),
  note: z.string().max(500).optional(),
  humanApprovalConfirmed: z.literal(true),
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
    return NextResponse.json(
      { error: "invalid_body", message: "Human approval confirmation required." },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const recommendation = await dismissOpportunityRecommendation(access.admin, {
      recommendationId: id,
      actorUserId: access.userId,
      reason: parsed.data.reason ?? parsed.data.note,
    })
    return NextResponse.json({
      ok: true,
      recommendation,
      message: "Recommendation rejected — no autonomous action taken.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not dismiss recommendation."
    const status = message === "recommendation_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "dismiss_failed", message }, { status })
  }
}
