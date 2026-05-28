import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  applyApprovalTransition,
  canTransitionCampaign,
  type ApprovalTransition,
} from "@/lib/voice/voice-drops/approval-workflow"
import {
  evaluateCommunicationComplianceBatchForOrg,
  evaluateAndAuditCompliance,
  isComplianceOrchestrationEnabled,
} from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { mapComplianceResultToRecipientPatch } from "@/lib/voice/compliance-orchestration/compliance-decision-engine"
import { renderPersonalizedMessage, validateMessageTemplate } from "@/lib/voice/voice-drops/personalization"
import {
  resolveVoiceDropProvider,
} from "@/lib/voice/voice-drops/provider-registry"
import {
  isVoiceDropEnabled,
  resolveVoiceDropProviderMode,
} from "@/lib/voice/voice-drops/provider-types"
import { buildVoiceDropCampaignDashboardSnapshot } from "@/lib/voice/voice-drops/snapshot-builder"
import type {
  VoiceDropCampaignDashboardSnapshot,
  VoiceDropCampaignPublicView,
  VoiceDropComplianceSummary,
  VoiceDropProviderId,
  VoiceDropReadinessSnapshot,
  VoiceDropRecipientPublicView,
} from "@/lib/voice/voice-drops/types"
import {
  VOICE_DROP_FREQUENCY_CAP_DAYS,
  VOICE_DROP_INFRASTRUCTURE_QA_MARKER,
  VOICE_DROP_MAX_RECIPIENTS_PER_CAMPAIGN,
} from "@/lib/voice/voice-drops/types"
import {
  addVoiceDropRecipient,
  appendVoiceDropDeliveryAttempt,
  createVoiceDropCampaign,
  getVoiceDropCampaign,
  listVoiceDropCampaigns,
  listVoiceDropRecipients,
  recentDeliveryForPhone,
  recipientExistsInCampaign,
  updateVoiceDropCampaign,
  updateVoiceDropRecipient,
} from "@/lib/voice/repository/voice-drop-repository"
import { ensureDefaultCallHourRule } from "@/lib/voice/repository/voice-compliance-orchestration-repository"
import { countVoiceOptOuts } from "@/lib/voice/repository/voice-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"

function summarizeOrchestratorResults(
  results: Array<{ phoneNumber: string; result: { decision: string; reasons: string[]; blocked: boolean; manualReviewRequired: boolean; allowed: boolean } }>,
): VoiceDropComplianceSummary {
  const reasonCounts = new Map<string, number>()
  let eligibleCount = 0
  let suppressedCount = 0
  let manualReviewCount = 0

  for (const { result } of results) {
    if (result.allowed) eligibleCount += 1
    else if (result.blocked) suppressedCount += 1
    else manualReviewCount += 1
    for (const reason of result.reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
    }
  }

  return {
    eligibleCount,
    suppressedCount,
    manualReviewCount,
    reasons: [...reasonCounts.entries()].map(([reason, count]) => ({ reason, count })),
  }
}

export async function fetchVoiceDropReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceDropReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const providerMode = resolveVoiceDropProviderMode()
  const optOutCount = await countVoiceOptOuts(admin, organizationId)
  const callHourRule = await ensureDefaultCallHourRule(admin, organizationId)

  return {
    qaMarker: VOICE_DROP_INFRASTRUCTURE_QA_MARKER,
    schemaReady: schema.ready,
    voiceDropEnabled: isVoiceDropEnabled(),
    providerMode,
    complianceGatingReady: schema.ready && isComplianceOrchestrationEnabled(),
    approvalWorkflowEnabled: true,
    optOutRegistryReady: optOutCount >= 0,
    callHourRulesReady: Boolean(callHourRule),
    autonomousOutboundDisabled: true,
    message: isVoiceDropEnabled()
      ? `Voice drop infrastructure enabled — provider ${providerMode}, approval required, compliance orchestration ${isComplianceOrchestrationEnabled() ? "active" : "disabled"}.`
      : "Set VOICE_DROP_ENABLED=true to activate voice drop infrastructure.",
  }
}

