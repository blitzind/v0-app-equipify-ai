import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateCommunicationComplianceBatch } from "@/lib/voice/compliance-orchestration/batch-evaluation"
import {
  evaluateCommunicationCompliance,
} from "@/lib/voice/compliance-orchestration/compliance-decision-engine"
import { resolveDncProvider } from "@/lib/voice/compliance-orchestration/dnc-provider-scaffold"
import type {
  CommunicationComplianceEvaluationInput,
  CommunicationComplianceResult,
  VoiceComplianceManualReviewQueueSnapshot,
  VoiceComplianceReadinessSnapshot,
  VoiceConsentChannel,
  VoiceConsentStatus,
} from "@/lib/voice/compliance-orchestration/types"
import {
  VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER,
} from "@/lib/voice/compliance-orchestration/types"
import {
  appendComplianceAuditEvent,
  buildComplianceEvaluationContext,
  countComplianceAuditEvents,
  countDncEntries,
  countManualReviewRecipients,
  countSuppressionEntries,
  ensureDefaultCallHourRule,
  getConsentForPhone,
  listManualReviewRecipients,
  listRecentAuditEvents,
  propagateOptOutRegistry,
  upsertConsentRecord,
  addSuppressionEntry,
} from "@/lib/voice/repository/voice-compliance-orchestration-repository"
import { updateVoiceDropRecipient } from "@/lib/voice/repository/voice-drop-repository"
import { countVoiceOptOuts } from "@/lib/voice/repository/voice-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"

export function isComplianceOrchestrationEnabled(): boolean {
  return process.env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "true"
}

export async function fetchComplianceReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceComplianceReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const [suppressionCount, dncCount, optOutCount, manualReviewQueueCount, auditEventCount, callHourRule] =
    await Promise.all([
      countSuppressionEntries(admin, organizationId),
      countDncEntries(admin, organizationId),
      countVoiceOptOuts(admin, organizationId),
      countManualReviewRecipients(admin, organizationId),
      countComplianceAuditEvents(admin, organizationId),
      ensureDefaultCallHourRule(admin, organizationId),
    ])

  const orchestrationEnabled = isComplianceOrchestrationEnabled()
  const consentReadiness = schema.ready

  return {
    qaMarker: VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER,
    schemaReady: schema.ready,
    orchestrationEnabled,
    consentReadiness,
    suppressionCount,
    dncCount,
    optOutCount,
    manualReviewQueueCount,
    callHourRulesReady: Boolean(callHourRule),
    auditEventCount,
    conservativeDefault: true,
    autonomousOutboundDisabled: true,
    message: orchestrationEnabled
      ? "Compliance orchestration enabled — suppress or manual review when uncertain."
      : "Set VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true to activate compliance orchestration.",
  }
}

export async function loadComplianceContextForPhone(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    channel: VoiceConsentChannel
    duplicateInCampaign?: boolean
    recentContactWithinCap?: boolean
    relationshipSuppressed?: boolean
  },
) {
  await ensureDefaultCallHourRule(admin, input.organizationId)
  return buildComplianceEvaluationContext(admin, input)
}

export async function evaluateCommunicationComplianceForPhone(
  admin: SupabaseClient,
  input: CommunicationComplianceEvaluationInput & {
    duplicateInCampaign?: boolean
    recentContactWithinCap?: boolean
    relationshipSuppressed?: boolean
  },
): Promise<CommunicationComplianceResult> {
  const context = await loadComplianceContextForPhone(admin, {
    organizationId: input.organizationId,
    phoneNumber: input.phoneNumber,
    channel: input.channel,
    duplicateInCampaign: input.duplicateInCampaign,
    recentContactWithinCap: input.recentContactWithinCap,
    relationshipSuppressed: input.relationshipSuppressed,
  })
  return evaluateCommunicationCompliance(input, context)
}

export async function evaluateAndAuditCompliance(
  admin: SupabaseClient,
  input: CommunicationComplianceEvaluationInput & {
    duplicateInCampaign?: boolean
    recentContactWithinCap?: boolean
    relationshipSuppressed?: boolean
    createdBy?: string | null
    skipAudit?: boolean
  },
): Promise<CommunicationComplianceResult> {
  const result = await evaluateCommunicationComplianceForPhone(admin, input)

  if (!input.skipAudit) {
    const action =
      result.blocked ? "send_blocked" : result.manualReviewRequired ? "manual_review_required" : "compliance_evaluated"

    await appendComplianceAuditEvent(admin, {
      organizationId: input.organizationId,
      phoneNumber: input.phoneNumber,
      channel: input.channel,
      action,
      decision: result.decision,
      evidence: {
        reasons: result.reasons,
        requiredActions: result.requiredActions,
        evidence: result.evidence,
      },
      createdBy: input.createdBy ?? null,
    })
  }

  return result
}

