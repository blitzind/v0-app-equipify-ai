/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Strategic recommendation generator (client-safe). */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { assessMarketIntelligenceConfidence } from "@/lib/growth/market-intelligence/growth-market-intelligence-confidence-1a"
import { buildMarketIntelligenceExplainabilityLines } from "@/lib/growth/market-intelligence/growth-market-intelligence-explainability-1a"
import type {
  MarketIntelligenceRecommendation,
  MarketIntelligenceSegmentMetrics,
  MarketIntelligenceSnapshot,
} from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"

function normalizeIndustryLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function estimatePortfolioImpact(segment: MarketIntelligenceSegmentMetrics): number | null {
  const qualRate = segment.qualificationRate
  if (qualRate == null) return null
  return Math.min(30, Math.round(qualRate * 0.25))
}

function estimateSearchVolume(segment: MarketIntelligenceSegmentMetrics): number | null {
  if (segment.researched <= 0) return null
  return segment.researched * 180
}

export function buildMarketIntelligenceRecommendations(input: {
  snapshot: MarketIntelligenceSnapshot
  approvedProfile: BusinessProfileDraftContent | null
}): MarketIntelligenceRecommendation[] {
  if (!input.approvedProfile) return []

  const profile = input.approvedProfile
  const currentIndustries = new Set(profile.idealCustomers.targetIndustries.map((row) => row.toLowerCase()))
  const industrySegments = input.snapshot.segmentPerformance.filter((row) => row.dimension === "industry")
  const recommendations: MarketIntelligenceRecommendation[] = []

  const ranked = [...industrySegments].sort(
    (left, right) => (right.qualificationRate ?? 0) - (left.qualificationRate ?? 0),
  )
  const best = ranked[0]
  const baseline = ranked.find((row) => row.segmentKey !== best?.segmentKey)

  if (best && baseline) {
    const label = normalizeIndustryLabel(best.segmentKey)
    const confidence = assessMarketIntelligenceConfidence({
      segment: best,
      validatedLearnings: input.snapshot.validatedLearnings,
      segmentLabel: label,
      contradictingSegments: ranked.slice(1, 3),
    })

    if (confidence.passesThreshold && !currentIndustries.has(best.segmentKey.toLowerCase())) {
      const after = [...profile.idealCustomers.targetIndustries, label]
      recommendations.push({
        id: `mi:add-industry:${best.segmentKey}`,
        kind: "add_industry",
        fieldPath: "idealCustomers.targetIndustries",
        before: profile.idealCustomers.targetIndustries,
        after,
        confidence,
        reason: `${label} companies are outperforming other segments in qualification and meetings.`,
        supportingEvidence: confidence.supportingEvidence,
        businessImpactEstimate:
          best.qualificationRate != null
            ? `Qualification rate ${best.qualificationRate}% in this segment`
            : null,
        affectedSearchVolumeEstimate: estimateSearchVolume(best),
        expectedPortfolioImpactPercent: estimatePortfolioImpact(best),
        explainabilityLines: buildMarketIntelligenceExplainabilityLines({
          action: `I recommend expanding into ${label} companies.`,
          confidencePercent: confidence.confidencePercent,
          segment: best,
          baselineSegment: baseline,
          supportingOpportunityCount: best.opportunities,
        }),
      })
    }
  }

  for (const segment of ranked.slice(1)) {
    if ((segment.qualificationRate ?? 100) >= 20) continue
    const label = normalizeIndustryLabel(segment.segmentKey)
    if (!currentIndustries.has(segment.segmentKey.toLowerCase())) continue

    const confidence = assessMarketIntelligenceConfidence({
      segment,
      validatedLearnings: input.snapshot.validatedLearnings,
      segmentLabel: label,
    })
    if (!confidence.passesThreshold) continue

    const after = profile.idealCustomers.targetIndustries.filter(
      (row) => row.toLowerCase() !== label.toLowerCase(),
    )
    if (after.length === profile.idealCustomers.targetIndustries.length) continue

    recommendations.push({
      id: `mi:remove-industry:${segment.segmentKey}`,
      kind: "remove_industry",
      fieldPath: "idealCustomers.targetIndustries",
      before: profile.idealCustomers.targetIndustries,
      after,
      confidence,
      reason: `${label} is underperforming relative to other segments in your portfolio.`,
      supportingEvidence: confidence.supportingEvidence,
      businessImpactEstimate: "Reduce low-fit discovery volume",
      affectedSearchVolumeEstimate: estimateSearchVolume(segment),
      expectedPortfolioImpactPercent: null,
      explainabilityLines: buildMarketIntelligenceExplainabilityLines({
        action: `I recommend reducing focus on ${label}.`,
        confidencePercent: confidence.confidencePercent,
        segment,
        supportingOpportunityCount: segment.opportunities,
      }),
    })
  }

  return recommendations.slice(0, 3)
}
