import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createReplyIntelligenceEvent } from "@/lib/growth/inbox/reply-events"
import { pauseGrowthSequenceEnrollment } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthInboxSyncTimelineEventType } from "@/lib/growth/inbox-sync/inbox-sync-types"

function platformTimelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

export async function recordInboxSyncPlatformEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthInboxSyncTimelineEventType
    title: string
    summary?: string
    threadId?: string | null
    leadId?: string | null
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await platformTimelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    payload: {
      ...(input.payload ?? {}),
      thread_id: input.threadId ?? null,
      lead_id: input.leadId ?? null,
      source: "growth_inbox_sync",
    },
  })
  if (error) throw new Error(error.message)
}

export async function recordInboxSyncLeadEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: GrowthInboxSyncTimelineEventType
    title: string
    summary?: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType,
    title: input.title,
    summary: input.summary,
    payload: {
      ...(input.payload ?? {}),
      source: "growth_inbox_sync",
    },
  })
}

export async function recordSequenceExitCandidate(
  admin: SupabaseClient,
  input: {
    threadId: string
    leadId: string
    sequenceEnrollmentId: string
    reason: string
  },
): Promise<void> {
  await createReplyIntelligenceEvent(admin, {
    thread_id: input.threadId,
    event_type: "sequence_exit_candidate",
    severity: "high",
    title: "Sequence exit review recommended",
    description: "Inbound reply detected on active sequence — human review required before exit.",
    metadata: {
      sequence_enrollment_id: input.sequenceEnrollmentId,
      reason: input.reason,
      human_review_required: true,
      auto_exit: false,
    },
  })
}

/** Pause active enrollment on inbound reply; human review still required before exit. */
export async function pauseSequenceEnrollmentOnInboundReply(
  admin: SupabaseClient,
  input: {
    leadId: string
    sequenceEnrollmentId: string
    reason?: string
  },
): Promise<void> {
  try {
    await pauseGrowthSequenceEnrollment(admin, {
      enrollmentId: input.sequenceEnrollmentId,
      leadId: input.leadId,
      pauseReason: input.reason ?? "inbound_reply_on_active_sequence",
    })
  } catch (error) {
    if (error instanceof Error && (error.message === "invalid_status" || error.message === "not_found")) {
      return
    }
    throw error
  }
}