export async function evaluateCommunicationComplianceBatchForOrg(
  admin: SupabaseClient,
  input: {
    organizationId: string
    channel: VoiceConsentChannel
    campaignType?: string | null
    recipients: Array<{
      phoneNumber: string
      relatedCustomerId?: string | null
      relatedProspectId?: string | null
      relationshipMemoryProfileId?: string | null
      duplicateInCampaign?: boolean
      recentContactWithinCap?: boolean
    }>
  },
) {
  await ensureDefaultCallHourRule(admin, input.organizationId)

  return evaluateCommunicationComplianceBatch({
    organizationId: input.organizationId,
    channel: input.channel,
    campaignType: input.campaignType,
    recipients: input.recipients,
    loadContext: async (phoneNumber) => {
      const recipient = input.recipients.find((r) => r.phoneNumber.trim() === phoneNumber)
      return buildComplianceEvaluationContext(admin, {
        organizationId: input.organizationId,
        phoneNumber,
        channel: input.channel,
        duplicateInCampaign: recipient?.duplicateInCampaign ?? false,
        recentContactWithinCap: recipient?.recentContactWithinCap ?? false,
      })
    },
  })
}

export async function propagateOptOut(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    reason: string
    source: string
    channel?: VoiceConsentChannel | null
    createdBy?: string | null
  },
) {
  await propagateOptOutRegistry(admin, {
    organizationId: input.organizationId,
    phoneNumber: input.phoneNumber,
    reason: input.reason,
    source: input.source,
  })

  await appendComplianceAuditEvent(admin, {
    organizationId: input.organizationId,
    phoneNumber: input.phoneNumber,
    channel: input.channel ?? null,
    action: "opt_out_propagated",
    decision: "blocked",
    evidence: { reason: input.reason, source: input.source },
    createdBy: input.createdBy ?? null,
  })
}