export async function fetchVoiceDropCampaignDashboard(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceDropCampaignDashboardSnapshot> {
  const campaigns = await listVoiceDropCampaigns(admin, organizationId)
  return buildVoiceDropCampaignDashboardSnapshot(campaigns)
}

export async function createDraftVoiceDropCampaign(
  admin: SupabaseClient,
  input: {
    organizationId: string
    name: string
    messageTemplate: string
    campaignType?: VoiceDropCampaignPublicView["campaignType"]
    createdBy?: string | null
  },
): Promise<VoiceDropCampaignPublicView> {
  const validation = validateMessageTemplate(input.messageTemplate)
  if (!validation.ok) {
    throw new Error(validation.violations.join(" "))
  }

  return createVoiceDropCampaign(admin, {
    organizationId: input.organizationId,
    name: input.name,
    campaignType: input.campaignType ?? "voicemail_drop",
    messageTemplate: input.messageTemplate,
    voiceProvider: resolveVoiceDropProviderMode(),
    createdBy: input.createdBy ?? null,
  })
}

export async function previewVoiceDropRecipientsCompliance(
  admin: SupabaseClient,
  input: {
    organizationId: string
    campaignId: string
    recipients: Array<{ phoneNumber: string; recipientName?: string | null }>
    createdBy?: string | null
  },
): Promise<{ recipients: VoiceDropRecipientPublicView[]; compliance: VoiceDropComplianceSummary }> {
  const campaign = await getVoiceDropCampaign(admin, input.organizationId, input.campaignId)
  if (!campaign) throw new Error("Campaign not found.")

  const capSince = new Date()
  capSince.setDate(capSince.getDate() - VOICE_DROP_FREQUENCY_CAP_DAYS)

  const capped = input.recipients.slice(0, VOICE_DROP_MAX_RECIPIENTS_PER_CAMPAIGN)
  const enriched = await Promise.all(
    capped.map(async (row) => {
      const duplicate = await recipientExistsInCampaign(admin, input.campaignId, row.phoneNumber)
      const recent = await recentDeliveryForPhone(admin, input.organizationId, row.phoneNumber, capSince.toISOString())
      return {
        phoneNumber: row.phoneNumber,
        recipientName: row.recipientName,
        duplicateInCampaign: duplicate,
        recentContactWithinCap: recent,
      }
    }),
  )

  const batch = await evaluateCommunicationComplianceBatchForOrg(admin, {
    organizationId: input.organizationId,
    channel: "voicemail",
    campaignType: campaign.campaignType,
    recipients: enriched,
  })

  const created: VoiceDropRecipientPublicView[] = []

  for (const row of enriched) {
    const batchResult = batch.results.find((r) => r.phoneNumber.trim() === row.phoneNumber.trim())
    const result =
      batchResult?.result ??
      (await evaluateAndAuditCompliance(admin, {
        organizationId: input.organizationId,
        phoneNumber: row.phoneNumber,
        channel: "voicemail",
        campaignType: campaign.campaignType,
        duplicateInCampaign: row.duplicateInCampaign,
        recentContactWithinCap: row.recentContactWithinCap,
        createdBy: input.createdBy ?? null,
      }))

    const patch = mapComplianceResultToRecipientPatch(result)

    const rendered = renderPersonalizedMessage(campaign.messageTemplate, {
      first_name: row.recipientName?.split(" ")[0] ?? null,
      company_name: null,
      assigned_rep: null,
      service_type: null,
      callback_number: null,
      appointment_window: null,
      last_interaction_summary: null,
    })

    const recipient = await addVoiceDropRecipient(admin, {
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      phoneNumber: row.phoneNumber,
      recipientName: row.recipientName,
      status: patch.status,
      suppressionReason: patch.suppressionReason,
      complianceDecision: patch.complianceDecision,
      complianceReasons: patch.complianceReasons,
      manualReviewRequired: patch.manualReviewRequired,
      renderedMessagePreview: rendered.rendered.slice(0, 500),
      metadata: {
        complianceEvidence: result.evidence,
        autonomousOutboundDisabled: true,
      },
    })
    created.push(recipient)
  }

  return { recipients: created, compliance: summarizeOrchestratorResults(batch.results) }
}

export async function transitionVoiceDropCampaign(
  admin: SupabaseClient,
  input: {
    organizationId: string
    campaignId: string
    transition: ApprovalTransition
    scheduledAt?: string | null
    userId?: string | null
  },
): Promise<VoiceDropCampaignPublicView | null> {
  const campaign = await getVoiceDropCampaign(admin, input.organizationId, input.campaignId)
  if (!campaign) return null

  if (!canTransitionCampaign(input.transition, campaign.approvalStatus, campaign.status)) {
    throw new Error(`Transition ${input.transition} not allowed from current campaign state.`)
  }

  const next = applyApprovalTransition(input.transition)
  if (!next) return null

  const updated = await updateVoiceDropCampaign(admin, {
    organizationId: input.organizationId,
    campaignId: input.campaignId,
    patch: {
      status: next.campaignStatus,
      approvalStatus: next.approvalStatus,
      scheduledAt: input.transition === "schedule" ? input.scheduledAt ?? null : campaign.scheduledAt,
    },
  })

  return updated
}

export async function queueApprovedVoiceDropRecipients(
  admin: SupabaseClient,
  input: { organizationId: string; campaignId: string; userId?: string | null },
): Promise<{ queued: number; suppressed: number; failed: number }> {
  const campaign = await getVoiceDropCampaign(admin, input.organizationId, input.campaignId)
  if (!campaign) throw new Error("Campaign not found.")
  if (campaign.approvalStatus !== "approved") {
    throw new Error("Campaign must be approved before queueing deliveries.")
  }
  if (campaign.status !== "approved" && campaign.status !== "scheduled" && campaign.status !== "running") {
    throw new Error("Campaign is not in an executable state.")
  }

  const provider = resolveVoiceDropProvider(campaign.voiceProvider)
  const recipients = await listVoiceDropRecipients(admin, input.organizationId, input.campaignId)

  let queued = 0
  let suppressed = 0
  let failed = 0

  for (const recipient of recipients) {
    if (recipient.status === "suppressed") {
      suppressed += 1
      continue
    }
    if (recipient.status === "delivered") continue

    if (recipient.manualReviewRequired || recipient.complianceDecision === "blocked") {
      await updateVoiceDropRecipient(admin, {
        organizationId: input.organizationId,
        recipientId: recipient.id,
        patch: {
          status: "suppressed",
          suppressionReason: recipient.complianceReasons[0] ?? "compliance_blocked",
        },
      })
      suppressed += 1
      continue
    }

    if (recipient.complianceDecision === "manual_review_required" || recipient.manualReviewRequired) {
      suppressed += 1
      continue
    }

    const capSince = new Date()
    capSince.setDate(capSince.getDate() - VOICE_DROP_FREQUENCY_CAP_DAYS)
    const recent = await recentDeliveryForPhone(
      admin,
      input.organizationId,
      recipient.phoneNumber,
      capSince.toISOString(),
    )

    const compliance = await evaluateAndAuditCompliance(admin, {
      organizationId: input.organizationId,
      phoneNumber: recipient.phoneNumber,
      channel: "voicemail",
      campaignType: campaign.campaignType,
      recentContactWithinCap: recent,
      createdBy: input.userId ?? null,
    })

    if (!compliance.allowed) {
      const patch = mapComplianceResultToRecipientPatch(compliance)
      await updateVoiceDropRecipient(admin, {
        organizationId: input.organizationId,
        recipientId: recipient.id,
        patch: {
          status: patch.status,
          suppressionReason: patch.suppressionReason,
          complianceDecision: patch.complianceDecision,
          complianceReasons: patch.complianceReasons,
          manualReviewRequired: patch.manualReviewRequired,
        },
      })
      suppressed += 1
      continue
    }

    const validation = provider.validateRecipient(recipient.phoneNumber)
    if (!validation.valid) {
      await updateVoiceDropRecipient(admin, {
        organizationId: input.organizationId,
        recipientId: recipient.id,
        patch: { status: "suppressed", suppressionReason: validation.reason },
      })
      suppressed += 1
      continue
    }

    const message = recipient.renderedMessagePreview ?? campaign.messageTemplate
    const result = await provider.queueDelivery({
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      recipientId: recipient.id,
      phoneNumber: recipient.phoneNumber,
      renderedMessage: message,
      voiceId: campaign.voiceId,
    })

    await appendVoiceDropDeliveryAttempt(admin, {
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      recipientId: recipient.id,
      provider: campaign.voiceProvider,
      providerDeliveryId: result.providerDeliveryId,
      status: result.status === "delivered" ? "delivered" : result.status === "failed" ? "failed" : "queued",
      failureReason: result.failureReason,
      metadata: { evidenceText: result.evidenceText },
    })

    const recipientStatus =
      result.status === "delivered" ? "delivered" : result.status === "failed" ? "failed" : "queued"

    await updateVoiceDropRecipient(admin, {
      organizationId: input.organizationId,
      recipientId: recipient.id,
      patch: {
        status: recipientStatus,
        deliveryAttemptCount: recipient.deliveryAttemptCount + 1,
        lastAttemptAt: new Date().toISOString(),
      },
    })

    if (recipientStatus === "queued" || recipientStatus === "delivered") queued += 1
    else failed += 1
  }

  if (queued > 0) {
    await updateVoiceDropCampaign(admin, {
      organizationId: input.organizationId,
      campaignId: input.campaignId,
      patch: { status: "running" },
    })
  }

  return { queued, suppressed, failed }
}
