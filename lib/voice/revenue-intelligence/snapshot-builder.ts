/** Revenue snapshot builder — capped, windowed workspace payload. */

import { inferStageMovement, resolveBuyingStage } from "@/lib/voice/revenue-intelligence/buying-stage-resolver"
import { analyzeFollowUpHealth } from "@/lib/voice/revenue-intelligence/follow-up-health"
import { inferPreviousBuyingStageFromEvents } from "@/lib/voice/revenue-intelligence/event-generation"
import { scoreMomentum } from "@/lib/voice/revenue-intelligence/momentum-scoring"
import { buildTopRisks, scoreDealRisk } from "@/lib/voice/revenue-intelligence/risk-scoring"
import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type {
  VoiceRevenueIntelligenceBuyingSignalItem,
  VoiceRevenueIntelligenceEventPublicView,
  VoiceRevenueIntelligenceWorkspaceSnapshot,
} from "@/lib/voice/revenue-intelligence/types"
import {
  REVENUE_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT,
  VOICE_REVENUE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_REVENUE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
  VOICE_REVENUE_INTELLIGENCE_QA_MARKER,
  REVENUE_INTELLIGENCE_EVENTS_WINDOW,
} from "@/lib/voice/revenue-intelligence/types"

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return null
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000))
}

function buildBuyingSignals(
  activeEvents: VoiceRevenueIntelligenceEventPublicView[],
  memoryEvents: VoiceRelationshipMemoryEventPublicView[],
  limit: number,
): VoiceRevenueIntelligenceBuyingSignalItem[] {
  const fromRevenue = activeEvents
    .filter((event) =>
      ["buying_intent_increased", "ready_to_book", "expansion_signal", "decision_maker_engaged"].includes(
        event.eventType,
      ),
    )
    .map((event) => ({
      id: event.id,
      title: event.eventType.replace(/_/g, " "),
      eventType: event.eventType,
      evidenceText: event.evidenceText,
      confidenceScore: event.confidenceScore,
    }))

  const fromMemory = memoryEvents
    .filter((event) => ["booking_interest", "urgency_signal"].includes(event.memoryType))
    .map((event) => ({
      id: event.id,
      title: event.memoryType.replace(/_/g, " "),
      eventType: "buying_intent_increased" as const,
      evidenceText: event.evidenceText,
      confidenceScore: event.confidenceScore,
    }))

  return [...fromRevenue, ...fromMemory]
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, limit)
}

export function buildRevenueIntelligenceWorkspaceSnapshot(input: {
  relationshipMemoryProfileId: string | null
  relatedOpportunityId: string | null
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  storedEvents: VoiceRevenueIntelligenceEventPublicView[]
  objectionCount: number
  buyingSignalCount: number
  escalationCount: number
  relationshipStatus: string
  lastInteractionAt: string | null
}): VoiceRevenueIntelligenceWorkspaceSnapshot {
  const {
    relationshipMemoryProfileId,
    relatedOpportunityId,
    memoryEvents,
    storedEvents,
    objectionCount,
    buyingSignalCount,
    escalationCount,
    relationshipStatus,
    lastInteractionAt,
  } = input

  const activeEvents = storedEvents.filter((event) => event.status === "active" || event.status === "acknowledged")
  const previousStage = inferPreviousBuyingStageFromEvents(storedEvents)
  const currentBuyingStage = resolveBuyingStage({
    memoryEvents,
    objectionCount,
    buyingSignalCount,
    escalationCount,
    relationshipStatus,
  })
  const { score: momentumScore, direction: momentumDirection } = scoreMomentum({
    memoryEvents,
    buyingSignalCount,
    objectionCount,
    escalationCount,
    daysSinceLastInteraction: daysSince(lastInteractionAt),
  })
  const riskScore = scoreDealRisk({ memoryEvents, objectionCount, escalationCount, relationshipStatus })
  const followUpHealth = analyzeFollowUpHealth({ lastInteractionAt, memoryEvents })
  const topRisks = buildTopRisks(memoryEvents, REVENUE_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT)
  const topBuyingSignals = buildBuyingSignals(activeEvents, memoryEvents, REVENUE_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT)

  const unresolvedObjections = memoryEvents
    .filter((event) => ["pricing_objection", "budget_concern", "competitor_mention"].includes(event.memoryType))
    .map((event) => event.evidenceText)
    .slice(0, REVENUE_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT)

  const rankedActions = activeEvents
    .filter((event) => event.recommendedOperatorAction)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)

  const latestMeaningful = activeEvents[0] ?? storedEvents[0] ?? null
  const stageMovement = inferStageMovement(
    previousStage,
    currentBuyingStage,
    latestMeaningful?.evidenceText ?? "Stage inferred from relationship memory signals.",
  )

  const whatChangedSinceLastCall =
    latestMeaningful != null
      ? {
          summary: latestMeaningful.eventType.replace(/_/g, " "),
          evidenceText: latestMeaningful.evidenceText,
          eventType: latestMeaningful.eventType,
        }
      : null

  const confidenceScore =
    activeEvents.length > 0
      ? activeEvents.reduce((sum, event) => sum + event.confidenceScore, 0) / activeEvents.length
      : memoryEvents.length > 0
        ? memoryEvents.reduce((sum, event) => sum + event.confidenceScore, 0) / memoryEvents.length
        : 0

  return {
    qaMarker: VOICE_REVENUE_INTELLIGENCE_QA_MARKER,
    relationshipMemoryProfileId,
    relatedOpportunityId,
    currentBuyingStage,
    momentumDirection,
    momentumScore,
    riskScore,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    topRisks,
    topBuyingSignals,
    unresolvedObjections,
    nextRecommendedOperatorAction: rankedActions[0]?.recommendedOperatorAction ?? null,
    followUpHealth,
    lastMeaningfulInteractionAt: lastInteractionAt,
    whatChangedSinceLastCall,
    stageMovement,
    activeEventCount: activeEvents.length,
    topActiveEvents: activeEvents.slice(0, REVENUE_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT),
    windowed: true,
    eventsLimit: REVENUE_INTELLIGENCE_EVENTS_WINDOW,
    passiveModeEnabled: VOICE_REVENUE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
    autonomousActionsDisabled: VOICE_REVENUE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  }
}
