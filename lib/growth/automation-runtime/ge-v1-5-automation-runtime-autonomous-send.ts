/** GE-AUTO-1E — Autonomous send orchestration after prepare (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_CRON_ACTOR_EMAIL } from "@/lib/growth/actor-user-id"
import {
  consumeAutonomyBudget,
  consumeChannelSendBudget,
} from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import {
  GROWTH_AUTONOMY_CHANNEL_TO_EXECUTION_CAPABILITY,
} from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  evaluateAutonomyOutboundSendPolicy,
  GROWTH_AUTONOMY_OUTBOUND_SEND_QA_MARKER,
} from "@/lib/growth/autonomy/growth-autonomy-outbound-send-policy"
import { logGrowthAutonomyOutboundSendDecision } from "@/lib/growth/autonomy/growth-autonomy-policy-logger"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import type { GrowthAutonomyChannelKey, GrowthAutonomySendDecision } from "@/lib/growth/autonomy/growth-autonomy-types"
import {
  approveGeV15PreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval"
import { executeGeV15ApprovedPreparedAction } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-execute"
import { evaluateGeV15PrepareSuppression } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-prepare-guards"
import {
  appendGeV15RuntimeLog,
  parseGeV15RuntimeState,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-logging"
import {
  GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY,
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  type GeV15PreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"

function channelKeyForPreparedAction(action: GeV15PreparedAction): GrowthAutonomyChannelKey | null {
  if (action.channel === "email" || action.action === "prepare_email") return "email"
  if (action.channel === "sms" || action.action === "prepare_sms") return "sms"
  if (action.channel === "voice_drop" || action.action === "prepare_voice_drop") return "voice"
  return null
}

function hasPendingApprovalConflict(actions: GeV15PreparedAction[], actionId: string): boolean {
  return actions.some(
    (row) =>
      row.id !== actionId &&
      (row.status === "pending_approval" || row.status === "approved") &&
      row.approvalRequired !== false,
  )
}

export type GeV15AutonomousSendAttemptResult = {
  action: GeV15PreparedAction
  decision: GrowthAutonomySendDecision
  sent: boolean
  reason: string | null
  humanReadableSummary: string | null
}

export async function maybeAutonomousSendGeV15PreparedAction(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    preparedAction: GeV15PreparedAction
    existingPreparedActions: GeV15PreparedAction[]
    actorUserId?: string | null
    actorEmail?: string | null
    dryRun?: boolean
  },
): Promise<GeV15AutonomousSendAttemptResult> {
  const channel = channelKeyForPreparedAction(input.preparedAction)
  const baseResult = (decision: GrowthAutonomySendDecision, reason: string | null, summary: string | null) => ({
    action: input.preparedAction,
    decision,
    sent: false,
    reason,
    humanReadableSummary: summary,
  })

  if (GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.autonomous_approval_enabled) {
    return baseResult("approval_queue", "autonomous_approval_disabled", "Autonomous approval remains disabled.")
  }

  if (!channel) {
    return baseResult("approval_queue", "unsupported_channel", null)
  }

  const suppression = await evaluateGeV15PrepareSuppression(admin, {
    channel: channel === "voice" ? "voice_drop" : channel,
    organizationId: input.organizationId,
    leadId: input.leadId,
    recipientEmail: input.preparedAction.recipientEmail,
    senderProfileId: input.preparedAction.senderProfileId,
    sequenceId: input.preparedAction.sequenceId,
  })
  if (!suppression.allowed) {
    const evaluation = await evaluateAutonomyOutboundSendPolicy(admin, {
      organizationId: input.organizationId,
      channel,
      sendContext: {
        senderProfileId: input.preparedAction.senderProfileId,
        sequenceId: input.preparedAction.sequenceId,
        audienceId: input.preparedAction.audienceId,
        confidenceScore: input.preparedAction.confidenceScore ?? null,
        leadId: input.leadId,
        hasPendingApprovalItem: hasPendingApprovalConflict(input.existingPreparedActions, input.preparedAction.id),
        duplicateSend: false,
      },
    })
    await logGrowthAutonomyOutboundSendDecision(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      preparedActionId: input.preparedAction.id,
      channel,
      decision: "blocked",
      reason: suppression.reason ?? suppression.code ?? "suppression_blocked",
      humanReadableSummary: `Blocked by suppression: ${suppression.reason ?? suppression.code}.`,
      policyResult: evaluation.policyResult,
      trigger: input.preparedAction.trigger,
      confidenceScore: input.preparedAction.confidenceScore ?? null,
    })
    void (async () => {
      try {
        const { dispatchGrowthObjectiveAutomationRuntimeEvent } = await import(
          "@/lib/growth/objectives/growth-objective-event-bridge"
        )
        await dispatchGrowthObjectiveAutomationRuntimeEvent(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          signalType: "blocked_action",
          channel,
          resourceId: input.preparedAction.sequenceId ?? null,
          confidence: input.preparedAction.confidenceScore ?? null,
          sourceEventId: input.preparedAction.id,
          policyMetadata: evaluation.policyResult.policyMetadata.channelPolicyMetadata,
        })
      } catch {
        // Best-effort objective fan-in.
      }
    })()
    return baseResult("blocked", suppression.reason ?? suppression.code ?? "suppression_blocked", null)
  }

  const sendEvaluation = await evaluateAutonomyOutboundSendPolicy(admin, {
    organizationId: input.organizationId,
    channel,
    sendContext: {
      senderProfileId: input.preparedAction.senderProfileId,
      sequenceId: input.preparedAction.sequenceId,
      audienceId: input.preparedAction.audienceId,
      confidenceScore: input.preparedAction.confidenceScore ?? null,
      leadId: input.leadId,
      hasPendingApprovalItem: hasPendingApprovalConflict(input.existingPreparedActions, input.preparedAction.id),
      duplicateSend: false,
    },
  })

  await logGrowthAutonomyOutboundSendDecision(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    preparedActionId: input.preparedAction.id,
    channel,
    decision: sendEvaluation.decision,
    reason: sendEvaluation.reason,
    humanReadableSummary: sendEvaluation.humanReadableSummary,
    policyResult: sendEvaluation.policyResult,
    trigger: input.preparedAction.trigger,
    confidenceScore: input.preparedAction.confidenceScore ?? null,
  })

  let action: GeV15PreparedAction = {
    ...input.preparedAction,
    autonomySendDecision: sendEvaluation.decision,
    autonomySendReason: sendEvaluation.reason,
    autonomySendSummary: sendEvaluation.humanReadableSummary,
    sendPolicyMetadata: sendEvaluation.policyResult.policyMetadata.channelPolicyMetadata,
  }

  if (
    sendEvaluation.decision === "approval_queue" ||
    sendEvaluation.decision === "shadow_would_queue" ||
    sendEvaluation.decision === "blocked"
  ) {
    return { ...baseResult(sendEvaluation.decision, sendEvaluation.reason, sendEvaluation.humanReadableSummary), action }
  }

  if (sendEvaluation.decision === "shadow_would_send") {
    action = {
      ...action,
      status: "pending_approval",
      shadowWouldSend: true,
    }
    return { ...baseResult("shadow_would_send", null, sendEvaluation.humanReadableSummary), action }
  }

  if (input.dryRun) {
    return { ...baseResult("autonomous_send", null, sendEvaluation.humanReadableSummary), action }
  }

  const settings = await fetchGrowthAutonomySettings(admin, input.organizationId)
  const channelConfig = settings.channelPermissions[channel]
  const capability = GROWTH_AUTONOMY_CHANNEL_TO_EXECUTION_CAPABILITY[channel]

  const channelBudget = await consumeChannelSendBudget(admin, {
    organizationId: input.organizationId,
    channel,
    maxSendsPerDay: channelConfig?.max_sends_per_day ?? 0,
  })
  if (!channelBudget.allowed) {
    return {
      ...baseResult("approval_queue", channelBudget.reason, "Would queue — channel send budget exhausted."),
      action,
    }
  }

  const orgBudget = await consumeAutonomyBudget(admin, {
    organizationId: input.organizationId,
    capability,
  })
  if (!orgBudget.allowed) {
    return {
      ...baseResult("approval_queue", orgBudget.reason, "Would queue — org outbound budget exhausted."),
      action,
    }
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return baseResult("approval_queue", "lead_not_found", null)
  }

  let state = parseGeV15RuntimeState(lead.metadata)
  const now = new Date().toISOString()
  state = {
    ...state,
    preparedActions: approveGeV15PreparedAction(state.preparedActions, action.id, "ge_auto_1e_policy"),
  }
  state = appendGeV15RuntimeLog(state, {
    phase: "approval",
    message: `Autonomous policy approved ${action.id} for send.`,
    metadata: {
      qa_marker: GROWTH_AUTONOMY_OUTBOUND_SEND_QA_MARKER,
      confidence_score: action.confidenceScore,
      decision: sendEvaluation.decision,
    },
  })

  await updateGrowthLead(admin, input.leadId, {
    metadata: { ...(lead.metadata ?? {}), [GE_V1_5_AUTOMATION_RUNTIME_METADATA_KEY]: state },
  })

  const executeResult = await executeGeV15ApprovedPreparedAction(admin, {
    leadId: input.leadId,
    actionId: action.id,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? "ge_auto_1e",
    actorEmail: input.actorEmail ?? GROWTH_CRON_ACTOR_EMAIL,
    autonomousPolicySend: true,
  })

  if (!executeResult.ok) {
    return {
      action: { ...action, status: "failed", executionError: executeResult.error ?? "execution_failed" },
      decision: "approval_queue",
      sent: false,
      reason: executeResult.error ?? "execution_failed",
      humanReadableSummary: sendEvaluation.humanReadableSummary,
    }
  }

  const executed = executeResult.action ?? {
    ...action,
    status: "executed" as const,
    executedAt: now,
    autonomousSend: true,
  }

  return {
    action: executed,
    decision: "autonomous_send",
    sent: true,
    reason: null,
    humanReadableSummary: sendEvaluation.humanReadableSummary,
  }
}
