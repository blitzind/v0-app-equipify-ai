/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Recommendation confidence engine (client-safe). */

import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import {
  GROWTH_MARKET_INTELLIGENCE_MIN_CONFIDENCE_PERCENT,
  GROWTH_MARKET_INTELLIGENCE_MIN_SEGMENT_RESEARCHED,
  GROWTH_MARKET_INTELLIGENCE_MIN_SUPPORTING_EVENTS,
  type MarketIntelligenceConfidenceAssessment,
  type MarketIntelligenceEvidenceRef,
  type MarketIntelligenceSegmentMetrics,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"

export function assessMarketIntelligenceConfidence(input: {
  segment: MarketIntelligenceSegmentMetrics | null
  validatedLearnings: OrganizationalKnowledgeItem[]
  segmentLabel: string
  contradictingSegments?: MarketIntelligenceSegmentMetrics[]
}): MarketIntelligenceConfidenceAssessment {
  const supportingEvidence: MarketIntelligenceEvidenceRef[] = []
  const contradictingEvidence: MarketIntelligenceEvidenceRef[] = []

  let sampleSize = 0
  let confidencePercent = 0

  if (input.segment) {
    sampleSize = input.segment.researched
    supportingEvidence.push({
      source: "qualification",
      label: `${input.segment.researched} companies researched in ${input.segment.segmentLabel}`,
      referenceId: input.segment.segmentKey,
      observedAt: null,
    })
    if (input.segment.qualified > 0) {
      supportingEvidence.push({
        source: "qualification",
        label: `${input.segment.qualified} qualified`,
        referenceId: input.segment.segmentKey,
        observedAt: null,
      })
    }
    if (input.segment.meetings > 0) {
      supportingEvidence.push({
        source: "meeting",
        label: `${input.segment.meetings} meetings`,
        referenceId: input.segment.segmentKey,
        observedAt: null,
      })
    }
    if (input.segment.won > 0) {
      supportingEvidence.push({
        source: "opportunity",
        label: `${input.segment.won} wins`,
        referenceId: input.segment.segmentKey,
        observedAt: null,
      })
    }
    if (input.segment.churn === 0 && input.segment.retained > 0) {
      supportingEvidence.push({
        source: "customer_health",
        label: "No churn among retained customers in this segment",
        referenceId: input.segment.segmentKey,
        observedAt: null,
      })
    }

    const qualRate = input.segment.qualificationRate ?? 0
    const meetingRate = input.segment.meetingRate ?? 0
    const winRate = input.segment.winRate ?? 0
    confidencePercent = Math.min(
      99,
      Math.round(
        40 +
          Math.min(25, sampleSize * 2) +
          qualRate * 0.2 +
          meetingRate * 0.15 +
          winRate * 0.2 +
          (input.segment.churn === 0 && input.segment.retained > 0 ? 5 : 0),
      ),
    )
  }

  for (const learning of input.validatedLearnings) {
    if (!learning.finding.toLowerCase().includes(input.segmentLabel.toLowerCase().slice(0, 8))) {
      continue
    }
    if (learning.supporting_event_count < GROWTH_MARKET_INTELLIGENCE_MIN_SUPPORTING_EVENTS) {
      continue
    }
    supportingEvidence.push({
      source: "institutional_learning",
      label: learning.finding,
      referenceId: learning.knowledge_id,
      observedAt: learning.last_confirmed_at,
    })
    confidencePercent = Math.min(99, confidencePercent + Math.round(learning.confidence * 0.1))
  }

  for (const contradict of input.contradictingSegments ?? []) {
    if ((contradict.qualificationRate ?? 0) > (input.segment?.qualificationRate ?? 0)) {
      contradictingEvidence.push({
        source: "qualification",
        label: `${contradict.segmentLabel} qualified at ${contradict.qualificationRate}%`,
        referenceId: contradict.segmentKey,
        observedAt: null,
      })
      confidencePercent = Math.max(0, confidencePercent - 8)
    }
  }

  const passesThreshold =
    confidencePercent >= GROWTH_MARKET_INTELLIGENCE_MIN_CONFIDENCE_PERCENT &&
    sampleSize >= GROWTH_MARKET_INTELLIGENCE_MIN_SEGMENT_RESEARCHED &&
    supportingEvidence.length >= 2

  return {
    confidencePercent,
    sampleSize,
    supportingEvidence,
    contradictingEvidence,
    passesThreshold,
  }
}
