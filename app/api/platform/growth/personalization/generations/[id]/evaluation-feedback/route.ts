import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { getPersonalizationGenerationView } from "@/lib/growth/personalization/dashboard"
import { appendPersonalizationTimelineEvent } from "@/lib/growth/personalization/personalization-events"
import { recordPersonalizationOperatorEvaluationFeedback } from "@/lib/growth/personalization/personalization-feedback"
import { isGrowthAiPersonalizationSchemaReady } from "@/lib/growth/personalization/schema-health"
import {
  GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
  GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS,
} from "@/lib/growth/personalization/personalization-types"

export const runtime = "nodejs"

const BodySchema = z.discriminatedUnion("sentiment", [
  z.object({
    sentiment: z.literal("helpful"),
    customNote: z.string().max(500).optional(),
  }),
  z.object({
    sentiment: z.literal("not_helpful"),
    negativeReason: z.enum(GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS),
    customNote: z.string().max(500).optional(),
  }),
])

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiPersonalizationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: parsed.error.message }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const generation = await getPersonalizationGenerationView(access.admin, id)
    if (!generation) {
      return NextResponse.json({ error: "generation_not_found" }, { status: 404 })
    }

    await recordPersonalizationOperatorEvaluationFeedback(access.admin, {
      generationId: id,
      leadId: generation.leadId,
      sentiment: parsed.data.sentiment,
      negativeReason: parsed.data.sentiment === "not_helpful" ? parsed.data.negativeReason : null,
      customNote: parsed.data.customNote,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    await appendPersonalizationTimelineEvent(access.admin, {
      eventType: "personalization_feedback_recorded",
      title: "Personalization evaluation feedback recorded",
      summary: generation.leadLabel,
      leadId: generation.leadId,
      metadata: {
        generation_id: id,
        evaluation_sentiment: parsed.data.sentiment,
        negative_reason:
          parsed.data.sentiment === "not_helpful" ? parsed.data.negativeReason : null,
      },
    })

    return NextResponse.json({
      ok: true,
      privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
      message: "Evaluation feedback recorded.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "evaluation_feedback_failed", message }, { status: 500 })
  }
}
