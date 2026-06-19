import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthSequenceVoiceDropSendPayload } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { fetchGrowthSequenceEnrollmentById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import { evaluateVoiceDropTwilioQueueGate } from "@/lib/voice/voice-drops/twilio-voice-drop-gates"
import { renderPersonalizedMessage } from "@/lib/voice/voice-drops/personalization"
import { getVoiceDropCampaign } from "@/lib/voice/repository/voice-drop-repository"
import { isComplianceOrchestrationEnabled } from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { isVoiceDropEnabled } from "@/lib/voice/voice-drops/provider-types"
import { VOICE_DROP_APPROVAL_REQUIRED } from "@/lib/voice/voice-drops/types"
import {
  applySequenceVideoAttachmentToVoiceDropMessage,
  wireApprovedSequenceVideoAttachment,
} from "@/lib/growth/sequences/growth-sequence-video-send-builder-service"

export type SequenceVoiceDropPreflightCode =
  | "step_not_found"
  | "unsupported_channel"
  | "lead_not_found"
  | "missing_organization"
  | "missing_recipient_phone"
  | "voice_drop_campaign_required"
  | "voice_drop_campaign_not_found"
  | "VOICE_DROP_APPROVAL_REQUIRED"
  | "voice_drop_campaign_not_approved"
  | "voice_drop_campaign_not_executable"
  | "VOICE_DROP_ENABLED"
  | "VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED"
  | "voice_drop_compliance_required"
  | string

export async function buildSequenceExecutionVoiceDropPayload(
  admin: SupabaseClient,
  input: {
    sequenceStepId: string
    leadId: string
    sequenceEnrollmentId?: string | null
    voiceDropCampaignId?: string | null
  },
): Promise<GrowthSequenceVoiceDropSendPayload | { error: SequenceVoiceDropPreflightCode; message?: string }> {
  const [step, lead] = await Promise.all([
    fetchGrowthSequenceEnrollmentStepById(admin, input.sequenceStepId),
    fetchGrowthLeadById(admin, input.leadId),
  ])

  if (!step) return { error: "step_not_found" }
  if (step.channel !== "voice_drop") return { error: "unsupported_channel" }
  if (!lead) return { error: "lead_not_found" }

  const organizationId = lead.promotedOrganizationId
  if (!organizationId) return { error: "missing_organization" }

  const toE164 = normalizeToE164(lead.contactPhone)
  if (!toE164) return { error: "missing_recipient_phone" }

  const campaignId = input.voiceDropCampaignId ?? step.voiceDropCampaignId ?? jobCampaignIdFromInstructions(step.instructions)
  if (!campaignId) return { error: "voice_drop_campaign_required" }

  const campaign = await getVoiceDropCampaign(admin, organizationId, campaignId)
  if (!campaign) return { error: "voice_drop_campaign_not_found" }

  if (VOICE_DROP_APPROVAL_REQUIRED && campaign.approvalStatus !== "approved") {
    return {
      error: "VOICE_DROP_APPROVAL_REQUIRED",
      message: "Voice drop campaign must be approved before sequence execution.",
    }
  }

  if (campaign.status !== "approved" && campaign.status !== "scheduled" && campaign.status !== "running") {
    return {
      error: "voice_drop_campaign_not_executable",
      message: `Campaign status ${campaign.status} is not executable.`,
    }
  }

  const rendered = renderPersonalizedMessage(campaign.messageTemplate, {
    first_name: lead.contactName?.split(/\s+/)[0] ?? "there",
    company_name: lead.companyName ?? "your company",
    assigned_rep: "Equipify",
    service_type: "equipment service",
    callback_number: "",
    appointment_window: "",
    last_interaction_summary: step.instructions?.trim() ?? "",
  }).rendered

  const videoWire = await wireApprovedSequenceVideoAttachment(admin, {
    organizationId,
    sequencePatternStepId: step.sequencePatternStepId,
    channel: "voice_drop",
    leadId: lead.id,
    enrollmentStepId: step.id,
  })

  const renderedMessage = videoWire
    ? applySequenceVideoAttachmentToVoiceDropMessage(rendered, videoWire)
    : rendered

  return {
    leadId: lead.id,
    organizationId,
    toE164,
    voiceDropCampaignId: campaign.id,
    campaignName: campaign.name,
    renderedMessage,
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? step.enrollmentId,
    sequenceStepId: step.id,
    videoAttachmentSummary: videoWire?.channelPreview.voiceDropSummary ?? null,
    sequenceVideoAttachment: videoWire?.attribution ?? null,
  }
}

export async function evaluateSequenceVoiceDropExecutionPreflight(
  admin: SupabaseClient,
  input: {
    sequenceEnrollmentId: string
    leadId: string
  },
): Promise<{ allowed: true } | { allowed: false; code: SequenceVoiceDropPreflightCode; message: string }> {
  const [enrollment, lead] = await Promise.all([
    fetchGrowthSequenceEnrollmentById(admin, input.sequenceEnrollmentId),
    fetchGrowthLeadById(admin, input.leadId),
  ])

  if (!enrollment || enrollment.status !== "active") {
    return { allowed: false, code: "enrollment_not_active", message: "Sequence enrollment must be active." }
  }
  if (!lead || lead.status === "disqualified" || lead.status === "archived") {
    return { allowed: false, code: "lead_not_active", message: "Lead must be active for voice drop execution." }
  }
  if (!isVoiceDropEnabled()) {
    return {
      allowed: false,
      code: "VOICE_DROP_ENABLED",
      message: "Set VOICE_DROP_ENABLED=true to execute voice drop sequence steps.",
    }
  }
  if (!isComplianceOrchestrationEnabled()) {
    return {
      allowed: false,
      code: "voice_drop_compliance_required",
      message: "Voice drop compliance orchestration must be enabled.",
    }
  }

  const gate = evaluateVoiceDropTwilioQueueGate()
  if (!gate.allowed) {
    return {
      allowed: false,
      code:
        gate.reason === "twilio_outbound_not_certified"
          ? "VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED"
          : gate.reason === "voice_drop_disabled"
            ? "VOICE_DROP_ENABLED"
            : gate.reason,
      message: gate.message,
    }
  }

  return { allowed: true }
}

function jobCampaignIdFromInstructions(instructions: string | null): string | null {
  if (!instructions?.trim()) return null
  const match = instructions.match(/^voice_drop_campaign:([0-9a-f-]{36})/i)
  return match?.[1] ?? null
}
