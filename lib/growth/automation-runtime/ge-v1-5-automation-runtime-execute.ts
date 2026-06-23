/** GE-AUTO-1D — Operator-approved execution for GeV15 prepared actions (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import { executeTransportSend } from "@/lib/growth/providers/transport/transport-orchestrator"
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"
import { sendSms } from "@/lib/growth/sms/send-sms"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import {
  editGeV15PreparedAction,
  markGeV15PreparedActionExecuted,
  markGeV15PreparedActionFailed,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval"
import { evaluateGeV15PrepareSuppression } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-prepare-guards"
import {
  appendGeV15RuntimeLog,
  parseGeV15RuntimeState,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-logging"
import {
  GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY,
  GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  type GeV15PreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { recordInternalOutboundAuditEvent } from "@/lib/growth/operations/internal-outbound-audit"
import { evaluateAndAuditCompliance } from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { mapComplianceResultToRecipientPatch } from "@/lib/voice/compliance-orchestration/compliance-decision-engine"
import { resolveVoiceDropProvider } from "@/lib/voice/voice-drops/provider-registry"
import {
  addVoiceDropRecipient,
  appendVoiceDropDeliveryAttempt,
  getVoiceDropCampaign,
} from "@/lib/voice/repository/voice-drop-repository"

export const GE_AUTO_1D_EXECUTE_QA_MARKER = "growth-autonomy-ge-auto-1d-v1" as const

function resolveDraftBody(action: GeV15PreparedAction): string {
  return (action.editedDraftContent ?? action.draftContent ?? "").trim()
}

function resolveEmailSubject(action: GeV15PreparedAction): string {
  return (action.editedSubject ?? action.title).trim()
}

async function executeApprovedEmail(
  admin: SupabaseClient,
  input: {
    action: GeV15PreparedAction
    leadId: string
    actorUserId: string
    actorEmail: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const to = input.action.recipientEmail ?? lead?.contactEmail ?? ""
  const senderAccountId = input.action.senderProfileId
  if (!senderAccountId) return { ok: false, error: "missing_sender_profile" }

  const body = resolveDraftBody(input.action)
  if (!body) return { ok: false, error: "missing_draft_content" }

  const prepared = await prepareOutboundEmailContent(admin, {
    senderAccountId,
    subject: resolveEmailSubject(input.action),
    bodyText: body,
  })

  const transport = await executeTransportSend(admin, {
    sender_account_id: senderAccountId,
    to,
    subject: prepared.subject,
    text: prepared.textBody,
    html: prepared.htmlBody,
    lead_id: input.leadId,
    human_approved: true,
    human_approval_confirmed: true,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    is_test: false,
    metadata: {
      ge_v1_5_prepared_action_id: input.action.id,
      autonomy_prepared: input.action.autonomyPrepared ?? false,
      approved_by: input.action.approvedBy,
      autonomous_policy_send: input.action.approvedBy === "ge_auto_1e_policy",
      qa_marker: GE_AUTO_1D_EXECUTE_QA_MARKER,
    },
  })

  if (!transport.ok) {
    return { ok: false, error: transport.error ?? "email_send_failed" }
  }

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "operator_approved_send",
    severity: "low",
    title: "GeV15 approved email sent",
    summary: `Approved autonomy-prepared email sent to ${to}.`,
    leadId: input.leadId,
    senderAccountId,
    metadata: {
      prepared_action_id: input.action.id,
      delivery_attempt_id: transport.attempt?.id ?? null,
      qa_marker: GE_AUTO_1D_EXECUTE_QA_MARKER,
    },
  })

  return { ok: true }
}

async function executeApprovedSms(
  admin: SupabaseClient,
  input: {
    action: GeV15PreparedAction
    leadId: string
    actorUserId: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const toE164 = normalizeToE164(lead?.contactPhone ?? "")
  const body = resolveDraftBody(input.action)
  if (!toE164) return { ok: false, error: "invalid_phone" }
  if (!body) return { ok: false, error: "missing_draft_content" }

  const result = await sendSms(admin, {
    leadId: input.leadId,
    toE164,
    body,
    idempotencyKey: input.action.executionIdempotencyKey ?? `ge-v1-5-exec:${input.action.id}`,
    actingUserId: input.actorUserId,
  })

  if (!result.ok) {
    return { ok: false, error: result.message ?? result.code ?? "sms_send_failed" }
  }

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "operator_approved_send",
    severity: "low",
    title: "GeV15 approved SMS sent",
    summary: `Approved autonomy-prepared SMS sent to ${toE164}.`,
    leadId: input.leadId,
    metadata: {
      prepared_action_id: input.action.id,
      delivery_attempt_id: result.deliveryAttemptId ?? null,
      qa_marker: GE_AUTO_1D_EXECUTE_QA_MARKER,
    },
  })

  return { ok: true }
}

async function executeApprovedVoiceDrop(
  admin: SupabaseClient,
  input: {
    action: GeV15PreparedAction
    leadId: string
    organizationId: string
    actorUserId: string
  },
): Promise<{ ok: boolean; error?: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  const phone = normalizeToE164(lead?.contactPhone ?? "")
  if (!phone) return { ok: false, error: "invalid_phone" }

  const campaignId = input.action.voiceDropCampaignId ?? input.action.sequenceId
  if (!campaignId) return { ok: false, error: "missing_voice_drop_campaign" }

  const campaign = await getVoiceDropCampaign(admin, input.organizationId, campaignId)
  if (!campaign) return { ok: false, error: "voice_drop_campaign_not_found" }

  const compliance = await evaluateAndAuditCompliance(admin, {
    organizationId: input.organizationId,
    phoneNumber: phone,
    channel: "voicemail",
    campaignType: campaign.campaignType,
    createdBy: input.actorUserId,
  })
  if (!compliance.allowed) {
    const patch = mapComplianceResultToRecipientPatch(compliance)
    return { ok: false, error: patch.suppressionReason ?? "voice_compliance_blocked" }
  }

  const script = resolveDraftBody(input.action)
  const recipient = await addVoiceDropRecipient(admin, {
    organizationId: input.organizationId,
    campaignId,
    phoneNumber: phone,
    recipientName: lead?.contactName ?? null,
    renderedMessagePreview: script || campaign.messageTemplate,
    metadata: {
      ge_v1_5_prepared_action_id: input.action.id,
      lead_id: input.leadId,
      qa_marker: GE_AUTO_1D_EXECUTE_QA_MARKER,
    },
  })

  const provider = resolveVoiceDropProvider(campaign.voiceProvider)
  const validation = provider.validateRecipient(phone)
  if (!validation.valid) {
    return { ok: false, error: validation.reason ?? "invalid_phone" }
  }

  const delivery = await provider.queueDelivery({
    organizationId: input.organizationId,
    campaignId,
    recipientId: recipient.id,
    phoneNumber: phone,
    renderedMessage: script || campaign.messageTemplate,
    voiceId: campaign.voiceId,
  })

  await appendVoiceDropDeliveryAttempt(admin, {
    organizationId: input.organizationId,
    campaignId,
    recipientId: recipient.id,
    provider: campaign.voiceProvider,
    providerDeliveryId: delivery.providerDeliveryId,
    status:
      delivery.status === "delivered"
        ? "delivered"
        : delivery.status === "failed"
          ? "failed"
          : delivery.status === "in_progress"
            ? "in_progress"
            : "queued",
    failureReason: delivery.failureReason,
    metadata: {
      ge_v1_5_prepared_action_id: input.action.id,
      qa_marker: GE_AUTO_1D_EXECUTE_QA_MARKER,
    },
  })

  if (delivery.status === "failed") {
    return { ok: false, error: delivery.failureReason ?? "voice_drop_failed" }
  }

  await recordInternalOutboundAuditEvent(admin, {
    eventType: "operator_approved_send",
    severity: "low",
    title: "GeV15 approved voice drop queued",
    summary: `Approved autonomy-prepared voice drop queued for ${phone}.`,
    leadId: input.leadId,
    metadata: {
      prepared_action_id: input.action.id,
      voice_drop_campaign_id: campaignId,
      qa_marker: GE_AUTO_1D_EXECUTE_QA_MARKER,
    },
  })

  return { ok: true }
}

export async function executeGeV15ApprovedPreparedAction(
  admin: SupabaseClient,
  input: {
    leadId: string
    actionId: string
    organizationId: string
    actorUserId: string
    actorEmail: string
    autonomousPolicySend?: boolean
  },
): Promise<{ ok: boolean; action?: GeV15PreparedAction; error?: string }> {
  const isAutonomousPolicySend = Boolean(input.autonomousPolicySend)
  if (
    !isAutonomousPolicySend &&
    !GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.operator_approved_send_execution_enabled
  ) {
    return { ok: false, error: "operator_execute_disabled" }
  }
  if (
    isAutonomousPolicySend &&
    !GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.policy_gated_autonomous_send_enabled
  ) {
    return { ok: false, error: "autonomous_send_disabled" }
  }
  if (GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.autonomous_approval_enabled) {
    return { ok: false, error: "autonomous_approval_blocked" }
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { ok: false, error: "lead_not_found" }

  let state = parseGeV15RuntimeState(lead.metadata)
  const existing = state.preparedActions.find((action) => action.id === input.actionId)
  if (!existing) return { ok: false, error: "action_not_found" }
  if (existing.status !== "approved") return { ok: false, error: "action_not_approved" }
  if (!existing.approvedAt) return { ok: false, error: "approval_audit_missing" }
  if (isAutonomousPolicySend && existing.approvedBy !== "ge_auto_1e_policy") {
    return { ok: false, error: "autonomous_policy_audit_missing" }
  }

  const channel =
    existing.channel ??
    (existing.action === "prepare_email"
      ? "email"
      : existing.action === "prepare_sms"
        ? "sms"
        : existing.action === "prepare_voice_drop"
          ? "voice_drop"
          : null)
  if (!channel) return { ok: false, error: "unsupported_channel" }

  const suppression = await evaluateGeV15PrepareSuppression(admin, {
    channel,
    organizationId: input.organizationId,
    leadId: input.leadId,
    recipientEmail: existing.recipientEmail,
    recipientPhone: lead.contactPhone,
    senderProfileId: existing.senderProfileId,
    sequenceId: existing.sequenceId,
  })
  if (!suppression.allowed) {
    state = {
      ...state,
      preparedActions: markGeV15PreparedActionFailed(
        state.preparedActions,
        input.actionId,
        suppression.reason ?? suppression.code ?? "suppression_blocked",
      ),
    }
    await updateGrowthLead(admin, input.leadId, {
      metadata: { ...(lead.metadata ?? {}), [GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY]: state },
    })
    return { ok: false, error: suppression.reason ?? suppression.code ?? "suppression_blocked" }
  }

  let result: { ok: boolean; error?: string }
  if (existing.action === "prepare_email") {
    result = await executeApprovedEmail(admin, {
      action: existing,
      leadId: input.leadId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  } else if (existing.action === "prepare_sms") {
    result = await executeApprovedSms(admin, {
      action: existing,
      leadId: input.leadId,
      actorUserId: input.actorUserId,
    })
  } else if (existing.action === "prepare_voice_drop") {
    result = await executeApprovedVoiceDrop(admin, {
      action: existing,
      leadId: input.leadId,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
    })
  } else {
    return { ok: false, error: "unsupported_action" }
  }

  if (!result.ok) {
    state = {
      ...state,
      preparedActions: markGeV15PreparedActionFailed(
        state.preparedActions,
        input.actionId,
        result.error ?? "execution_failed",
      ),
    }
    state = appendGeV15RuntimeLog(state, {
      phase: "failure",
      message: `Execution failed for ${input.actionId}: ${result.error ?? "unknown"}`,
      metadata: { actionId: input.actionId, error: result.error },
    })
    await updateGrowthLead(admin, input.leadId, {
      metadata: { ...(lead.metadata ?? {}), [GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY]: state },
    })
    return { ok: false, error: result.error ?? "execution_failed" }
  }

  state = {
    ...state,
    preparedActions: markGeV15PreparedActionExecuted(state.preparedActions, input.actionId),
  }
  state = appendGeV15RuntimeLog(state, {
    phase: "execution",
    message: `Operator executed approved action ${input.actionId}.`,
    metadata: {
      actionId: input.actionId,
      actorUserId: input.actorUserId,
      qa_marker: GE_AUTO_1D_EXECUTE_QA_MARKER,
    },
  })

  await updateGrowthLead(admin, input.leadId, {
    metadata: { ...(lead.metadata ?? {}), [GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY]: state },
  })

  const action = state.preparedActions.find((row) => row.id === input.actionId)
  void (async () => {
    try {
      const { dispatchGrowthObjectiveAutomationRuntimeEvent } = await import(
        "@/lib/growth/objectives/growth-objective-event-bridge"
      )
      await dispatchGrowthObjectiveAutomationRuntimeEvent(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        signalType: input.autonomousPolicySend ? "autonomous_send" : "executed_action",
        channel: action?.channel ?? null,
        resourceId: action?.sequenceId ?? null,
        resourceKey: action?.audienceId ?? null,
        confidence: action?.confidenceScore ?? null,
        policyMetadata: action?.sendPolicyMetadata ?? null,
        sourceEventId: input.actionId,
      })
    } catch {
      // Best-effort objective fan-in.
    }
  })()

  return { ok: true, action }
}

export async function editGeV15LeadPreparedAction(
  admin: SupabaseClient,
  input: {
    leadId: string
    actionId: string
    editedDraftContent?: string | null
    editedSubject?: string | null
    editedBy?: string | null
  },
): Promise<{ ok: boolean; action?: GeV15PreparedAction; error?: string }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { ok: false, error: "lead_not_found" }

  let state = parseGeV15RuntimeState(lead.metadata)
  try {
    state = {
      ...state,
      preparedActions: editGeV15PreparedAction(state.preparedActions, input.actionId, {
        editedDraftContent: input.editedDraftContent,
        editedSubject: input.editedSubject,
        editedBy: input.editedBy,
      }),
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "edit_failed" }
  }

  state = appendGeV15RuntimeLog(state, {
    phase: "approval",
    message: `Operator edited prepared action ${input.actionId}.`,
    metadata: { editedBy: input.editedBy },
  })

  await updateGrowthLead(admin, input.leadId, {
    metadata: { ...(lead.metadata ?? {}), [GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY]: state },
  })

  const action = state.preparedActions.find((row) => row.id === input.actionId)
  return { ok: true, action }
}
