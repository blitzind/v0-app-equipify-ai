import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import { projectSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-projection"
import { buildOutreachContextPacket } from "@/lib/growth/outreach/personalization/context-packet-builder"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import type { GrowthSequenceSmsSendPayload } from "@/lib/growth/sequences/execution/sequence-execution-types"

export async function buildSequenceExecutionSmsPayload(
  admin: SupabaseClient,
  input: {
    sequenceStepId: string
    leadId: string
    sequenceEnrollmentId?: string | null
  },
): Promise<GrowthSequenceSmsSendPayload | { error: string }> {
  const [step, lead] = await Promise.all([
    fetchGrowthSequenceEnrollmentStepById(admin, input.sequenceStepId),
    fetchGrowthLeadById(admin, input.leadId),
  ])

  if (!step) return { error: "step_not_found" }
  if (step.channel !== "sms") return { error: "unsupported_channel" }
  if (!lead) return { error: "lead_not_found" }

  const toE164 = normalizeToE164(lead.contactPhone)
  if (!toE164) return { error: "missing_recipient_phone" }

  let body = step.instructions?.trim() ?? ""
  if (!body) {
    const packet = await buildOutreachContextPacket(admin, lead)
    const context = projectSmsPersonalizationContext({ packet })
    const { draft } = buildPersonalizedSmsDraft({
      leadId: lead.id,
      context,
      draftType: "outbound",
    })
    body = draft.body
  }

  if (!body.trim()) return { error: "missing_sms_body" }

  return {
    leadId: lead.id,
    toE164,
    body: body.trim(),
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? step.enrollmentId,
    sequenceStepId: step.id,
  }
}
