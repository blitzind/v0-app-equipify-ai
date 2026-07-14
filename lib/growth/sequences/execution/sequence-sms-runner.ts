import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildSequenceSchedulerIdempotencyKey } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import { recordSequenceEnrollmentChannelEvent } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-repository"
import {
  recordSequenceExecutionJobAuditEvent,
  recordSequenceExecutionTimelineEvent,
} from "@/lib/growth/sequences/execution/sequence-execution-events"
import type { GrowthSequenceExecutionRunResult } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { updateSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { buildSequenceExecutionSmsPayload } from "@/lib/growth/sequences/execution/sequence-sms-send-builder"
import { advanceGrowthSequenceEnrollmentAfterStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { sendSms } from "@/lib/growth/sms/send-sms"
import {
  APOLLO_SMS_PLACEHOLDER_BLOCK_CODE,
  evaluateApolloSmsSendReadiness,
  isApolloSmsPlaceholderBody,
} from "@/lib/growth/apollo/apollo-sequence-placeholder-guard"
import type { GrowthSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { enforceCanonicalDecisionForSequenceChannelJob } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-sequence-enforcement"
import type { CanonicalSequenceEnforcementTrustedGate } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"

export async function runSequenceSmsExecutionJob(
  admin: SupabaseClient,
  input: {
    job: GrowthSequenceExecutionJob
    actingUserId: string
    actingUserEmail: string
    auditActorUserId: string
    trustedGate?: CanonicalSequenceEnforcementTrustedGate | null
  },
): Promise<GrowthSequenceExecutionRunResult> {
  const { job } = input
  if (!job.sequenceStepId) {
    return { ok: false, jobId: job.id, status: "blocked", message: "missing_step", blocked: true }
  }

  const canonicalGate = await enforceCanonicalDecisionForSequenceChannelJob(admin, {
    job,
    channelLabel: "sms",
    cacheScope: `sequence-sms:${job.id}`,
    trustedGate: input.trustedGate,
  })
  if (!canonicalGate.allowed) {
    return canonicalGate.result
  }

  const useStoredDraft =
    job.smsDraftBody &&
    job.smsToE164 &&
    !isApolloSmsPlaceholderBody(job.smsDraftBody)

  let payload = useStoredDraft
    ? {
        leadId: job.leadId,
        toE164: job.smsToE164!,
        body: job.smsDraftBody!,
        sequenceEnrollmentId: job.sequenceEnrollmentId,
        sequenceStepId: job.sequenceStepId,
      }
    : await buildSequenceExecutionSmsPayload(admin, {
        sequenceStepId: job.sequenceStepId,
        leadId: job.leadId,
        sequenceEnrollmentId: job.sequenceEnrollmentId,
      })

  if (!("error" in payload)) {
    const smsReadiness = evaluateApolloSmsSendReadiness(payload.body)
    if (!smsReadiness.allowed) {
      await updateSequenceExecutionJob(admin, job.id, {
        status: "blocked",
        lastError: smsReadiness.code ?? APOLLO_SMS_PLACEHOLDER_BLOCK_CODE,
        lockedAt: null,
        lockedBy: null,
      })
      return {
        ok: false,
        jobId: job.id,
        status: "blocked",
        message: smsReadiness.code ?? APOLLO_SMS_PLACEHOLDER_BLOCK_CODE,
        blocked: true,
      }
    }
  }

  if ("error" in payload) {
    await updateSequenceExecutionJob(admin, job.id, {
      status: "blocked",
      lastError: payload.error,
      lockedAt: null,
      lockedBy: null,
    })
    return { ok: false, jobId: job.id, status: "blocked", message: payload.error, blocked: true }
  }

  const idempotencyKey = buildSequenceSchedulerIdempotencyKey(job.sequenceEnrollmentId, job.sequenceStepId)
  const smsResult = await sendSms(admin, {
    leadId: payload.leadId,
    toE164: payload.toE164,
    body: payload.body,
    idempotencyKey: `sequence-job:${job.id}:${idempotencyKey}`,
    actingUserId: input.auditActorUserId,
    sequenceEnrollmentId: job.sequenceEnrollmentId,
    sequenceEnrollmentStepId: job.sequenceStepId,
    sequenceExecutionJobId: job.id,
  })

  if (!smsResult.ok) {
    const nextStatus = smsResult.code === "sms_inactive" ? "blocked" : "failed"
    await updateSequenceExecutionJob(admin, job.id, {
      status: nextStatus,
      lastError: smsResult.message ?? smsResult.code,
      lockedAt: null,
      lockedBy: null,
      attemptCount: job.attemptCount + 1,
    })
    return {
      ok: false,
      jobId: job.id,
      status: nextStatus,
      message: smsResult.message ?? smsResult.code,
      blocked: nextStatus === "blocked",
    }
  }

  const updated = await updateSequenceExecutionJob(admin, job.id, {
    status: "sent",
    smsDeliveryAttemptId: smsResult.deliveryAttemptId,
    smsDraftBody: payload.body,
    smsToE164: payload.toE164,
    lastError: null,
    lockedAt: null,
    lockedBy: null,
    attemptCount: job.attemptCount + 1,
  })

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: job.id,
    eventType: "job_sent",
    title: "SMS execution job sent",
    description: "Sequence SMS delivered via Twilio transport after human approval.",
    metadata: {
      sms_delivery_attempt_id: smsResult.deliveryAttemptId,
      conversation_id: smsResult.conversationId,
      message_id: smsResult.messageId,
    },
  })

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: job.leadId,
    eventType: "sequence_step_sent",
    title: "Sequence SMS sent",
    summary: "Approved sequence SMS delivered.",
    jobId: job.id,
    enrollmentId: job.sequenceEnrollmentId,
    stepId: job.sequenceStepId,
    deliveryAttemptId: smsResult.deliveryAttemptId,
  })

  await recordSequenceEnrollmentChannelEvent(admin, {
    enrollmentId: job.sequenceEnrollmentId,
    enrollmentStepId: job.sequenceStepId,
    leadId: job.leadId,
    channel: "sms",
    eventKind: "sms_sent",
    title: "SMS Sent",
    summary: payload.body.slice(0, 120),
    metadata: {
      job_id: job.id,
      delivery_attempt_id: smsResult.deliveryAttemptId,
      message_id: smsResult.messageId,
    },
  })

  void (async () => {
    try {
      const { fanInGrowthObjectiveSequenceEvent } = await import(
        "@/lib/growth/objectives/growth-objective-sequence-fan-in"
      )
      await fanInGrowthObjectiveSequenceEvent(admin, {
        leadId: job.leadId,
        signalType: "sms_sent",
        enrollmentId: job.sequenceEnrollmentId,
        stepId: job.sequenceStepId,
        deliveryAttemptId: smsResult.deliveryAttemptId,
      })
    } catch {
      // Best-effort objective fan-in.
    }
  })()

  await advanceGrowthSequenceEnrollmentAfterStep(admin, {
    enrollmentStepId: job.sequenceStepId,
    actingUserId: input.auditActorUserId,
    actingUserEmail: input.actingUserEmail,
  })

  return {
    ok: true,
    jobId: updated.id,
    status: updated.status,
    deliveryAttemptId: smsResult.deliveryAttemptId,
  }
}
