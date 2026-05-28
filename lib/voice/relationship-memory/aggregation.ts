/** Cross-call profile aggregation — deterministic rollup, no CRM mutation. */

import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type {
  VoiceRelationshipSentimentTrend,
  VoiceRelationshipStatus,
} from "@/lib/voice/relationship-memory/types"

const OBJECTION_TYPES = new Set(["pricing_objection", "competitor_mention", "budget_concern"])
const BUYING_TYPES = new Set(["booking_interest", "urgency_signal", "decision_maker"])
const ESCALATION_TYPES = new Set(["escalation_pattern", "cancellation_risk", "negative_sentiment"])

export function aggregateProfileMetrics(input: {
  events: VoiceRelationshipMemoryEventPublicView[]
  callCount: number
  totalTalkTimeSeconds: number
  firstInteractionAt: string | null
  lastInteractionAt: string | null
}): {
  objectionCount: number
  buyingSignalCount: number
  escalationCount: number
  sentimentTrend: VoiceRelationshipSentimentTrend
  relationshipStatus: VoiceRelationshipStatus
} {
  const active = input.events.filter((event) => event.eventStatus === "active")
  const objectionCount = active.filter((event) => OBJECTION_TYPES.has(event.memoryType)).length
  const buyingSignalCount = active.filter((event) => BUYING_TYPES.has(event.memoryType)).length
  const escalationCount = active.filter((event) => ESCALATION_TYPES.has(event.memoryType)).length

  const positive = active.filter((event) => event.memoryType === "positive_sentiment").length
  const negative = active.filter((event) => event.memoryType === "negative_sentiment").length

  let sentimentTrend: VoiceRelationshipSentimentTrend = "unknown"
  if (positive > negative + 1) sentimentTrend = "improving"
  else if (negative > positive + 1) sentimentTrend = "declining"
  else if (positive > 0 && negative > 0) sentimentTrend = "volatile"
  else if (positive > 0 || negative > 0) sentimentTrend = "stable"

  let relationshipStatus: VoiceRelationshipStatus = "new"
  if (input.callCount >= 1) relationshipStatus = "active"
  if (buyingSignalCount >= 2) relationshipStatus = "nurturing"
  if (escalationCount >= 2 || objectionCount >= 4) relationshipStatus = "at_risk"
  if (escalationCount >= 3) relationshipStatus = "escalated"
  if (
    input.lastInteractionAt &&
    Date.now() - Date.parse(input.lastInteractionAt) > 45 * 24 * 60 * 60 * 1000
  ) {
    relationshipStatus = "dormant"
  }

  return {
    objectionCount,
    buyingSignalCount,
    escalationCount,
    sentimentTrend,
    relationshipStatus,
  }
}

export function detectRecurringIssues(events: VoiceRelationshipMemoryEventPublicView[]): string[] {
  const counts = new Map<string, number>()
  for (const event of events) {
    if (event.eventStatus !== "active") continue
    counts.set(event.memoryType, (counts.get(event.memoryType) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([type]) => type.replace(/_/g, " "))
}
