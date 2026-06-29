/**
 * GE-AIOS-SDR-2C — Map canonical revenue outcomes → closed-loop learning types (client-safe).
 */

import type {
  GrowthLearningChannel,
  GrowthLearningOutcomeSource,
  GrowthLearningOutcomeType,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type {
  RevenueOutcomeChannel,
  RevenueOutcomeResult,
} from "@/lib/growth/revenue-outcomes/revenue-outcome-types"

export type RevenueOutcomeLearningMapping = {
  source: GrowthLearningOutcomeSource
  outcomeType: GrowthLearningOutcomeType
  signalStrength: number
}

const CHANNEL_SOURCE: Record<RevenueOutcomeChannel, GrowthLearningOutcomeSource> = {
  email: "email",
  sms: "sms",
  call: "call",
  voice_drop: "voice_drop",
  meeting: "meeting",
  campaign: "campaign",
  lead: "workflow_agent",
  human: "human_approval",
  linkedin: "email",
  video: "video",
}

const LEARNING_CHANNEL: Partial<Record<RevenueOutcomeChannel, GrowthLearningChannel>> = {
  email: "email",
  sms: "sms",
  call: "call",
  voice_drop: "voice_drop",
  video: "video",
  linkedin: "linkedin_manual",
}

export function resolveRevenueOutcomeLearningChannel(
  channel: RevenueOutcomeChannel,
): GrowthLearningChannel | undefined {
  return LEARNING_CHANNEL[channel]
}

export function mapRevenueOutcomeToLearning(input: {
  channel: RevenueOutcomeChannel
  outcome: RevenueOutcomeResult
}): RevenueOutcomeLearningMapping {
  const source = CHANNEL_SOURCE[input.channel] ?? "workflow_agent"

  const byOutcome: Partial<Record<RevenueOutcomeResult, RevenueOutcomeLearningMapping>> = {
    replied: { source: input.channel === "sms" ? "sms" : "email", outcomeType: "reply", signalStrength: 0.86 },
    bounced: { source: "email", outcomeType: "bounce", signalStrength: 0.82 },
    unsubscribed: { source: "email", outcomeType: "unsubscribe", signalStrength: 0.88 },
    suppressed: { source: "email", outcomeType: "unsubscribe", signalStrength: 0.85 },
    booked: { source: "meeting", outcomeType: "meeting_booked", signalStrength: 0.92 },
    no_show: { source: "meeting", outcomeType: "no_response", signalStrength: 0.75 },
    opened: { source: input.channel === "sms" ? "sms" : "email", outcomeType: "viewed", signalStrength: 0.55 },
    clicked: { source: input.channel === "sms" ? "sms" : "email", outcomeType: "clicked", signalStrength: 0.65 },
    failed: { source, outcomeType: "failed", signalStrength: 0.72 },
    declined: { source: "call", outcomeType: "negative_intent", signalStrength: 0.78 },
    disqualified: { source: "workflow_agent", outcomeType: "rejected", signalStrength: 0.88 },
    rejected: { source: "human_approval", outcomeType: "rejected", signalStrength: 0.9 },
    approved: { source: "human_approval", outcomeType: "approved", signalStrength: 0.9 },
    cancelled: { source, outcomeType: "cancelled", signalStrength: 0.7 },
    exited: { source: "sequence", outcomeType: "cancelled", signalStrength: 0.68 },
    skipped: { source, outcomeType: "cancelled", signalStrength: 0.6 },
    customer: { source: "customer_lifecycle", outcomeType: "converted", signalStrength: 0.95 },
    qualified: { source: "workflow_agent", outcomeType: "completed", signalStrength: 0.75 },
    no_answer: { source: "call", outcomeType: "no_response", signalStrength: 0.62 },
    voicemail: { source: "call", outcomeType: "no_response", signalStrength: 0.58 },
    busy: { source: "call", outcomeType: "no_response", signalStrength: 0.6 },
    connected: { source: "call", outcomeType: "completed", signalStrength: 0.8 },
    completed: {
      source: input.channel === "meeting" ? "meeting" : source,
      outcomeType: "completed",
      signalStrength: 0.78,
    },
    enrolled: { source: "sequence", outcomeType: "completed", signalStrength: 0.74 },
    delivered: { source, outcomeType: "completed", signalStrength: 0.7 },
    sent: { source, outcomeType: "completed", signalStrength: 0.65 },
    rescheduled: { source: "meeting", outcomeType: "completed", signalStrength: 0.72 },
  }

  return (
    byOutcome[input.outcome] ?? {
      source,
      outcomeType: "completed",
      signalStrength: 0.7,
    }
  )
}
