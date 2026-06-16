import { NextResponse } from "next/server"
import { z } from "zod"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaAiQaError } from "@/lib/growth/media/media-ai-qa-route-utils"
import { createQaSession, toGrowthMediaAiQaResponse } from "@/lib/growth/media/media-ai-qa-service"
import {
  GROWTH_MEDIA_AI_QA_QA_MARKER,
  GROWTH_MEDIA_AI_QA_SAFETY_FLAGS,
} from "@/lib/growth/media/media-ai-qa-types"
import { GROWTH_MEDIA_AI_QA_KNOWLEDGE_SOURCE_TYPES } from "@/lib/growth/media/media-ai-qa-knowledge-types"

export const runtime = "nodejs"

const KnowledgeSourceRefSchema = z.object({
  source_type: z.enum(GROWTH_MEDIA_AI_QA_KNOWLEDGE_SOURCE_TYPES),
  source_id: z.string().max(120).nullable().optional(),
  label: z.string().max(200).nullable().optional(),
  enabled: z.boolean().optional(),
})

const CreateQaSchema = z.object({
  policy_id: z.string().min(1).max(120).nullable().optional(),
  question_template: z.string().min(1).max(8000),
  fallback_response: z.string().max(4000).nullable().optional(),
  knowledge_source_refs: z.array(KnowledgeSourceRefSchema).optional(),
  booking_handoff_enabled: z.boolean().optional(),
  qualification_goal: z.string().max(120).nullable().optional(),
  personalization_context: z
    .object({
      prospect_name: z.string().max(500).nullable().optional(),
      company_name: z.string().max(500).nullable().optional(),
      sender_name: z.string().max(500).nullable().optional(),
      sender_company: z.string().max(500).nullable().optional(),
      qualification_goal: z.string().max(120).nullable().optional(),
      custom_merge_values: z.record(z.string()).optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateQaSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const record = createQaSession({
      organizationId: access.organizationId,
      policyId: parsed.data.policy_id ?? null,
      questionTemplate: parsed.data.question_template,
      fallbackResponse: parsed.data.fallback_response ?? null,
      knowledgeSourceRefs: (parsed.data.knowledge_source_refs ?? []).map((ref) => ({
        sourceType: ref.source_type,
        sourceId: ref.source_id ?? null,
        label: ref.label ?? null,
        enabled: ref.enabled,
      })),
      bookingHandoffEnabled: parsed.data.booking_handoff_enabled,
      qualificationGoal: parsed.data.qualification_goal ?? null,
      personalizationContext: parsed.data.personalization_context
        ? {
            prospectName: parsed.data.personalization_context.prospect_name ?? null,
            companyName: parsed.data.personalization_context.company_name ?? null,
            senderName: parsed.data.personalization_context.sender_name ?? null,
            senderCompany: parsed.data.personalization_context.sender_company ?? null,
            qualificationGoal: parsed.data.personalization_context.qualification_goal ?? null,
            customMergeValues: parsed.data.personalization_context.custom_merge_values ?? {},
          }
        : {},
    })

    return NextResponse.json({
      ...toGrowthMediaAiQaResponse(record),
      qa_marker: GROWTH_MEDIA_AI_QA_QA_MARKER,
      ...GROWTH_MEDIA_AI_QA_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaAiQaError(error)
  }
}
