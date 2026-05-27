import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { completeDeliverabilityRecommendation } from "@/lib/growth/deliverability-ops/dashboard"
import { isGrowthDeliverabilityOpsSchemaReady } from "@/lib/growth/deliverability-ops/schema-health"
import { GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE } from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  humanApprovalConfirmed: z.boolean().optional(),
  note: z.string().max(500).optional(),
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
    return NextResponse.json({ error: "invalid_body", message: "Invalid complete payload." }, { status: 400 })
  }
  if (parsed.data.humanApprovalConfirmed !== true) {
    return NextResponse.json(
      { error: "human_approval_required", message: "Human confirmation required to record completion." },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const recommendation = await completeDeliverabilityRecommendation(access.admin, {
      recommendationId: id,
      actorUserId: access.userId,
      note: parsed.data.note,
    })
    return NextResponse.json({
      ok: true,
      recommendation,
      privacy_note: GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE,
      message: "Completion recorded — confirms manual remediation was applied.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not complete recommendation."
    const status = message === "recommendation_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "complete_failed", message }, { status })
  }
}
