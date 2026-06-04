import type {
  GrowthBuyingCommitteeIntelligenceConfidenceTier,
  GrowthBuyingCommitteeIntelligenceSource,
  GrowthBuyingCommitteeIntelligenceVerificationStatus,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export function baseConfidenceForBuyingCommitteeSource(
  source: GrowthBuyingCommitteeIntelligenceSource,
): number {
  switch (source) {
    case "canonical_role":
      return 0.9
    case "confirmed_decision_maker":
      return 0.88
    case "staging_contact":
      return 0.86
    case "metadata_declared":
      return 0.87
    case "title_pattern":
      return 0.84
    case "manual":
      return 0.8
    default:
      return 0.5
  }
}

export function confidenceTierForBuyingCommitteeIntelligence(input: {
  source: GrowthBuyingCommitteeIntelligenceSource
  verification_status: GrowthBuyingCommitteeIntelligenceVerificationStatus
  base_confidence: number
}): GrowthBuyingCommitteeIntelligenceConfidenceTier {
  if (input.verification_status === "verified" && input.base_confidence >= 0.85) {
    return "direct_evidence"
  }
  if (input.verification_status === "probable" || input.base_confidence >= 0.75) {
    return "provider_evidence"
  }
  return "low"
}

export function canPromoteBuyingCommitteeAssignment(input: {
  verification_status: string
  confidence: number
  min_confidence?: number
}): boolean {
  return (
    input.verification_status === "verified" &&
    input.confidence >= (input.min_confidence ?? GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE)
  )
}
