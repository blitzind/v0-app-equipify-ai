import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildSequenceSchedulerIdempotencyKey } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import { advanceGrowthSequenceEnrollmentAfterStep } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthSequenceTouchTimeline } from "@/lib/growth/sequence-pattern-repository"
import { evaluateSequenceVoiceDropFatigueGate } from "@/lib/growth/sequence-orchestration/sequence-voice-drop-fatigue"
import {
  recordSequenceExecutionJobAuditEvent,
  recordSequenceExecutionTimelineEvent,
} from "@/lib/growth/sequences/execution/sequence-execution-events"
import type { GrowthSequenceExecutionRunResult } from "@/lib/growth/sequences/execution/sequence-execution-types"
import type { GrowthSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { updateSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import {
  buildSequenceExecutionVoiceDropPayload,
  evaluateSequenceVoiceDropExecutionPreflight,
} from "@/lib/growth/sequences/execution/sequence-voice-drop-send-builder"
import { emitSequenceVoiceDropTimelineEvent } from "@/lib/growth/sequences/execution/sequence-voice-drop-timeline"
import { GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER } from "@/lib/growth/sequences/sequence-voice-drop-step-types"
import { evaluateAndAuditCompliance } from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { mapComplianceResultToRecipientPatch } from "@/lib/voice/compliance-orchestration/compliance-decision-engine"
import { resolveVoiceDropProvider } from "@/lib/voice/voice-drops/provider-registry"
import {
  addVoiceDropRecipient,
  appendVoiceDropDeliveryAttempt,
  recentDeliveryForPhone,
  updateVoiceDropRecipient,
} from "@/lib/voice/repository/voice-drop-repository"
import { getVoiceDropCampaign } from "@/lib/voice/repository/voice-drop-repository"
import { VOICE_DROP_FREQUENCY_CAP_DAYS } from "@/lib/voice/voice-drops/types"

export async function runSequenceVoiceDropExecutionJob(
  admin: SupabaseClient,
  input: {
    job: GrowthSequenceExecutionJob
    actingUserId: string
    actingUserEmail: string
    auditActorUserId: string
  },
): Promise<GrowthSequenceExecutionRunResult> {
  const { job } = input
  if (!job.sequenceStepId) {
    return { ok: false, jobId: job.id, status: "blocked", message: "missing_step", blocked: true }
  }

  const preflight = await evaluateSequenceVoiceDropExecutionPreflight(admin, {
    sequenceEnrollmentId: job.sequenceEnrollmentId,
    leadId: job.leadId,
  })
  if (!preflight.allowed) {
    await updateSequenceExecutionJob(admin, job.id, {
      status: "blocked",
      lastError: preflight.code,
      lockedAt: null,
      lockedBy: null,
    })
    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId: job.id,
      eventType: "job_blocked",
      title: "Voice drop execution blocked",
      description: preflight.message,
      severity: "medium",
      metadata: { code: preflight.code, qa_marker: GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER },
    })
    return { ok: false, jobId: job.id, status: "blocked", message: preflight.code, blocked: true }
  }

  const payload =
    job.voiceDropCampaignId
      ? await buildSequenceExecutionVoiceDropPayload(admin, {
          sequenceStepId: job.sequenceStepId,
          leadId: job.leadId,
          sequenceEnrollmentId: job.sequenceEnrollmentId,
          voiceDropCampaignId: job.voiceDropCampaignId,
        })
      : await buildSequenceExecutionVoiceDropPayload(admin, {
          sequenceStepId: job.sequenceStepId,
          leadId: job.leadId,
          sequenceEnrollmentId: job.sequenceEnrollmentId,
        })

  if ("error" in payload) {
    await updateSequenceExecutionJob(admin, job.id, {
      status: "blocked",
      lastError: payload.error,
      lockedAt: null,
      lockedBy: null,
    })
    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId: job.id,
      eventType: "job_blocked",
      title: "Voice drop execution blocked",
      description: payload.message ?? payload.error,
      severity: "medium",
      metadata: { code: payload.error, qa_marker: GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER },
    })
    return {
      ok: false,
      jobId: job.id,
      status: "blocked",
      message: payload.error,
      blocked: true,
    }
  }

  const lead = await fetchGrowthLeadById(admin, job.leadId)
  if (lead?.promotedOrganizationId) {
    const touches = await fetchGrowthSequenceTouchTimeline(admin, lead)
    const fatigue = await evaluateSequenceVoiceDropFatigueGate(admin, {
      organizationId: lead.promotedOrganizationId,
      phoneNumber: payload.toE164,
      touches,
    })
    if (!fatigue.allowed) {
      await updateSequenceExecutionJob(admin, job.id, {
        status: "blocked",
        lastError: fatigue.code,
        lockedAt: null,
        lockedBy: null,
      })
      await recordSequenceExecutionJobAuditEvent(admin, {
        jobId: job.id,
        eventType: "job_blocked",
        title: "Voice drop fatigue blocked",
        description: fatigue.message,
        severity: "medium",
        metadata: { code: fatigue.code, qa_marker: GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER },
      })
      return {
        ok: false,
        jobId: job.id,
        status: "blocked",
        message: fatigue.code,
        blocked: true,
      }
    }
  }

  const campaign = await getVoiceDropCampaign(admin, payload.organizationId, payload.voiceDropCampaignId)
  if (!campaign) {
    await updateSequenceExecutionJob(admin, job.id, {
      status: "blocked",
      lastError: "voice_drop_campaign_not_found",
      lockedAt: null,
      lockedBy: null,
    })
    return {
      ok: false,
      jobId: job.id,
      status: "blocked",
      message: "voice_drop_campaign_not_found",
      blocked: true,
    }
  }

  const capSince = new Date()
  capSince.setDate(capSince.getDate() - VOICE_DROP_FREQUENCY_CAP_DAYS)
  const recent = await recentDeliveryForPhone(
    admin,
    payload.organizationId,
    payload.toE164,
    capSince.toISOString(),
  )

  const compliance = await evaluateAndAuditCompliance(admin, {
    organizationId: payload.organizationId,
    phoneNumber: payload.toE164,
    channel: "voicemail",
    campaignType: campaign.campaignType,
    recentContactWithinCap: recent,
    createdBy: input.auditActorUserId,
  })

  if (!compliance.allowed) {
    const patch = mapComplianceResultToRecipientPatch(compliance)
    await updateSequenceExecutionJob(admin, job.id, {
      status: "blocked",
      lastError: patch.suppressionReason ?? "compliance_blocked",
      lockedAt: null,
      lockedBy: null,
    })
    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId: job.id,
      eventType: "job_blocked",
      title: "Voice drop compliance blocked",
      description: patch.suppressionReason ?? "Compliance orchestration blocked delivery.",
      severity: "medium",
      metadata: {
        compliance_decision: patch.complianceDecision,
        qa_marker: GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER,
      },
    })
    return {
      ok: false,
      jobId: job.id,
      status: "blocked",
      message: patch.suppressionReason ?? "compliance_blocked",
      blocked: true,
    }
  }

  const sequenceMetadata = {
    sequence_enrollment_id: job.sequenceEnrollmentId,
    sequence_step_id: job.sequenceStepId,
    sequence_execution_job_id: job.id,
    lead_id: job.leadId,
    voice_drop_campaign_id: payload.voiceDropCampaignId,
    qa_marker: GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER,
  }

  const recipient = await addVoiceDropRecipient(admin, {
    organizationId: payload.organizationId,
    campaignId: payload.voiceDropCampaignId,
    phoneNumber: payload.toE164,
    recipientName: null,
    status: "pending",
    renderedMessagePreview: payload.renderedMessage,
    metadata: sequenceMetadata,
  })

  await emitSequenceVoiceDropTimelineEvent(admin, {
    eventType: "voice_drop_queued",
    leadId: job.leadId,
    enrollmentId: job.sequenceEnrollmentId,
    stepId: job.sequenceStepId,
    jobId: job.id,
    campaignId: payload.voiceDropCampaignId,
    recipientId: recipient.id,
    summary: `Voice drop queued for ${payload.campaignName}.`,
  })

  const provider = resolveVoiceDropProvider(campaign.voiceProvider)
  const validation = provider.validateRecipient(payload.toE164)
  if (!validation.valid) {
    await updateVoiceDropRecipient(admin, {
      organizationId: payload.organizationId,
      recipientId: recipient.id,
      patch: { status: "suppressed", suppressionReason: validation.reason },
    })
    await updateSequenceExecutionJob(admin, job.id, {
      status: "blocked",
      lastError: validation.reason ?? "invalid_recipient",
      voiceDropRecipientId: recipient.id,
      lockedAt: null,
      lockedBy: null,
    })
    return {
      ok: false,
      jobId: job.id,
      status: "blocked",
      message: validation.reason ?? "invalid_recipient",
      blocked: true,
    }
  }

  await emitSequenceVoiceDropTimelineEvent(admin, {
    eventType: "voice_drop_attempted",
    leadId: job.leadId,
    enrollmentId: job.sequenceEnrollmentId,
    stepId: job.sequenceStepId,
    jobId: job.id,
    campaignId: payload.voiceDropCampaignId,
    recipientId: recipient.id,
    summary: `Voice drop delivery attempted via ${campaign.voiceProvider}.`,
  })

  const idempotencyKey = buildSequenceSchedulerIdempotencyKey(job.sequenceEnrollmentId, job.sequenceStepId)
  const result = await provider.queueDelivery({
    organizationId: payload.organizationId,
    campaignId: payload.voiceDropCampaignId,
    recipientId: recipient.id,
    phoneNumber: payload.toE164,
    renderedMessage: payload.renderedMessage,
    voiceId: campaign.voiceId,
  })

  const attempt = await appendVoiceDropDeliveryAttempt(admin, {
    organizationId: payload.organizationId,
    campaignId: payload.voiceDropCampaignId,
    recipientId: recipient.id,
    provider: campaign.voiceProvider,
    providerDeliveryId: result.providerDeliveryId,
    status:
      result.status === "delivered"
        ? "delivered"
        : result.status === "failed"
          ? "failed"
          : result.status === "in_progress"
            ? "in_progress"
            : "queued",
    failureReason: result.failureReason,
    metadata: {
      evidenceText: result.evidenceText,
      providerStatus: result.status,
      idempotency_key: `sequence-job:${job.id}:${idempotencyKey}`,
      ...sequenceMetadata,
    },
  })

  const recipientStatus =
    result.status === "delivered" ? "delivered" : result.status === "failed" ? "failed" : "queued"

  await updateVoiceDropRecipient(admin, {
    organizationId: payload.organizationId,
    recipientId: recipient.id,
    patch: {
      status: recipientStatus,
      deliveryAttemptCount: recipient.deliveryAttemptCount + 1,
      lastAttemptAt: new Date().toISOString(),
    },
  })

  if (result.status === "failed") {
    await emitSequenceVoiceDropTimelineEvent(admin, {
      eventType: "voice_drop_failed",
      leadId: job.leadId,
      enrollmentId: job.sequenceEnrollmentId,
      stepId: job.sequenceStepId,
      jobId: job.id,
      campaignId: payload.voiceDropCampaignId,
      recipientId: recipient.id,
      deliveryAttemptId: attempt.id,
      summary: result.failureReason ?? result.evidenceText ?? "Voice drop delivery failed.",
    })
    await updateSequenceExecutionJob(admin, job.id, {
      status: "failed",
      lastError: result.failureReason ?? "voice_drop_failed",
      voiceDropCampaignId: payload.voiceDropCampaignId,
      voiceDropRecipientId: recipient.id,
      voiceDropDeliveryAttemptId: attempt.id,
      lockedAt: null,
      lockedBy: null,
      attemptCount: job.attemptCount + 1,
    })
    return {
      ok: false,
      jobId: job.id,
      status: "failed",
      message: result.failureReason ?? "voice_drop_failed",
    }
  }

  const updated = await updateSequenceExecutionJob(admin, job.id, {
    status: "sent",
    voiceDropCampaignId: payload.voiceDropCampaignId,
    voiceDropRecipientId: recipient.id,
    voiceDropDeliveryAttemptId: attempt.id,
    deliveryAttemptId: attempt.id,
    lastError: null,
    lockedAt: null,
    lockedBy: null,
    attemptCount: job.attemptCount + 1,
  })

  if (result.status === "delivered") {
    await emitSequenceVoiceDropTimelineEvent(admin, {
      eventType: "voice_drop_delivered",
      leadId: job.leadId,
      enrollmentId: job.sequenceEnrollmentId,
      stepId: job.sequenceStepId,
      jobId: job.id,
      campaignId: payload.voiceDropCampaignId,
      recipientId: recipient.id,
      deliveryAttemptId: attempt.id,
      summary: result.evidenceText ?? "Voice drop delivered to voicemail.",
    })
  }

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: job.id,
    eventType: "job_sent",
    title: "Voice drop execution job sent",
    description: "Sequence voice drop queued via certified Twilio provider after human approval.",
    metadata: {
      voice_drop_campaign_id: payload.voiceDropCampaignId,
      voice_drop_recipient_id: recipient.id,
      voice_drop_delivery_attempt_id: attempt.id,
      provider_delivery_id: result.providerDeliveryId,
      qa_marker: GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER,
    },
  })

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: job.leadId,
    eventType: "sequence_step_sent",
    title: "Sequence voice drop sent",
    summary: "Approved sequence voice drop queued for delivery.",
    jobId: job.id,
    enrollmentId: job.sequenceEnrollmentId,
    stepId: job.sequenceStepId,
    deliveryAttemptId: attempt.id,
  })

  await advanceGrowthSequenceEnrollmentAfterStep(admin, {
    enrollmentStepId: job.sequenceStepId,
    actingUserId: input.auditActorUserId,
    actingUserEmail: input.actingUserEmail,
  })

  return {
    ok: true,
    jobId: updated.id,
    status: updated.status,
    deliveryAttemptId: attempt.id,
  }
}
