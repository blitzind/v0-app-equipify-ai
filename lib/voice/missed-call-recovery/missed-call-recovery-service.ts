import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildCallbackWorkflowDraft } from "@/lib/voice/missed-call-recovery/callback-workflow"
import {
  buildRecommendedAction,
  buildRecoveryEvidenceText,
  callbackPriorityForRecovery,
  defaultCallbackDueAt,
} from "@/lib/voice/missed-call-recovery/recovery-generation"
import { buildSafeRecoveryAction } from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { buildMissedCallRecoveryWorkspaceSnapshot } from "@/lib/voice/missed-call-recovery/snapshot-builder"
import type {
  VoiceMissedCallRecoveryCommandSummary,
  VoiceMissedCallRecoveryReadinessSnapshot,
  VoiceMissedCallRecoveryType,
  VoiceMissedCallRecoveryWorkspaceSnapshot,
} from "@/lib/voice/missed-call-recovery/types"
import {
  VOICE_MISSED_CALL_RECOVERY_QA_MARKER,
} from "@/lib/voice/missed-call-recovery/types"
import {
  countActiveRecoveries,
  countPendingCallbacks,
  createCallbackTask,
  createMissedCallRecoveryEvent,
  listActiveMissedCallRecoveries,
  listCallbackTasksForCall,
  listPendingCallbackTasks,
  listRecoveriesForCall,
  updateMissedCallRecoveryStatus,
} from "@/lib/voice/repository/voice-missed-call-recovery-repository"
import { appendVoiceCallEvent } from "@/lib/voice/repository/voice-repository"
import { countVoiceOptOuts } from "@/lib/voice/repository/voice-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"

export function isMissedCallRecoveryEnabled(): boolean {
  return process.env.VOICE_MISSED_CALL_RECOVERY_ENABLED === "true"
}

export async function fetchMissedCallRecoveryReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceMissedCallRecoveryReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const activeRecoveryCount = await countActiveRecoveries(admin, organizationId)
  const pendingCallbackCount = await countPendingCallbacks(admin, organizationId)
  const optOutCount = await countVoiceOptOuts(admin, organizationId)

  return {
    qaMarker: VOICE_MISSED_CALL_RECOVERY_QA_MARKER,
    schemaReady: schema.ready,
    recoveryEnabled: isMissedCallRecoveryEnabled(),
    operatorAssignmentReady: schema.ready,
    callbackWorkflowReady: schema.ready,
    optOutRegistryReady: optOutCount >= 0,
    activeRecoveryCount,
    pendingCallbackCount,
    autonomousOutboundDisabled: true,
    message: isMissedCallRecoveryEnabled()
      ? "Missed-call recovery enabled — operator-initiated callbacks only."
      : "Set VOICE_MISSED_CALL_RECOVERY_ENABLED=true to activate recovery workflows.",
  }
}

export async function fetchMissedCallRecoveryCommandSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceMissedCallRecoveryCommandSummary> {
  const recoveries = await listActiveMissedCallRecoveries(admin, organizationId, 50)
  const callbacks = await listPendingCallbackTasks(admin, organizationId, 50)

  return {
    qaMarker: VOICE_MISSED_CALL_RECOVERY_QA_MARKER,
    activeCount: recoveries.length,
    callbackDueCount: callbacks.filter((t) => t.dueAt && new Date(t.dueAt) <= new Date()).length,
    voicemailLeftCount: recoveries.filter((r) => r.recoveryType === "voicemail_left").length,
    abandonedReceptionistCount: recoveries.filter((r) => r.recoveryType === "abandoned_ai_receptionist").length,
    autonomousOutboundDisabled: true,
  }
}

export async function fetchMissedCallRecoveryWorkspaceSnapshot(
  admin: SupabaseClient,
  input: { organizationId: string; voiceCallId: string | null },
): Promise<VoiceMissedCallRecoveryWorkspaceSnapshot> {
  const activeRecoveries = input.voiceCallId
    ? await listRecoveriesForCall(admin, input.organizationId, input.voiceCallId)
    : await listActiveMissedCallRecoveries(admin, input.organizationId, 10)

  const callbackTasks = input.voiceCallId
    ? await listCallbackTasksForCall(admin, input.organizationId, input.voiceCallId)
    : await listPendingCallbackTasks(admin, input.organizationId, 10)

  return buildMissedCallRecoveryWorkspaceSnapshot({
    voiceCallId: input.voiceCallId,
    activeRecoveries: activeRecoveries.filter((r) => r.recoveryStatus === "active"),
    callbackTasks,
  })
}

