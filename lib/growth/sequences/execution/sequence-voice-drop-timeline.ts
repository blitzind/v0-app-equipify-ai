import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { persistMultiChannelTimelineEvent } from "@/lib/growth/revenue-intelligence/multi-channel-activity-timeline"
import { recordSequenceEnrollmentChannelEvent } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-repository"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"
import { GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER } from "@/lib/growth/sequences/sequence-voice-drop-step-types"

export type SequenceVoiceDropTimelineInput = {
  leadId: string
  enrollmentId: string
  stepId?: string | null
  jobId?: string | null
  campaignId?: string | null
  recipientId?: string | null
  deliveryAttemptId?: string | null
  summary?: string | null
  occurredAt?: string
}

export async function emitSequenceVoiceDropTimelineEvent(
  admin: SupabaseClient,
  input: SequenceVoiceDropTimelineInput & {
    eventType:
      | "voice_drop_queued"
      | "voice_drop_attempted"
      | "voice_drop_delivered"
      | "voice_drop_failed"
      | "voice_drop_answered"
  },
): Promise<void> {
  const payload = {
    sequence_enrollment_id: input.enrollmentId,
    sequence_step_id: input.stepId ?? null,
    sequence_execution_job_id: input.jobId ?? null,
    voice_drop_campaign_id: input.campaignId ?? null,
    voice_drop_recipient_id: input.recipientId ?? null,
    voice_drop_delivery_attempt_id: input.deliveryAttemptId ?? null,
    qa_marker: GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER,
    source: "growth_sequence_voice_drop_vd_2",
  }

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType as GrowthLeadTimelineEventType,
    title: sequenceVoiceDropTimelineTitle(input.eventType),
    summary: input.summary ?? sequenceVoiceDropTimelineTitle(input.eventType),
    payload,
    occurredAt: input.occurredAt,
  })

  if (input.eventType === "voice_drop_delivered" || input.eventType === "voice_drop_answered") {
    await recordSequenceEnrollmentChannelEvent(admin, {
      enrollmentId: input.enrollmentId,
      enrollmentStepId: input.stepId ?? null,
      leadId: input.leadId,
      channel: "voice_drop",
      eventKind: input.eventType === "voice_drop_answered" ? "voice_drop_answered" : "voice_drop_delivered",
      title: sequenceVoiceDropTimelineTitle(input.eventType),
      summary: input.summary,
      metadata: payload,
      occurredAt: input.occurredAt,
    })

    await persistMultiChannelTimelineEvent(admin, {
      leadId: input.leadId,
      channel: "call",
      eventKind: input.eventType,
      eventSource: "sequence_voice_drop",
      title: sequenceVoiceDropTimelineTitle(input.eventType),
      summary: input.summary ?? sequenceVoiceDropTimelineTitle(input.eventType),
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      payload,
    })
  }
}

function sequenceVoiceDropTimelineTitle(
  eventType: SequenceVoiceDropTimelineInput["eventType"] | string,
): string {
  switch (eventType) {
    case "voice_drop_queued":
      return "Voice drop queued"
    case "voice_drop_attempted":
      return "Voice drop attempted"
    case "voice_drop_delivered":
      return "Voice drop delivered"
    case "voice_drop_failed":
      return "Voice drop failed"
    case "voice_drop_answered":
      return "Voice drop answered (human)"
    default:
      return "Voice drop update"
  }
}
