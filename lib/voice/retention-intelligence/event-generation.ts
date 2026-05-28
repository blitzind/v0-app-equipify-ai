/** Retention event generation — deterministic from memory + revenue intelligence. */

import { analyzeFollowUpHealth } from "@/lib/voice/revenue-intelligence/follow-up-health"
import { scoreCustomerHealth } from "@/lib/voice/retention-intelligence/health-scoring"
import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type { VoiceRevenueIntelligenceEventPublicView } from "@/lib/voice/revenue-intelligence/types"
import type {
  DerivedRetentionIntelligenceEventInput,
  VoiceHealthDirection,
  VoiceRetentionIntelligenceEventPublicView,
} from "@/lib/voice/retention-intelligence/types"
import { RETENTION_INTELLIGENCE_MIN_CONFIDENCE } from "@/lib/voice/retention-intelligence/types"

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
}

export function generateRetentionIntelligenceEvents(input: {
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  revenueEvents: VoiceRevenueIntelligenceEventPublicView[]
  objectionCount: number
  buyingSignalCount: number
  escalationCount: number
  relationshipStatus: string
  sentimentTrend: string
  lastInteractionAt: string | null
  sourceVoiceCallId?: string | null
}): DerivedRetentionIntelligenceEventInput[] {
  const {
    memoryEvents,
    revenueEvents,
    objectionCount,
    buyingSignalCount,
    escalationCount,
    relationshipStatus,
    sentimentTrend,
    lastInteractionAt,
    sourceVoiceCallId,
  } = input

  const events: DerivedRetentionIntelligenceEventInput[] = []
  const { direction: healthDirection, retentionRiskLevel } = scoreCustomerHealth({
    memoryEvents,
    revenueEvents,
    objectionCount,
    buyingSignalCount,
    escalationCount,
    relationshipStatus,
    sentimentTrend,
    lastInteractionAt,
  })
  const followUp = analyzeFollowUpHealth({ lastInteractionAt, memoryEvents })

  if (retentionRiskLevel === "elevated" || retentionRiskLevel === "critical") {
    events.push({
      eventType: "churn_risk_increased",
      healthDirection,
      confidenceScore: retentionRiskLevel === "critical" ? 0.88 : 0.72,
      evidenceText: `Customer health ${healthDirection.replace(/_/g, " ")} with ${retentionRiskLevel} retention risk.`,
      recommendedOperatorAction: "Schedule a retention review call — operator confirms account status manually.",
      sourceVoiceCallId,
    })
  } else if (healthDirection === "improving") {
    events.push({
      eventType: "churn_risk_reduced",
      healthDirection,
      confidenceScore: 0.65,
      evidenceText: "Recent interactions show improving relationship health indicators.",
      recommendedOperatorAction: "Reinforce value and explore expansion when appropriate — no auto-upsell.",
      sourceVoiceCallId,
    })
  }

  for (const memoryEvent of memoryEvents) {
    if (memoryEvent.memoryType === "cancellation_risk") {
      events.push({
        eventType: "renewal_risk",
        healthDirection: "at_risk",
        confidenceScore: Math.max(memoryEvent.confidenceScore, RETENTION_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Human-led renewal conversation — do not auto-change contract status.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "positive_sentiment" && buyingSignalCount >= 1) {
      events.push({
        eventType: "renewal_confidence_increased",
        healthDirection: "improving",
        confidenceScore: 0.68,
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Document satisfaction and plan proactive check-in.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "negative_sentiment") {
      events.push({
        eventType: "dissatisfaction_signal",
        healthDirection: "declining",
        confidenceScore: Math.max(memoryEvent.confidenceScore, RETENTION_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Address service concern with operator-authored follow-up.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "positive_sentiment") {
      events.push({
        eventType: "satisfaction_signal",
        healthDirection: "improving",
        confidenceScore: Math.max(memoryEvent.confidenceScore, RETENTION_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Capture testimonial or referral opportunity if operator approves.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (["pricing_objection", "budget_concern", "competitor_mention"].includes(memoryEvent.memoryType)) {
      events.push({
        eventType: "unresolved_issue_active",
        healthDirection: healthDirection === "unknown" ? "declining" : healthDirection,
        confidenceScore: Math.max(memoryEvent.confidenceScore, RETENTION_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Resolve open issue before expansion conversations.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "escalation_pattern" || memoryEvent.memoryType === "cancellation_risk") {
      events.push({
        eventType: "escalation_required",
        healthDirection: "at_risk",
        confidenceScore: Math.max(memoryEvent.confidenceScore, RETENTION_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Escalate to customer success lead — human review required.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "booking_interest" && buyingSignalCount >= 2) {
      events.push({
        eventType: "expansion_signal",
        healthDirection: "improving",
        confidenceScore: Math.max(memoryEvent.confidenceScore, RETENTION_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Explore expansion scope with operator-led discovery.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "urgency_signal") {
      events.push({
        eventType: "upsell_signal",
        healthDirection: "improving",
        confidenceScore: Math.max(memoryEvent.confidenceScore, RETENTION_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Present relevant add-ons — operator confirms fit manually.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "positive_sentiment" && sentimentTrend === "improving") {
      events.push({
        eventType: "referral_signal",
        healthDirection: "improving",
        confidenceScore: 0.62,
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Ask for referral only if operator judges timing appropriate.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }
  }

  for (const revenueEvent of revenueEvents) {
    if (revenueEvent.eventType === "expansion_signal") {
      events.push({
        eventType: "cross_sell_signal",
        healthDirection: "improving",
        confidenceScore: revenueEvent.confidenceScore,
        evidenceText: revenueEvent.evidenceText,
        recommendedOperatorAction: "Coordinate cross-sell motion with customer success — no auto-offer.",
        sourceRevenueEventId: revenueEvent.id,
      })
    }
    if (revenueEvent.eventType === "deal_stalled" && daysSince(lastInteractionAt) != null && daysSince(lastInteractionAt)! >= 14) {
      events.push({
        eventType: "service_gap_detected",
        healthDirection: "declining",
        confidenceScore: 0.7,
        evidenceText: `Engagement gap detected — ${daysSince(lastInteractionAt)} days since last interaction.`,
        recommendedOperatorAction: "Proactive service check-in — operator schedules manually.",
        sourceRevenueEventId: revenueEvent.id,
      })
    }
  }

  if (sentimentTrend === "improving" && buyingSignalCount >= 1) {
    events.push({
      eventType: "relationship_strengthened",
      healthDirection: "improving",
      confidenceScore: 0.66,
      evidenceText: "Sentiment trend improving with recent positive engagement signals.",
      recommendedOperatorAction: "Maintain cadence with value-focused touchpoints.",
      sourceVoiceCallId,
    })
  }

  if (sentimentTrend === "declining" || escalationCount >= 2) {
    events.push({
      eventType: "relationship_weakened",
      healthDirection: "declining",
      confidenceScore: 0.7,
      evidenceText: "Relationship strength declining based on sentiment and escalation patterns.",
      recommendedOperatorAction: "Diagnose root cause before proposing renewal or expansion.",
      sourceVoiceCallId,
    })
  }

  if (followUp.status === "overdue" || followUp.status === "due_soon") {
    events.push({
      eventType: "follow_up_needed",
      healthDirection: healthDirection === "unknown" ? "stable" : healthDirection,
      confidenceScore: followUp.status === "overdue" ? 0.78 : 0.65,
      evidenceText: followUp.summary,
      recommendedOperatorAction: "Place operator-led follow-up — no automated outreach.",
      sourceVoiceCallId,
    })
  }

  return events.filter((event) => event.confidenceScore >= RETENTION_INTELLIGENCE_MIN_CONFIDENCE)
}

export function inferPreviousHealthDirection(
  storedEvents: VoiceRetentionIntelligenceEventPublicView[],
): VoiceHealthDirection {
  const sorted = [...storedEvents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return sorted.find((event) => event.healthDirection !== "unknown")?.healthDirection ?? "unknown"
}
