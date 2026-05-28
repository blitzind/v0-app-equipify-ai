/** Risk scoring — deterministic from objections, competitor, escalation patterns. */

import type { VoiceRevenueIntelligenceRiskItem } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"

const RISK_EVENT_WEIGHTS: Record<string, number> = {
  pricing_objection: 12,
  budget_concern: 14,
  competitor_mention: 16,
  cancellation_risk: 20,
  escalation_pattern: 18,
  negative_sentiment: 10,
}

export function scoreDealRisk(input: {
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  objectionCount: number
  escalationCount: number
  relationshipStatus: string
}): number {
  const { memoryEvents, objectionCount, escalationCount, relationshipStatus } = input
  let score = 0

  for (const event of memoryEvents) {
    score += RISK_EVENT_WEIGHTS[event.memoryType] ?? 0
  }

  score += Math.min(objectionCount * 4, 16)
  score += Math.min(escalationCount * 8, 24)

  if (relationshipStatus === "at_risk") score += 20
  if (relationshipStatus === "escalated") score += 24
  if (relationshipStatus === "dormant") score += 10

  return Math.max(0, Math.min(100, score))
}

export function buildTopRisks(
  memoryEvents: VoiceRelationshipMemoryEventPublicView[],
  limit = 3,
): VoiceRevenueIntelligenceRiskItem[] {
  const riskTypes = new Set([
    "pricing_objection",
    "budget_concern",
    "competitor_mention",
    "cancellation_risk",
    "escalation_pattern",
    "negative_sentiment",
  ])

  return memoryEvents
    .filter((event) => riskTypes.has(event.memoryType))
    .map((event) => ({
      id: event.id,
      title: event.memoryType.replace(/_/g, " "),
      eventType:
        event.memoryType === "competitor_mention"
          ? ("competitor_risk_active" as const)
          : event.memoryType === "budget_concern" || event.memoryType === "pricing_objection"
            ? ("budget_objection_active" as const)
            : ("deal_risk_increased" as const),
      evidenceText: event.evidenceText,
      score: RISK_EVENT_WEIGHTS[event.memoryType] ?? 10,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
