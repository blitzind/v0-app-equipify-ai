import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { dismissDeliverabilityRecommendation } from "@/lib/growth/deliverability-ops/dashboard"
import { isGrowthDeliverabilityOpsSchemaReady } from "@/lib/growth/deliverability-ops/schema-health"
import { GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE } from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  humanApprovalConfirmed: z.boolean().optional(),
  reason: z.string().max(500).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDeliverabilityOpsSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid dismiss payload." }, { status: 400 })
  }
  if (parsed.data.humanApprovalConfirmed !== true) {
    return NextResponse.json(
      { error: "human_approval_required", message: "Human confirmation required to dismiss recommendation." },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const recommendation = await dismissDeliverabilityRecommendation(access.admin, {
      recommendationId: id,
      actorUserId: access.userId,
      reason: parsed.data.reason,
    })
    return NextResponse.json({
      ok: true,
      recommendation,
      privacy_note: GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE,
      message: "Recommendation dismissed — no automatic changes applied.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not dismiss recommendation."
    const status = message === "recommendation_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "dismiss_failed", message }, { status })
  }
}
