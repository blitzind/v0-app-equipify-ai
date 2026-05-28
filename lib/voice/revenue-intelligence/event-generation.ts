/** Revenue event generation — deterministic mapping from relationship memory. */

import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import { compareBuyingStages, resolveBuyingStage } from "@/lib/voice/revenue-intelligence/buying-stage-resolver"
import { analyzeFollowUpHealth } from "@/lib/voice/revenue-intelligence/follow-up-health"
import { scoreMomentum } from "@/lib/voice/revenue-intelligence/momentum-scoring"
import { scoreDealRisk } from "@/lib/voice/revenue-intelligence/risk-scoring"
import type {
  DerivedRevenueIntelligenceEventInput,
  VoiceBuyingStage,
  VoiceRevenueIntelligenceEventPublicView,
} from "@/lib/voice/revenue-intelligence/types"
import { REVENUE_INTELLIGENCE_MIN_CONFIDENCE } from "@/lib/voice/revenue-intelligence/types"

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
}

export function generateRevenueIntelligenceEvents(input: {
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  objectionCount: number
  buyingSignalCount: number
  escalationCount: number
  relationshipStatus: string
  lastInteractionAt: string | null
  previousBuyingStage?: VoiceBuyingStage
  sourceVoiceCallId?: string | null
}): DerivedRevenueIntelligenceEventInput[] {
  const {
    memoryEvents,
    objectionCount,
    buyingSignalCount,
    escalationCount,
    relationshipStatus,
    lastInteractionAt,
    previousBuyingStage = "unknown",
    sourceVoiceCallId,
  } = input

  const events: DerivedRevenueIntelligenceEventInput[] = []
  const currentStage = resolveBuyingStage({
    memoryEvents,
    objectionCount,
    buyingSignalCount,
    escalationCount,
    relationshipStatus,
  })
  const { direction: momentumDirection } = scoreMomentum({
    memoryEvents,
    buyingSignalCount,
    objectionCount,
    escalationCount,
    daysSinceLastInteraction: daysSince(lastInteractionAt),
  })
  const riskScore = scoreDealRisk({ memoryEvents, objectionCount, escalationCount, relationshipStatus })
  const followUpHealth = analyzeFollowUpHealth({ lastInteractionAt, memoryEvents })

  const stageDelta = compareBuyingStages(previousBuyingStage, currentStage)
  if (stageDelta > 0 && currentStage !== "unknown") {
    events.push({
      eventType: "stage_progression",
      buyingStage: currentStage,
      momentumDirection,
      confidenceScore: Math.min(0.95, REVENUE_INTELLIGENCE_MIN_CONFIDENCE + 0.15),
      evidenceText: `Buying stage moved toward ${currentStage.replace(/_/g, " ")} from ${previousBuyingStage.replace(/_/g, " ")}.`,
      recommendedOperatorAction: "Confirm stage with the prospect and align next steps to current evaluation depth.",
      sourceVoiceCallId,
    })
  } else if (stageDelta < 0) {
    events.push({
      eventType: "stage_regression",
      buyingStage: currentStage,
      momentumDirection,
      confidenceScore: Math.min(0.92, REVENUE_INTELLIGENCE_MIN_CONFIDENCE + 0.12),
      evidenceText: `Buying stage regressed toward ${currentStage.replace(/_/g, " ")}.`,
      recommendedOperatorAction: "Review recent objections and re-establish value before advancing stage.",
      sourceVoiceCallId,
    })
  }

  if (currentStage === "stalled" || (daysSince(lastInteractionAt) != null && daysSince(lastInteractionAt)! >= 21)) {
    events.push({
      eventType: "deal_stalled",
      buyingStage: currentStage,
      momentumDirection,
      confidenceScore: 0.72,
      evidenceText:
        daysSince(lastInteractionAt) != null
          ? `No meaningful progression in ${daysSince(lastInteractionAt)} days.`
          : "Deal signals indicate stalled progression.",
      recommendedOperatorAction: "Schedule a re-engagement call with a concrete reason to reconnect.",
      sourceVoiceCallId,
    })
  }

  if (riskScore >= 40) {
    events.push({
      eventType: "deal_risk_increased",
      buyingStage: currentStage,
      momentumDirection,
      confidenceScore: Math.min(0.9, 0.55 + riskScore / 200),
      evidenceText: `Composite risk score ${riskScore}/100 from objections, competitor mentions, or escalation patterns.`,
      recommendedOperatorAction: "Address top objection with evidence-backed response — do not auto-close.",
      sourceVoiceCallId,
    })
  } else if (riskScore <= 20 && memoryEvents.length > 0) {
    events.push({
      eventType: "deal_risk_reduced",
      buyingStage: currentStage,
      momentumDirection,
      confidenceScore: 0.65,
      evidenceText: "Recent interactions show reduced objection and escalation pressure.",
      recommendedOperatorAction: "Capitalize on reduced friction with a concrete next-step ask.",
      sourceVoiceCallId,
    })
  }

  for (const memoryEvent of memoryEvents) {
    if (memoryEvent.memoryType === "booking_interest") {
      events.push({
        eventType: "ready_to_book",
        buyingStage: currentStage,
        momentumDirection,
        confidenceScore: Math.max(memoryEvent.confidenceScore, REVENUE_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Offer specific meeting times — operator confirms booking manually.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "decision_maker") {
      events.push({
        eventType: "decision_maker_engaged",
        buyingStage: currentStage,
        momentumDirection,
        confidenceScore: Math.max(memoryEvent.confidenceScore, REVENUE_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Map committee and confirm economic buyer before advancing stage.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "budget_concern" || memoryEvent.memoryType === "pricing_objection") {
      events.push({
        eventType: "budget_objection_active",
        buyingStage: currentStage,
        momentumDirection,
        confidenceScore: Math.max(memoryEvent.confidenceScore, REVENUE_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Validate budget constraints and reposition value — no autonomous discounting.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "competitor_mention") {
      events.push({
        eventType: "competitor_risk_active",
        buyingStage: currentStage,
        momentumDirection,
        confidenceScore: Math.max(memoryEvent.confidenceScore, REVENUE_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Prepare differentiated proof points — operator-led competitive response.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "urgency_signal" || memoryEvent.memoryType === "booking_interest") {
      events.push({
        eventType: "buying_intent_increased",
        buyingStage: currentStage,
        momentumDirection,
        confidenceScore: Math.max(memoryEvent.confidenceScore, REVENUE_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Propose a time-bound next step while intent is elevated.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "cancellation_risk") {
      events.push({
        eventType: "renewal_risk",
        buyingStage: currentStage,
        momentumDirection,
        confidenceScore: Math.max(memoryEvent.confidenceScore, REVENUE_INTELLIGENCE_MIN_CONFIDENCE),
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Escalate to retention playbook — human review required.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }

    if (memoryEvent.memoryType === "positive_sentiment" && buyingSignalCount >= 2) {
      events.push({
        eventType: "expansion_signal",
        buyingStage: currentStage,
        momentumDirection,
        confidenceScore: 0.68,
        evidenceText: memoryEvent.evidenceText,
        recommendedOperatorAction: "Explore expansion scope with operator-confirmed discovery questions.",
        sourceVoiceCallId: memoryEvent.sourceVoiceCallId,
        sourceMemoryEventId: memoryEvent.id,
      })
    }
  }

  if (followUpHealth.status === "overdue") {
    events.push({
      eventType: "follow_up_overdue",
      buyingStage: currentStage,
      momentumDirection,
      confidenceScore: 0.78,
      evidenceText: followUpHealth.summary,
      recommendedOperatorAction: "Place a follow-up call or send operator-authored recap — no auto-send.",
      sourceVoiceCallId,
    })
  }

  if (
    memoryEvents.some((event) => event.memoryType === "scheduling_preference") &&
    daysSince(lastInteractionAt) != null &&
    daysSince(lastInteractionAt)! >= 10
  ) {
    events.push({
      eventType: "timeline_slipping",
      buyingStage: currentStage,
      momentumDirection,
      confidenceScore: 0.7,
      evidenceText: "Scheduling preferences recorded but timeline is slipping without confirmed next step.",
      recommendedOperatorAction: "Re-anchor timeline with explicit date options.",
      sourceVoiceCallId,
    })
  }

  if (momentumDirection === "decelerating" || momentumDirection === "reversing") {
    events.push({
      eventType: "buying_intent_reduced",
      buyingStage: currentStage,
      momentumDirection,
      confidenceScore: 0.66,
      evidenceText: `Momentum ${momentumDirection} based on recent objection/signal balance.`,
      recommendedOperatorAction: "Diagnose blockers before pushing stage progression.",
      sourceVoiceCallId,
    })
  }

  return events.filter((event) => event.confidenceScore >= REVENUE_INTELLIGENCE_MIN_CONFIDENCE)
}

export function inferPreviousBuyingStageFromEvents(
  storedEvents: VoiceRevenueIntelligenceEventPublicView[],
): VoiceBuyingStage {
  const sorted = [...storedEvents].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return sorted.find((event) => event.buyingStage !== "unknown")?.buyingStage ?? "unknown"
}
