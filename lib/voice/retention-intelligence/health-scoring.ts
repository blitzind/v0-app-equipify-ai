/** Customer health scoring — deterministic from relationship + revenue signals. */

import { analyzeFollowUpHealth } from "@/lib/voice/revenue-intelligence/follow-up-health"
import { scoreDealRisk } from "@/lib/voice/revenue-intelligence/risk-scoring"
import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type { VoiceRevenueIntelligenceEventPublicView } from "@/lib/voice/revenue-intelligence/types"
import type { VoiceHealthDirection, VoiceRetentionRiskLevel } from "@/lib/voice/retention-intelligence/types"

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
}

export function scoreCustomerHealth(input: {
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  revenueEvents: VoiceRevenueIntelligenceEventPublicView[]
  objectionCount: number
  buyingSignalCount: number
  escalationCount: number
  relationshipStatus: string
  sentimentTrend: string
  lastInteractionAt: string | null
}): { score: number; direction: VoiceHealthDirection; retentionRiskLevel: VoiceRetentionRiskLevel } {
  const {
    memoryEvents,
    revenueEvents,
    objectionCount,
    escalationCount,
    relationshipStatus,
    sentimentTrend,
    lastInteractionAt,
  } = input

  let score = 72
  const dealRisk = scoreDealRisk({
    memoryEvents,
    objectionCount,
    escalationCount,
    relationshipStatus,
  })
  score -= Math.min(dealRisk * 0.35, 28)

  const positiveSignals = memoryEvents.filter((event) =>
    ["positive_sentiment", "booking_interest", "urgency_signal"].includes(event.memoryType),
  ).length
  const negativeSignals = memoryEvents.filter((event) =>
    ["negative_sentiment", "cancellation_risk", "escalation_pattern"].includes(event.memoryType),
  ).length

  score += Math.min(positiveSignals * 4, 12)
  score -= Math.min(negativeSignals * 5, 20)

  const revenueRiskCount = revenueEvents.filter((event) =>
    ["deal_risk_increased", "renewal_risk", "budget_objection_active"].includes(event.eventType),
  ).length
  score -= Math.min(revenueRiskCount * 6, 18)

  const followUp = analyzeFollowUpHealth({ lastInteractionAt, memoryEvents })
  if (followUp.status === "overdue") score -= 14
  else if (followUp.status === "due_soon") score -= 6

  const days = daysSince(lastInteractionAt)
  if (days != null && days >= 30) score -= 10
  else if (days != null && days <= 7) score += 4

  if (sentimentTrend === "improving") score += 6
  if (sentimentTrend === "declining" || sentimentTrend === "volatile") score -= 8
  if (relationshipStatus === "at_risk" || relationshipStatus === "escalated") score -= 16
  if (relationshipStatus === "dormant") score -= 12

  score = Math.max(0, Math.min(100, Math.round(score)))

  let direction: VoiceHealthDirection = "stable"
  if (score >= 75 && positiveSignals > negativeSignals) direction = "improving"
  else if (score <= 40 || relationshipStatus === "at_risk") direction = "at_risk"
  else if (score <= 55 || negativeSignals > positiveSignals + 1) direction = "declining"

  let retentionRiskLevel: VoiceRetentionRiskLevel = "low"
  if (score <= 35 || relationshipStatus === "escalated") retentionRiskLevel = "critical"
  else if (score <= 50 || relationshipStatus === "at_risk") retentionRiskLevel = "elevated"
  else if (score <= 65 || dealRisk >= 40) retentionRiskLevel = "moderate"

  return { score, direction, retentionRiskLevel }
}
