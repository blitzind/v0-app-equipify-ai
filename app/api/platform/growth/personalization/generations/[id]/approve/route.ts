import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { approvePersonalizationGeneration } from "@/lib/growth/personalization/dashboard"
import { isGrowthAiPersonalizationSchemaReady } from "@/lib/growth/personalization/schema-health"
import { GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE } from "@/lib/growth/personalization/personalization-types"

export const runtime = "nodejs"

const BodySchema = z.object({ humanApprovalConfirmed: z.boolean().optional() })

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiPersonalizationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success || parsed.data.humanApprovalConfirmed !== true) {
    return NextResponse.json(
      { error: "human_approval_required", message: "Human confirmation required to approve personalization." },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const generation = await approvePersonalizationGeneration(access.admin, {
      generationId: id,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      humanApprovalConfirmed: true,
    })
    return NextResponse.json({
      ok: true,
      generation,
      privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
      message: "Personalization approved — ready for sequence attachment. No autonomous send.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status =
      message === "generation_not_found"
        ? 404
        : message === "personalization_blocked" || message === "invalid_status_for_approval"
          ? 400
          : 500
    return NextResponse.json({ error: "approve_failed", message }, { status })
  }
}
