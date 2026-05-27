import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthAttributionEngagementTier } from "@/lib/growth/tracking/tracking-types"
import { isHighEngagementTier } from "@/lib/growth/tracking/engagement-score"

export async function recordEmailOpenedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    deliveryAttemptId: string
    deviceType?: string | null
    occurredAt?: string
  },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "email_opened",
    title: "Email opened",
    summary: input.deviceType ? `Opened on ${input.deviceType}` : "First-party open tracking recorded.",
    payload: {
      delivery_attempt_id: input.deliveryAttemptId,
      device_type: input.deviceType ?? null,
      source: "growth_tracking",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordEmailClickedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    deliveryAttemptId: string
    destinationHost: string
    deviceType?: string | null
    occurredAt?: string
  },
): Promise<void> {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "email_clicked",
    title: "Email link clicked",
    summary: `Clicked link to ${input.destinationHost}`,
    payload: {
      delivery_attempt_id: input.deliveryAttemptId,
      destination_host: input.destinationHost,
      device_type: input.deviceType ?? null,
      source: "growth_tracking",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordEngagementIncreasedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    previousScore: number
    nextScore: number
    previousTier: GrowthAttributionEngagementTier
    nextTier: GrowthAttributionEngagementTier
    occurredAt?: string
  },
): Promise<void> {
  if (input.nextScore <= input.previousScore) return

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "engagement_increased",
    title: "Engagement increased",
    summary: `Score rose from ${input.previousScore} to ${input.nextScore} (${input.previousTier} → ${input.nextTier}).`,
    payload: {
      previous_score: input.previousScore,
      next_score: input.nextScore,
      previous_tier: input.previousTier,
      next_tier: input.nextTier,
      source: "growth_tracking",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordHighEngagementDetectedTimelineEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    score: number
    tier: GrowthAttributionEngagementTier
    occurredAt?: string
  },
): Promise<void> {
  if (!isHighEngagementTier(input.tier)) return

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "high_engagement_detected",
    title: "High engagement detected",
    summary: `Lead reached ${input.tier} tier with score ${input.score}.`,
    payload: {
      score: input.score,
      tier: input.tier,
      source: "growth_tracking",
    },
    occurredAt: input.occurredAt,
  })
}

export async function recordAttributionTimelineEvents(
  admin: SupabaseClient,
  input: {
    leadId: string
    previousScore: number
    nextScore: number
    previousTier: GrowthAttributionEngagementTier
    nextTier: GrowthAttributionEngagementTier
    occurredAt?: string
  },
): Promise<void> {
  await recordEngagementIncreasedTimelineEvent(admin, input)
  if (isHighEngagementTier(input.nextTier) && !isHighEngagementTier(input.previousTier)) {
    await recordHighEngagementDetectedTimelineEvent(admin, {
      leadId: input.leadId,
      score: input.nextScore,
      tier: input.nextTier,
      occurredAt: input.occurredAt,
    })
  }
}
