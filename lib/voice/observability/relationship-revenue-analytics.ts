/** Relationship + revenue trend analytics — Phase 5B. Reuses intelligence layers. */

import type { VoiceObservabilityRelationshipRevenueSnapshot } from "@/lib/voice/observability/types"
import { VOICE_OBSERVABILITY_QA_MARKER } from "@/lib/voice/observability/types"

export type RelationshipRevenueSourceCounts = {
  unresolvedObjections: Map<string, number>
  retentionRisk: Map<string, number>
  expansionOpportunities: Map<string, number>
  buyingStage: Map<string, number>
  escalationRiskCount: number
  followUpNeeded: number
  followUpResolved: number
  momentum: Map<string, number>
}

export function buildRelationshipRevenueSnapshot(
  counts: RelationshipRevenueSourceCounts,
): VoiceObservabilityRelationshipRevenueSnapshot {
  const followUpDenom = Math.max(counts.followUpNeeded + counts.followUpResolved, 1)
  const followUpAdherenceRate = Math.round((counts.followUpResolved / followUpDenom) * 1000) / 10

  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
    unresolvedObjectionTrend: mapToSortedArray(counts.unresolvedObjections),
    retentionRiskTrend: mapToSortedArray(counts.retentionRisk),
    expansionOpportunityTrend: mapToSortedArray(counts.expansionOpportunities),
    buyingStageProgression: mapToSortedArray(counts.buyingStage),
    escalationRiskTrend: counts.escalationRiskCount,
    followUpAdherenceRate,
    momentumChanges: mapToSortedArray(counts.momentum),
    message: "Relationship and revenue trends from existing intelligence layers — no new scoring.",
  }
}

function mapToSortedArray(map: Map<string, number>): Array<{ label: string; count: number }> {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
}

export function emptyRelationshipRevenueCounts(): RelationshipRevenueSourceCounts {
  return {
    unresolvedObjections: new Map(),
    retentionRisk: new Map(),
    expansionOpportunities: new Map(),
    buyingStage: new Map(),
    escalationRiskCount: 0,
    followUpNeeded: 0,
    followUpResolved: 0,
    momentum: new Map(),
  }
}

export function incrementMapCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}
