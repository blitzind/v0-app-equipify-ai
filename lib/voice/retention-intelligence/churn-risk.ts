/** Churn + renewal risk detection — evidence-backed. */

import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type { VoiceRevenueIntelligenceEventPublicView } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRetentionRiskItem } from "@/lib/voice/retention-intelligence/types"

const CHURN_WEIGHTS: Record<string, number> = {
  cancellation_risk: 22,
  negative_sentiment: 14,
  escalation_pattern: 18,
  competitor_mention: 12,
  pricing_objection: 10,
}

export function detectChurnRiskSignals(
  memoryEvents: VoiceRelationshipMemoryEventPublicView[],
  revenueEvents: VoiceRevenueIntelligenceEventPublicView[],
  limit = 5,
): VoiceRetentionRiskItem[] {
  const fromMemory = memoryEvents
    .filter((event) =>
      ["cancellation_risk", "negative_sentiment", "escalation_pattern", "competitor_mention"].includes(
        event.memoryType,
      ),
    )
    .map((event) => ({
      id: event.id,
      title: event.memoryType.replace(/_/g, " "),
      eventType:
        event.memoryType === "cancellation_risk"
          ? ("renewal_risk" as const)
          : ("churn_risk_increased" as const),
      evidenceText: event.evidenceText,
      score: CHURN_WEIGHTS[event.memoryType] ?? 10,
    }))

  const fromRevenue = revenueEvents
    .filter((event) => ["renewal_risk", "deal_risk_increased", "competitor_risk_active"].includes(event.eventType))
    .map((event) => ({
      id: event.id,
      title: event.eventType.replace(/_/g, " "),
      eventType: "churn_risk_increased" as const,
      evidenceText: event.evidenceText,
      score: 16,
    }))

  return [...fromMemory, ...fromRevenue].sort((a, b) => b.score - a.score).slice(0, limit)
}

export function countChurnRiskEvents(eventTypes: string[]): number {
  return eventTypes.filter((type) =>
    ["churn_risk_increased", "renewal_risk", "dissatisfaction_signal", "escalation_required"].includes(type),
  ).length
}
