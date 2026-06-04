import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import {
  summarizeSmsContextUsed,
  summarizeSmsMemoryUsed,
} from "@/lib/growth/sms/personalization/sms-audit-summaries"
import { buildSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-builder"
import { GROWTH_SMS_PERSONALIZATION_QA_MARKER } from "@/lib/growth/sms/personalization/sms-personalization-audit"
import type {
  GrowthSmsInboxDraftSuggestion,
  SmsMessageType,
} from "@/lib/growth/sms/personalization/sms-personalization-types"

export async function buildSmsInboxDraftSuggestion(
  admin: SupabaseClient,
  input: {
    leadId: string
    draftType?: "outbound" | "reply"
    messageType?: SmsMessageType
  },
): Promise<GrowthSmsInboxDraftSuggestion | null> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return null

  const context = await buildSmsPersonalizationContext(admin, lead)
  const { audit, draft } = buildPersonalizedSmsDraft({
    leadId: lead.id,
    context,
    draftType: input.draftType ?? "reply",
    messageType: input.messageType,
  })

  return {
    qa_marker: GROWTH_SMS_PERSONALIZATION_QA_MARKER,
    channel: "sms",
    draftType: input.draftType ?? "reply",
    suggestedBody: draft.body,
    charCount: draft.charCount,
    segmentCount: draft.segmentCount,
    humanApprovalRequired: true,
    audit: {
      openingHook: audit.openingHook,
      cta: audit.cta,
      qualityScore: audit.qualityScore,
      contextQuality: audit.contextQuality,
      memoryQuality: audit.memoryQuality,
      confidenceLabel: audit.confidenceLabel,
    },
    contextUsed: summarizeSmsContextUsed(audit),
    memoryUsed: summarizeSmsMemoryUsed(audit),
  }
}