export async function recordMissedCallRecovery(
  admin: SupabaseClient,
  input: {
    organizationId: string
    recoveryType: VoiceMissedCallRecoveryType
    phoneNumber: string
    callerName?: string | null
    voiceCallId?: string | null
    voiceConversationId?: string | null
    relationshipMemoryProfileId?: string | null
    handoffSummary?: string | null
    relationshipContext?: string | null
    metadata?: Record<string, unknown>
  },
) {
  if (!isMissedCallRecoveryEnabled()) return null

  const safeAction = await buildSafeRecoveryAction(admin, {
    organizationId: input.organizationId,
    phoneNumber: input.phoneNumber,
    recoveryType: input.recoveryType,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
  })

  const evidenceText = buildRecoveryEvidenceText({
    recoveryType: input.recoveryType,
    phoneNumber: input.phoneNumber,
    callerName: input.callerName,
    handoffSummary: input.handoffSummary,
  })

  const recommendedAction =
    safeAction.recommendedAction !== "operator_callback_recommended"
      ? safeAction.recommendedAction
      : buildRecommendedAction({
          recoveryType: input.recoveryType,
          phoneNumber: input.phoneNumber,
        })

  const recovery = await createMissedCallRecoveryEvent(admin, {
    organizationId: input.organizationId,
    voiceCallId: input.voiceCallId,
    voiceConversationId: input.voiceConversationId,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    phoneNumber: input.phoneNumber,
    callerName: input.callerName,
    recoveryType: input.recoveryType,
    recommendedAction,
    evidenceText,
    metadata: {
      ...input.metadata,
      autonomousOutboundDisabled: true,
      complianceDecision: safeAction.compliance.decision,
      complianceReasons: safeAction.compliance.reasons,
      manualReviewRequired: safeAction.compliance.manualReviewRequired,
      safeToRecommendCallback: safeAction.safeToRecommendCallback,
      safeToRecommendSms: safeAction.safeToRecommendSms,
      safeToRecommendVoiceDrop: safeAction.safeToRecommendVoiceDrop,
    },
  })

  const dueAt = defaultCallbackDueAt(input.recoveryType)
  const priority = callbackPriorityForRecovery(input.recoveryType)
  const callbackDraft = buildCallbackWorkflowDraft({
    phoneNumber: input.phoneNumber,
    contactName: input.callerName,
    priority,
    dueAt,
    handoffSummary: input.handoffSummary ?? evidenceText,
    relationshipContext: input.relationshipContext,
  })

  await createCallbackTask(admin, {
    organizationId: input.organizationId,
    recoveryEventId: recovery.id,
    voiceCallId: input.voiceCallId,
    phoneNumber: callbackDraft.phoneNumber,
    contactName: callbackDraft.contactName,
    priority: callbackDraft.priority,
    dueAt: callbackDraft.dueAt,
    preferredWindowStart: callbackDraft.preferredWindowStart,
    preferredWindowEnd: callbackDraft.preferredWindowEnd,
    handoffSummary: callbackDraft.handoffSummary,
    relationshipContext: callbackDraft.relationshipContext,
    metadata: {
      autonomousOutboundDisabled: true,
      complianceChecked: true,
    },
  })

  if (input.voiceCallId) {
    await appendVoiceCallEvent(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      provider: "twilio",
      eventType: "missed_call_recovery_detected",
      eventTimestamp: new Date().toISOString(),
      payloadJson: {
        recoveryId: recovery.id,
        recoveryType: input.recoveryType,
        evidenceText,
        autonomousOutboundDisabled: true,
      },
      idempotencyKey: `missed_call_recovery:${recovery.id}`,
    })
  }

  return recovery
}

export async function acknowledgeMissedCallRecovery(
  admin: SupabaseClient,
  input: { organizationId: string; recoveryId: string; userId: string },
) {
  const updated = await updateMissedCallRecoveryStatus(admin, {
    organizationId: input.organizationId,
    recoveryId: input.recoveryId,
    status: "acknowledged",
    userId: input.userId,
  })

  if (updated?.voiceCallId) {
    await appendVoiceCallEvent(admin, {
      organizationId: input.organizationId,
      voiceCallId: updated.voiceCallId,
      provider: "twilio",
      eventType: "missed_call_recovery_acknowledged",
      eventTimestamp: new Date().toISOString(),
      payloadJson: { recoveryId: input.recoveryId, userId: input.userId },
      idempotencyKey: `recovery_ack:${input.recoveryId}:${input.userId}`,
    })
  }

  return updated
}

export async function recordMissedCallRecoveryFromReceptionistHook(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    callerNumber: string
    handoffSummary: string
    relationshipMemoryProfileId?: string | null
  },
) {
  return recordMissedCallRecovery(admin, {
    organizationId: input.organizationId,
    recoveryType: "abandoned_ai_receptionist",
    phoneNumber: input.callerNumber,
    voiceCallId: input.voiceCallId,
    relationshipMemoryProfileId: input.relationshipMemoryProfileId,
    handoffSummary: input.handoffSummary,
    metadata: { source: "ai_receptionist_takeover_hook" },
  })
}
