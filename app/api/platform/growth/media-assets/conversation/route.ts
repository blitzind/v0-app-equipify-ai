import { NextResponse } from "next/server"
import { z } from "zod"
import { requireMediaAssetPlatformAccess } from "@/lib/growth/media/media-asset-platform-access"
import { mapMediaConversationalSessionError } from "@/lib/growth/media/media-conversational-session-route-utils"
import {
  createConversationSession,
  toGrowthMediaConversationalSessionResponse,
} from "@/lib/growth/media/media-conversational-session-service"
import {
  GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER,
  GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
} from "@/lib/growth/media/media-conversational-session-types"

export const runtime = "nodejs"

const CreateConversationSchema = z.object({
  agent_id: z.string().min(1).max(120).nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  share_page_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  qualification_goal: z.string().min(1).max(120).nullable().optional(),
  system_prompt_template: z.string().min(1).max(8000),
  conversation_context: z
    .object({
      prospect_name: z.string().max(500).nullable().optional(),
      company_name: z.string().max(500).nullable().optional(),
      sender_name: z.string().max(500).nullable().optional(),
      sender_company: z.string().max(500).nullable().optional(),
      qualification_goal: z.string().max(120).nullable().optional(),
      system_prompt_template: z.string().max(8000).nullable().optional(),
      custom_merge_values: z.record(z.string()).optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const access = await requireMediaAssetPlatformAccess()
  if (!access.ok) return access.response

  const parsed = CreateConversationSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const record = createConversationSession({
      organizationId: access.organizationId,
      agentId: parsed.data.agent_id ?? null,
      leadId: parsed.data.lead_id ?? null,
      sharePageId: parsed.data.share_page_id ?? null,
      templateId: parsed.data.template_id ?? null,
      qualificationGoal: parsed.data.qualification_goal ?? null,
      systemPromptTemplate: parsed.data.system_prompt_template,
      conversationContext: parsed.data.conversation_context
        ? {
            prospectName: parsed.data.conversation_context.prospect_name ?? null,
            companyName: parsed.data.conversation_context.company_name ?? null,
            senderName: parsed.data.conversation_context.sender_name ?? null,
            senderCompany: parsed.data.conversation_context.sender_company ?? null,
            qualificationGoal: parsed.data.conversation_context.qualification_goal ?? null,
            systemPromptTemplate: parsed.data.conversation_context.system_prompt_template ?? null,
            customMergeValues: parsed.data.conversation_context.custom_merge_values ?? {},
          }
        : {},
    })

    return NextResponse.json({
      ...toGrowthMediaConversationalSessionResponse(record),
      qa_marker: GROWTH_MEDIA_CONVERSATIONAL_SESSION_QA_MARKER,
      ...GROWTH_MEDIA_CONVERSATIONAL_SESSION_SAFETY_FLAGS,
    })
  } catch (error) {
    return mapMediaConversationalSessionError(error)
  }
}
