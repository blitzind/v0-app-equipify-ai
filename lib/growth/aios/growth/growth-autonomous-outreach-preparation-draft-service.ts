/** GE-AIOS-GROWTH-5F — Draft-only outreach preparation orchestrator (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCadenceLinkedInDraft,
  buildCadenceSuggestedSmsText,
  buildCadenceTaskInstructions,
} from "@/lib/growth/cadence/cadence-channel-engine"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import {
  resolveOutreachPreparationConfidence,
  summarizePreparedAssetsForPackage,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import {
  requestGrowthCommunicationPlan,
  resolveCommunicationPlanRecommendedChannel,
} from "@/lib/growth/aios/communication/growth-communication-engine-service"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { runOutreachPersonalizationGeneration } from "@/lib/growth/outreach/personalization/run-outreach-personalization"
import { runSmsPersonalizationForLead } from "@/lib/growth/sms/personalization/run-sms-personalization"
import { previewSendrPersonalization } from "@/lib/growth/sendr/growth-sendr-personalization-preview-service"

const SYSTEM_OPERATOR_USER_ID = "growth-autonomous-outreach-preparation-pilot"

export async function buildAutonomousOutreachApprovalPackage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyName: string | null
    snapshot: GrowthLeadResearchWorkflowSnapshot
    generatedAt: string
  },
): Promise<GrowthAutonomousOutreachApprovalPackage> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    throw new Error("Lead not found for outreach preparation.")
  }

  const emailDraft = await runOutreachPersonalizationGeneration(admin, {
    lead,
    generationType: "cold_email",
    actingUserId: SYSTEM_OPERATOR_USER_ID,
    aiRefinementEnabled: false,
  })

  const smsDraft = await runSmsPersonalizationForLead(admin, lead, {
    messageType: "follow_up",
    draftType: "outbound",
  })

  const linkedInDraft = buildCadenceLinkedInDraft({
    companyName: lead.companyName ?? input.companyName ?? "the account",
    contactName: lead.contactName,
  })

  const callTalkingPoints = buildCadenceTaskInstructions({
    channel: "manual_call",
    companyName: lead.companyName ?? input.companyName ?? "the account",
    contactName: lead.contactName,
  })

  const sendrPreview = await previewSendrPersonalization(admin, {
    leadId: input.leadId,
    sampleTemplates: {
      hero: "Hi {{first_name}} — tailored for {{company_name}}",
      cta: "See how {{company_name}} can streamline operations",
    },
  })

  const sendrRecommendation =
    sendrPreview.missing.length > 0
      ? `SENDR personalization preview ready with ${sendrPreview.missing.length} missing variable(s) — review before publish.`
      : `SENDR personalization preview resolved ${Object.keys(sendrPreview.resolved).length} variables — draft-only recommendation.`

  const followUpRecommendation =
    input.snapshot.nextBestAction?.action ??
    input.snapshot.executionPlan?.nextBestAction ??
    "Schedule human-reviewed follow-up after approval package review."

  const confidence = resolveOutreachPreparationConfidence(input.snapshot)
  const evidence = input.snapshot.evidenceSummary?.verifiedEvidence ?? []
  const personalizationEvidence = [
    ...emailDraft.audit.warnings.slice(0, 3).map((warning) => warning.message ?? String(warning)),
    ...smsDraft.audit.warnings.slice(0, 2).map((warning) => warning.message ?? String(warning)),
    `Email strategy: ${emailDraft.audit.strategyVersion ?? "deterministic"}`,
  ]

  const generatedAssets = summarizePreparedAssetsForPackage({
    emailSubject: emailDraft.subject,
    emailBody: emailDraft.content,
    smsBody: smsDraft.draft.body,
    linkedInDraft,
    callTalkingPoints,
    sendrRecommendation,
    followUpRecommendation,
  })

  const packageId = `outreach-prep:${input.leadId}:${input.generatedAt}`

  const communicationPlan = requestGrowthCommunicationPlan({
    organizationId: input.organizationId,
    subject: { type: "lead", id: input.leadId },
    goal: "qualify",
    context: {
      emailReady: true,
      smsReady: true,
      senderReady: true,
      engagementScore: confidence,
      metaRecommendationType:
        input.snapshot.nextBestAction?.action?.includes("sms") ? "sms" : "email",
    },
    generatedAt: input.generatedAt,
  })

  return {
    packageId,
    leadId: input.leadId,
    companyName: lead.companyName ?? input.companyName,
    preparedAt: input.generatedAt,
    generatedAssets,
    personalizationEvidence,
    supportingResearch: evidence.slice(0, 6),
    confidence,
    approvalRequirements: [
      "operator_outbound_approval",
      "human_send_gate",
      "channel_prepare_review",
    ],
    complianceNotes: [
      "Draft-only — no transport execution in GE-AIOS-GROWTH-5F.",
      "LinkedIn and SMS require manual send from operator workspace.",
      "SENDR enrollment blocked until explicit human approval.",
      `Communication plan ${communicationPlan.id} — read-only channel strategy.`,
    ],
    recommendedChannel: resolveCommunicationPlanRecommendedChannel(communicationPlan),
    recommendedSequence: input.snapshot.executionPlan?.estimatedSteps?.[0]?.label ?? "email_first_multichannel",
    expectedOutcome:
      input.snapshot.executionPlan?.expectedOutcome ??
      "Human-approved outreach after draft review.",
    pendingHumanApproval: true,
    transportBlocked: true,
  }
}

export const AUTONOMOUS_OUTREACH_PREPARATION_WORKFLOW =
  GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW
