import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthBounceType, GrowthComplaintType } from "@/lib/growth/compliance/compliance-types"

export async function recordBounceDetectedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    bounceType: GrowthBounceType
    deliveryAttemptId: string
    summary?: string
    occurredAt?: string
  },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "bounce_detected",
    title: "Bounce detected",
    summary: input.summary ?? `${input.bounceType} bounce recorded.`,
    payload: {
      bounce_type: input.bounceType,
      delivery_attempt_id: input.deliveryAttemptId,
      source: "growth_compliance",
    },
    occurredAt: input.occurredAt,
  })

  if (input.bounceType === "hard" || input.bounceType === "blocked" || input.bounceType === "spam") {
    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.leadId,
      eventType: "hard_bounce_detected",
      title: "Hard bounce detected",
      summary: input.summary ?? "Recipient suppressed after hard bounce.",
      payload: {
        bounce_type: input.bounceType,
        delivery_attempt_id: input.deliveryAttemptId,
        source: "growth_compliance",
      },
      occurredAt: input.occurredAt,
    })
  }
}

export async function recordUnsubscribeDetectedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    scope: string
    source: string
    occurredAt?: string
  },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "unsubscribe_detected",
    title: "Unsubscribe detected",
    summary: `Unsubscribe recorded (${input.scope} scope).`,
    payload: { scope: input.scope, source: input.source, source_layer: "growth_compliance" },
    occurredAt: input.occurredAt,
  })
}

export async function recordComplaintDetectedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    complaintType: GrowthComplaintType
    deliveryAttemptId: string
    occurredAt?: string
  },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "complaint_detected",
    title: "Complaint detected",
    summary: `${input.complaintType} complaint recorded.`,
    payload: {
      complaint_type: input.complaintType,
      delivery_attempt_id: input.deliveryAttemptId,
      source: "growth_compliance",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordSuppressionAppliedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    reason: string
    occurredAt?: string
  },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "suppression_applied",
    title: "Suppression applied",
    summary: input.reason,
    payload: { reason: input.reason, source: "growth_compliance" },
    occurredAt: input.occurredAt,
  })
}

export async function recordSenderReputationDeclinedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId?: string | null
    senderAccountId: string
    score: number
    tier: string
    occurredAt?: string
  },
): Promise<void> {
  if (!input.leadId) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "sender_reputation_declined",
    title: "Sender reputation declined",
    summary: `Sender reputation at ${input.score} (${input.tier}).`,
    payload: {
      sender_account_id: input.senderAccountId,
      score: input.score,
      tier: input.tier,
      source: "growth_compliance",
    },
    occurredAt: input.occurredAt,
  })
}
