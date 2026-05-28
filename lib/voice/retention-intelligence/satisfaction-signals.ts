/** Satisfaction + unresolved issue signals. */

import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type {
  VoiceRetentionSatisfactionIndicator,
} from "@/lib/voice/retention-intelligence/types"

export function buildSatisfactionIndicators(
  memoryEvents: VoiceRelationshipMemoryEventPublicView[],
  limit = 5,
): VoiceRetentionSatisfactionIndicator[] {
  const indicators: VoiceRetentionSatisfactionIndicator[] = []

  for (const event of memoryEvents) {
    if (event.memoryType === "positive_sentiment") {
      indicators.push({
        id: event.id,
        tone: "positive",
        summary: "Satisfaction signal",
        evidenceText: event.evidenceText,
      })
    }
    if (event.memoryType === "negative_sentiment") {
      indicators.push({
        id: event.id,
        tone: "negative",
        summary: "Dissatisfaction signal",
        evidenceText: event.evidenceText,
      })
    }
  }

  return indicators.slice(0, limit)
}

export function collectUnresolvedIssues(
  memoryEvents: VoiceRelationshipMemoryEventPublicView[],
  limit = 5,
): string[] {
  return memoryEvents
    .filter((event) =>
      [
        "pricing_objection",
        "budget_concern",
        "competitor_mention",
        "cancellation_risk",
        "escalation_pattern",
        "follow_up_request",
      ].includes(event.memoryType),
    )
    .map((event) => event.evidenceText)
    .slice(0, limit)
}

export function countUnresolvedIssueEvents(eventTypes: string[]): number {
  return eventTypes.filter((type) =>
    ["unresolved_issue_active", "service_gap_detected", "follow_up_needed"].includes(type),
  ).length
}
