import { NextResponse } from "next/server"
import { z } from "zod"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaVoiceGenerationError } from "@/lib/growth/media/media-voice-generation-route-utils"
import {
  createGenerationRequest,
  toGrowthMediaVoiceGenerationResponse,
} from "@/lib/growth/media/media-voice-generation-service"
import {
  GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER,
  GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
} from "@/lib/growth/media/media-voice-generation-types"

export const runtime = "nodejs"

const CreateGenerationSchema = z.object({
  template_asset_id: z.string().uuid().nullable().optional(),
  voice_id: z.string().min(1).max(120).nullable().optional(),
  script_template: z.string().min(1).max(8000),
  personalization_context: z
    .object({
      prospect_name: z.string().max(500).nullable().optional(),
      company_name: z.string().max(500).nullable().optional(),
      sender_name: z.string().max(500).nullable().optional(),
      sender_company: z.string().max(500).nullable().optional(),
      custom_merge_values: z.record(z.string()).optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateGenerationSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const record = createGenerationRequest({
      organizationId: access.organizationId,
      templateAssetId: parsed.data.template_asset_id ?? null,
      voiceId: parsed.data.voice_id ?? null,
      scriptTemplate: parsed.data.script_template,
      personalizationContext: parsed.data.personalization_context
        ? {
            prospectName: parsed.data.personalization_context.prospect_name ?? null,
            companyName: parsed.data.personalization_context.company_name ?? null,
            senderName: parsed.data.personalization_context.sender_name ?? null,
            senderCompany: parsed.data.personalization_context.sender_company ?? null,
            customMergeValues: parsed.data.personalization_context.custom_merge_values ?? {},
          }
        : {},
    })

    return NextResponse.json({
      ...toGrowthMediaVoiceGenerationResponse(record),
      qa_marker: GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER,
      ...GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaVoiceGenerationError(error)
  }
}
