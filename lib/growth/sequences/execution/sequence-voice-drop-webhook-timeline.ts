import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { emitSequenceVoiceDropTimelineEvent } from "@/lib/growth/sequences/execution/sequence-voice-drop-timeline"
import type { VoiceDropDeliveryAttemptPublicView } from "@/lib/voice/voice-drops/types"
import type { VoiceDropStatusWebhookPlan } from "@/lib/voice/voice-drops/twilio-voice-drop-status-mapping"

type SequenceVoiceDropLinkage = {
  leadId: string
  enrollmentId: string
  stepId: string | null
  jobId: string | null
  campaignId: string | null
}

function readSequenceLinkage(metadata: Record<string, unknown> | undefined): SequenceVoiceDropLinkage | null {
  if (!metadata) return null
  const leadId = metadata.lead_id ? String(metadata.lead_id) : null
  const enrollmentId = metadata.sequence_enrollment_id ? String(metadata.sequence_enrollment_id) : null
  if (!leadId || !enrollmentId) return null
  return {
    leadId,
    enrollmentId,
    stepId: metadata.sequence_step_id ? String(metadata.sequence_step_id) : null,
    jobId: metadata.sequence_execution_job_id ? String(metadata.sequence_execution_job_id) : null,
    campaignId: metadata.voice_drop_campaign_id
      ? String(metadata.voice_drop_campaign_id)
      : metadata.sequence_voice_drop_campaign_id
        ? String(metadata.sequence_voice_drop_campaign_id)
        : null,
  }
}

export async function maybeEmitSequenceVoiceDropWebhookTimeline(
  admin: SupabaseClient,
  input: {
    attempt: VoiceDropDeliveryAttemptPublicView
    plan: Extract<VoiceDropStatusWebhookPlan, { kind: "interim" | "finalized" }>
    payload: Record<string, unknown>
  },
): Promise<void> {
  const linkage = readSequenceLinkage(input.attempt.metadata)
  if (!linkage) return

  const answeredBy = String(input.payload.AnsweredBy ?? input.plan.attemptPatch.metadata?.answeredBy ?? "")
  const isHumanAnswered = answeredBy.toLowerCase() === "human"

  if (isHumanAnswered) {
    await emitSequenceVoiceDropTimelineEvent(admin, {
      eventType: "voice_drop_answered",
      leadId: linkage.leadId,
      enrollmentId: linkage.enrollmentId,
      stepId: linkage.stepId,
      jobId: linkage.jobId,
      campaignId: linkage.campaignId,
      recipientId: input.attempt.recipientId,
      deliveryAttemptId: input.attempt.id,
      summary: "Human answered — voicemail playback suppressed per AMD policy.",
    })
  }

  if (input.plan.kind !== "finalized") return

  if (input.plan.attemptPatch.status === "delivered") {
    await emitSequenceVoiceDropTimelineEvent(admin, {
      eventType: "voice_drop_delivered",
      leadId: linkage.leadId,
      enrollmentId: linkage.enrollmentId,
      stepId: linkage.stepId,
      jobId: linkage.jobId,
      campaignId: linkage.campaignId,
      recipientId: input.attempt.recipientId,
      deliveryAttemptId: input.attempt.id,
      summary: "Voice drop delivery finalized via Twilio status callback.",
    })
    return
  }

  if (input.plan.attemptPatch.status === "failed") {
    await emitSequenceVoiceDropTimelineEvent(admin, {
      eventType: "voice_drop_failed",
      leadId: linkage.leadId,
      enrollmentId: linkage.enrollmentId,
      stepId: linkage.stepId,
      jobId: linkage.jobId,
      campaignId: linkage.campaignId,
      recipientId: input.attempt.recipientId,
      deliveryAttemptId: input.attempt.id,
      summary: input.plan.attemptPatch.failureReason ?? "Voice drop delivery failed.",
    })
  }
}