export async function fetchManualReviewQueue(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceComplianceManualReviewQueueSnapshot> {
  const [recipients, recentAudits] = await Promise.all([
    listManualReviewRecipients(admin, organizationId, 50),
    listRecentAuditEvents(admin, organizationId, 20),
  ])

  const items = recipients.map((row) => ({
    id: row.id,
    phoneNumber: row.phoneNumber,
    channel: "voicemail" as VoiceConsentChannel,
    decision: row.complianceDecision ?? ("manual_review_required" as const),
    reasons: row.complianceReasons,
    source: "voice_drop_recipient" as const,
    sourceId: row.id,
    createdAt: row.createdAt,
    metadata: row.metadata,
  }))

  for (const audit of recentAudits) {
    if (audit.action === "manual_review_required" && audit.phoneNumber) {
      const exists = items.some((i) => i.phoneNumber === audit.phoneNumber && i.source === "compliance_audit")
      if (!exists) {
        items.push({
          id: audit.id,
          phoneNumber: audit.phoneNumber,
          channel: audit.channel ?? "callback",
          decision: audit.decision ?? "manual_review_required",
          reasons: Array.isArray(audit.evidence.reasons) ? (audit.evidence.reasons as string[]) : [],
          source: "compliance_audit",
          sourceId: audit.id,
          createdAt: audit.createdAt,
          metadata: audit.evidence,
        })
      }
    }
  }

  const blockedCount = items.filter((i) => i.decision === "blocked").length
  const manualReviewCount = items.filter((i) => i.decision === "manual_review_required").length

  return {
    qaMarker: VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER,
    generatedAt: new Date().toISOString(),
    items: items.slice(0, 50),
    blockedCount,
    manualReviewCount,
    message: "Manual review queue — operator must approve before outbound contact.",
  }
}

export type ManualReviewAction = "approve" | "reject" | "add_suppression" | "grant_consent" | "deny_consent"

export async function resolveManualReviewItem(
  admin: SupabaseClient,
  input: {
    organizationId: string
    itemId: string
    action: ManualReviewAction
    phoneNumber: string
    channel: VoiceConsentChannel
    userId: string
    evidenceText?: string
  },
) {
  const dncProvider = resolveDncProvider()

  switch (input.action) {
    case "approve": {
      await updateVoiceDropRecipient(admin, {
        organizationId: input.organizationId,
        recipientId: input.itemId,
        patch: {
          manualReviewRequired: false,
          complianceDecision: "allowed",
          status: "pending",
        },
      })
      await appendComplianceAuditEvent(admin, {
        organizationId: input.organizationId,
        phoneNumber: input.phoneNumber,
        channel: input.channel,
        action: "manual_review_approved",
        decision: "allowed",
        evidence: { evidenceText: input.evidenceText ?? "Operator approved manual review." },
        createdBy: input.userId,
      })
      break
    }
    case "reject": {
      await updateVoiceDropRecipient(admin, {
        organizationId: input.organizationId,
        recipientId: input.itemId,
        patch: {
          manualReviewRequired: false,
          complianceDecision: "blocked",
          status: "suppressed",
          suppressionReason: "manual_review_rejected",
        },
      })
      await appendComplianceAuditEvent(admin, {
        organizationId: input.organizationId,
        phoneNumber: input.phoneNumber,
        channel: input.channel,
        action: "manual_review_rejected",
        decision: "blocked",
        evidence: { evidenceText: input.evidenceText ?? "Operator rejected manual review." },
        createdBy: input.userId,
      })
      break
    }
    case "add_suppression": {
      await addSuppressionEntry(admin, {
        organizationId: input.organizationId,
        phoneNumber: input.phoneNumber,
        suppressionType: "manual_review",
        suppressionReason: input.evidenceText ?? "Operator added suppression.",
        source: "manual_review_queue",
        severity: "high",
      })
      await appendComplianceAuditEvent(admin, {
        organizationId: input.organizationId,
        phoneNumber: input.phoneNumber,
        channel: input.channel,
        action: "suppression_added",
        decision: "blocked",
        evidence: { evidenceText: input.evidenceText },
        createdBy: input.userId,
      })
      break
    }
    case "grant_consent": {
      await upsertConsentRecord(admin, {
        organizationId: input.organizationId,
        phoneNumber: input.phoneNumber,
        channel: input.channel,
        consentStatus: "granted",
        consentSource: "manual_review_queue",
        evidenceText: input.evidenceText ?? "Operator granted consent.",
        createdBy: input.userId,
      })
      await appendComplianceAuditEvent(admin, {
        organizationId: input.organizationId,
        phoneNumber: input.phoneNumber,
        channel: input.channel,
        action: "consent_granted",
        decision: "allowed",
        evidence: { evidenceText: input.evidenceText },
        createdBy: input.userId,
      })
      break
    }
    case "deny_consent": {
      await upsertConsentRecord(admin, {
        organizationId: input.organizationId,
        phoneNumber: input.phoneNumber,
        channel: input.channel,
        consentStatus: "denied",
        consentSource: "manual_review_queue",
        evidenceText: input.evidenceText ?? "Operator denied consent.",
        createdBy: input.userId,
      })
      await appendComplianceAuditEvent(admin, {
        organizationId: input.organizationId,
        phoneNumber: input.phoneNumber,
        channel: input.channel,
        action: "consent_denied",
        decision: "blocked",
        evidence: { evidenceText: input.evidenceText },
        createdBy: input.userId,
      })
      break
    }
  }

  void dncProvider
  return { ok: true }
}

export async function buildSafeRecoveryAction(
  admin: SupabaseClient,
  input: {
    organizationId: string
    phoneNumber: string
    recoveryType: string
    relationshipMemoryProfileId?: string | null
  },
): Promise<{
  recommendedAction: string
  compliance: CommunicationComplianceResult
  safeToRecommendCallback: boolean
  safeToRecommendSms: boolean
  safeToRecommendVoiceDrop: boolean
}> {
  const [callbackCompliance, smsCompliance, voicemailCompliance] = await Promise.all([
    evaluateCommunicationComplianceForPhone(admin, {
      organizationId: input.organizationId,
      phoneNumber: input.phoneNumber,
      channel: "callback",
      relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    }),
    evaluateCommunicationComplianceForPhone(admin, {
      organizationId: input.organizationId,
      phoneNumber: input.phoneNumber,
      channel: "sms",
      relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    }),
    evaluateCommunicationComplianceForPhone(admin, {
      organizationId: input.organizationId,
      phoneNumber: input.phoneNumber,
      channel: "voicemail",
      relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    }),
  ])

  const safeToRecommendCallback = callbackCompliance.allowed
  const safeToRecommendSms = smsCompliance.allowed
  const safeToRecommendVoiceDrop = voicemailCompliance.allowed

  let recommendedAction = "review_and_plan_manual_follow_up"
  if (callbackCompliance.blocked || smsCompliance.blocked || voicemailCompliance.blocked) {
    recommendedAction = "compliance_blocked_review_required"
  } else if (
    callbackCompliance.manualReviewRequired ||
    smsCompliance.manualReviewRequired ||
    voicemailCompliance.manualReviewRequired
  ) {
    recommendedAction = "compliance_manual_review_before_contact"
  } else if (safeToRecommendCallback) {
    recommendedAction = "operator_callback_recommended"
  }

  return {
    recommendedAction,
    compliance: callbackCompliance,
    safeToRecommendCallback,
    safeToRecommendSms,
    safeToRecommendVoiceDrop,
  }
}

export async function getConsentStatusForChannel(
  admin: SupabaseClient,
  organizationId: string,
  phoneNumber: string,
  channel: VoiceConsentChannel,
): Promise<VoiceConsentStatus> {
  const consent = await getConsentForPhone(admin, organizationId, phoneNumber, channel)
  return consent?.consentStatus ?? "unknown"
}
