/** Lead signal event scoring — pure functions (client-safe). */

import type {
  LeadSignalEvent,
  LeadSignalUrgency,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"

const BASE_SCORE: Record<LeadSignalEvent["signalType"], number> = {
  reply_received: 45,
  positive_reply: 65,
  negative_reply: 20,
  meeting_requested: 80,
  meeting_booked: 85,
  meeting_completed: 90,
  meeting_no_show: 25,
  opportunity_created: 88,
  stage_advanced: 70,
  deal_won: 100,
  deal_lost: 15,
}

function urgencyFromScore(score: number): LeadSignalUrgency {
  if (score >= 90) return "urgent"
  if (score >= 75) return "high"
  if (score >= 40) return "normal"
  return "low"
}

export function scoreLeadSignalEvent(event: LeadSignalEvent): {
  signal_score: number
  urgency: LeadSignalUrgency
  routing_priority: number
} {
  const base = BASE_SCORE[event.signalType]
  const confidenceBoost = Math.round(event.confidence * 20)
  const signal_score = Math.min(100, Math.max(0, base + confidenceBoost - 10))
  const urgency = event.urgency ?? urgencyFromScore(signal_score)
  return { signal_score, urgency, routing_priority: signal_score }
}

export function applyLeadSignalScoringDefaults(event: LeadSignalEvent): LeadSignalEvent {
  const scored = scoreLeadSignalEvent(event)
  return {
    ...event,
    urgency: scored.urgency,
    metadata: {
      ...(event.metadata ?? {}),
      signal_score: scored.signal_score,
      routing_priority: scored.routing_priority,
    },
  }
}
