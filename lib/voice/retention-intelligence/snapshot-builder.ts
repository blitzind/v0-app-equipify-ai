/** Retention workspace snapshot — capped, windowed payload. */

import { detectChurnRiskSignals } from "@/lib/voice/retention-intelligence/churn-risk"
import { detectExpansionSignals } from "@/lib/voice/retention-intelligence/expansion-signals"
import { scoreCustomerHealth } from "@/lib/voice/retention-intelligence/health-scoring"
import {
  buildSatisfactionIndicators,
  collectUnresolvedIssues,
} from "@/lib/voice/retention-intelligence/satisfaction-signals"
import type { VoiceRelationshipMemoryEventPublicView } from "@/lib/voice/relationship-memory/types"
import type { VoiceRevenueIntelligenceEventPublicView } from "@/lib/voice/revenue-intelligence/types"
import type {
  VoiceRetentionIntelligenceEventPublicView,
  VoiceRetentionIntelligenceWorkspaceSnapshot,
  VoiceRetentionWhatChanged,
} from "@/lib/voice/retention-intelligence/types"
import {
  RETENTION_INTELLIGENCE_EVENTS_WINDOW,
  RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT,
  VOICE_RETENTION_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_RETENTION_INTELLIGENCE_PASSIVE_MODE_ENABLED,
  VOICE_RETENTION_INTELLIGENCE_QA_MARKER,
} from "@/lib/voice/retention-intelligence/types"

export function buildRetentionIntelligenceWorkspaceSnapshot(input: {
  relationshipMemoryProfileId: string | null
  relatedCustomerId: string | null
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  revenueEvents: VoiceRevenueIntelligenceEventPublicView[]
  storedEvents: VoiceRetentionIntelligenceEventPublicView[]
  objectionCount: number
  buyingSignalCount: number
  escalationCount: number
  relationshipStatus: string
  sentimentTrend: string
  lastInteractionAt: string | null
}): VoiceRetentionIntelligenceWorkspaceSnapshot {
  const {
    relationshipMemoryProfileId,
    relatedCustomerId,
    memoryEvents,
    revenueEvents,
    storedEvents,
    objectionCount,
    buyingSignalCount,
    escalationCount,
    relationshipStatus,
    sentimentTrend,
    lastInteractionAt,
  } = input

  const activeEvents = storedEvents.filter((event) => event.status === "active" || event.status === "acknowledged")
  const { score: healthScore, direction: healthDirection, retentionRiskLevel } = scoreCustomerHealth({
    memoryEvents,
    revenueEvents,
    objectionCount,
    buyingSignalCount,
    escalationCount,
    relationshipStatus,
    sentimentTrend,
    lastInteractionAt,
  })

  const topRisks = detectChurnRiskSignals(memoryEvents, revenueEvents, RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT)
  const topExpansionSignals = detectExpansionSignals(
    memoryEvents,
    revenueEvents,
    RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT,
  )
  const unresolvedIssues = collectUnresolvedIssues(memoryEvents, RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT)
  const satisfactionIndicators = buildSatisfactionIndicators(memoryEvents, RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT)

  const rankedActions = activeEvents
    .filter((event) => event.recommendedOperatorAction)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)

  const latestMeaningful = activeEvents[0] ?? storedEvents[0] ?? null
  const whatChangedSinceLastInteraction: VoiceRetentionWhatChanged | null = latestMeaningful
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
    qaMarker: VOICE_RETENTION_INTELLIGENCE_QA_MARKER,
    relationshipMemoryProfileId,
    relatedCustomerId,
    healthScore,
    healthDirection,
    retentionRiskLevel,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    topRisks,
    topExpansionSignals,
    unresolvedIssues,
    satisfactionIndicators,
    recommendedCustomerSuccessAction: rankedActions[0]?.recommendedOperatorAction ?? null,
    lastMeaningfulInteractionAt: lastInteractionAt,
    whatChangedSinceLastInteraction,
    activeEventCount: activeEvents.length,
    topActiveEvents: activeEvents.slice(0, RETENTION_INTELLIGENCE_SNAPSHOT_ITEMS_LIMIT),
    windowed: true,
    eventsLimit: RETENTION_INTELLIGENCE_EVENTS_WINDOW,
    passiveModeEnabled: VOICE_RETENTION_INTELLIGENCE_PASSIVE_MODE_ENABLED,
    autonomousActionsDisabled: VOICE_RETENTION_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  }
}
