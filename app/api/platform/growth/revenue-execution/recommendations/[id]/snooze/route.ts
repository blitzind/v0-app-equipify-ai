import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { snoozeOpportunityRecommendation } from "@/lib/growth/revenue-execution/opportunity-review-service"

export const runtime = "nodejs"

const BodySchema = z.object({
  snoozeUntil: z.string().datetime(),
  note: z.string().max(500).optional(),
  humanApprovalConfirmed: z.literal(true),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Human approval and snoozeUntil required." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    await snoozeOpportunityRecommendation(access.admin, {
      recommendationId: id,
      actorUserId: access.userId,
      snoozeUntil: parsed.data.snoozeUntil,
      note: parsed.data.note,
    })
    return NextResponse.json({ ok: true, message: "Recommendation snoozed — no autonomous action taken." })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Snooze failed."
    const status = message === "recommendation_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "snooze_failed", message }, { status })
  }
}
