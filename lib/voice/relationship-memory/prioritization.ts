/** Relationship memory prioritization — assistive scoring only. */

import type {
  VoiceRelationshipMemoryEventPublicView,
  VoiceRelationshipMemoryProfilePublicView,
  VoiceRelationshipPrioritizedInsight,
} from "@/lib/voice/relationship-memory/types"

const OBJECTION_TYPES = new Set([
  "pricing_objection",
  "competitor_mention",
  "budget_concern",
  "cancellation_risk",
])

const BUYING_TYPES = new Set(["booking_interest", "urgency_signal", "decision_maker"])

function baseScoreForType(memoryType: string): number {
  if (memoryType === "cancellation_risk") return 95
  if (memoryType === "escalation_pattern") return 90
  if (memoryType === "pricing_objection" || memoryType === "competitor_mention") return 80
  if (memoryType === "booking_interest") return 75
  if (memoryType === "negative_sentiment") return 70
  if (memoryType === "budget_concern") return 65
  return 50
}

export function scoreRelationshipMemoryInsight(input: {
  event: VoiceRelationshipMemoryEventPublicView
  profile: Pick<
    VoiceRelationshipMemoryProfilePublicView,
    "escalationCount" | "objectionCount" | "buyingSignalCount" | "totalCallCount"
  >
}): VoiceRelationshipPrioritizedInsight {
  const { event, profile } = input
  let score = baseScoreForType(event.memoryType)
  score += Math.round(event.confidenceScore * 20)
  if (OBJECTION_TYPES.has(event.memoryType)) score += Math.min(profile.objectionCount * 3, 15)
  if (BUYING_TYPES.has(event.memoryType)) score += Math.min(profile.buyingSignalCount * 2, 10)
  if (profile.escalationCount >= 2 && event.memoryType === "escalation_pattern") score += 12
  if (profile.totalCallCount >= 4 && OBJECTION_TYPES.has(event.memoryType)) score += 8

  const unresolved = OBJECTION_TYPES.has(event.memoryType) || event.memoryType === "cancellation_risk"

  return {
    id: event.id,
    title: event.memoryType.replace(/_/g, " "),
    summary: event.evidenceText.slice(0, 160),
    score: Math.min(100, score),
    memoryType: event.memoryType,
    evidenceText: event.evidenceText,
    unresolved,
  }
}

export function rankRelationshipInsights(
  events: VoiceRelationshipMemoryEventPublicView[],
  profile: VoiceRelationshipMemoryProfilePublicView,
  limit: number,
): VoiceRelationshipPrioritizedInsight[] {
  const active = events.filter((event) => event.eventStatus === "active")
  return active
    .map((event) => scoreRelationshipMemoryInsight({ event, profile }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function computeHighRiskScore(
  profile: VoiceRelationshipMemoryProfilePublicView,
  events: VoiceRelationshipMemoryEventPublicView[],
): number {
  const insights = rankRelationshipInsights(events, profile, 12)
  const unresolved = insights.filter((item) => item.unresolved)
  const top = insights[0]?.score ?? 0
  const escalationBoost = profile.escalationCount >= 2 ? 15 : 0
  const competitorBoost = events.some((e) => e.memoryType === "competitor_mention" && e.eventStatus === "active")
    ? 10
    : 0
  return Math.min(100, top + escalationBoost + competitorBoost + unresolved.length * 4)
}
