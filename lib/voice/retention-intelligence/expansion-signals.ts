/** Expansion signal detection — passive, evidence-backed. */

import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type { VoiceRevenueIntelligenceEventPublicView } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceRetentionExpansionSignalItem } from "@/lib/voice/retention-intelligence/types"

export function detectExpansionSignals(
  memoryEvents: VoiceRelationshipMemoryEventPublicView[],
  revenueEvents: VoiceRevenueIntelligenceEventPublicView[],
  limit = 5,
): VoiceRetentionExpansionSignalItem[] {
  const signals: VoiceRetentionExpansionSignalItem[] = []

  for (const event of memoryEvents) {
    if (event.memoryType === "booking_interest" || event.memoryType === "urgency_signal") {
      signals.push({
        id: event.id,
        title: "Expansion interest",
        eventType: "expansion_signal",
        evidenceText: event.evidenceText,
        confidenceScore: event.confidenceScore,
      })
    }
    if (event.memoryType === "positive_sentiment") {
      signals.push({
        id: event.id,
        title: "Positive sentiment",
        eventType: "relationship_strengthened",
        evidenceText: event.evidenceText,
        confidenceScore: event.confidenceScore,
      })
    }
    if (event.memoryType === "decision_maker") {
      signals.push({
        id: event.id,
        title: "Decision maker engaged",
        eventType: "upsell_signal",
        evidenceText: event.evidenceText,
        confidenceScore: event.confidenceScore,
      })
    }
  }

  for (const event of revenueEvents) {
    if (event.eventType === "expansion_signal" || event.eventType === "buying_intent_increased") {
      signals.push({
        id: event.id,
        title: event.eventType.replace(/_/g, " "),
        eventType: "expansion_signal",
        evidenceText: event.evidenceText,
        confidenceScore: event.confidenceScore,
      })
    }
    if (event.eventType === "ready_to_book") {
      signals.push({
        id: event.id,
        title: "Ready to expand engagement",
        eventType: "cross_sell_signal",
        evidenceText: event.evidenceText,
        confidenceScore: event.confidenceScore,
      })
    }
  }

  return signals.sort((a, b) => b.confidenceScore - a.confidenceScore).slice(0, limit)
}

export function countExpansionSignalEvents(eventTypes: string[]): number {
  return eventTypes.filter((type) =>
    ["expansion_signal", "cross_sell_signal", "upsell_signal", "referral_signal", "renewal_confidence_increased"].includes(
      type,
    ),
  ).length
}
