import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { getPersonalizationGenerationView } from "@/lib/growth/personalization/dashboard"
import {
  computeAttributionScore,
  recordPersonalizationPerformanceSnapshot,
} from "@/lib/growth/personalization/personalization-attribution"
import { recordPersonalizationFeedback } from "@/lib/growth/personalization/personalization-feedback"
import { appendPersonalizationTimelineEvent } from "@/lib/growth/personalization/personalization-events"
import { isGrowthAiPersonalizationSchemaReady } from "@/lib/growth/personalization/schema-health"
import {
  GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
  GROWTH_PERSONALIZATION_FEEDBACK_TYPES,
} from "@/lib/growth/personalization/personalization-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  feedbackType: z.enum(GROWTH_PERSONALIZATION_FEEDBACK_TYPES),
  notes: z.string().max(500).optional(),
})

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

    await recordPersonalizationFeedback(access.admin, {
      generationId: id,
      leadId: generation.leadId,
      feedbackType: parsed.data.feedbackType,
      notes: parsed.data.notes,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })

    if (parsed.data.feedbackType === "performed_well" || parsed.data.feedbackType === "performed_poorly") {
      await recordPersonalizationPerformanceSnapshot(access.admin, {
        generationId: id,
        leadId: generation.leadId,
        sourceType: generation.sourceSummary[0] ?? "relationship_memory",
        attributionScore: computeAttributionScore({
          evidenceCoverageScore: generation.evidenceCoverageScore,
          personalizationScore: generation.personalizationScore,
          performedWell: parsed.data.feedbackType === "performed_well",
        }),
      })
    }

    await appendPersonalizationTimelineEvent(access.admin, {
      eventType: "personalization_feedback_recorded",
      title: "Personalization feedback recorded",
      summary: generation.leadLabel,
      leadId: generation.leadId,
      metadata: { generation_id: id, feedback_type: parsed.data.feedbackType },
    })

    return NextResponse.json({
      ok: true,
      privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
      message: "Feedback recorded.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "feedback_failed", message }, { status: 500 })
  }
}
