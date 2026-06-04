/** Confidence tiers for company intelligence findings. Client-safe. */

import type {
  GrowthCompanyIntelligenceConfidenceTier,
  GrowthCompanyIntelligenceSource,
  GrowthCompanyIntelligenceVerificationStatus,
} from "@/lib/growth/company-intelligence/company-intelligence-types"

export function baseConfidenceForCompanyIntelligenceSource(
  source: GrowthCompanyIntelligenceSource,
): number {
  switch (source) {
    case "website":
      return 0.88
    case "canonical_company":
      return 0.82
    case "canonical_snapshot":
      return 0.8
    case "canonical_social":
      return 0.86
    case "staging_company":
      return 0.78
    case "manual":
      return 0.9
    default:
      return 0.5
  }
}

export function confidenceTierForCompanyIntelligence(input: {
  source: GrowthCompanyIntelligenceSource
  verification_status: GrowthCompanyIntelligenceVerificationStatus
  base_confidence: number
}): GrowthCompanyIntelligenceConfidenceTier {
  if (input.verification_status === "verified" && input.base_confidence >= 0.85) {
    return "direct_evidence"
  }
  if (
    input.source === "staging_company" ||
    input.source === "canonical_company" ||
    input.source === "canonical_snapshot"
  ) {
    return "provider_evidence"
  }
  if (input.base_confidence >= 0.75) return "provider_evidence"
  return "low"
}

export function canPromoteCompanyIntelligenceFinding(input: {
  verification_status: GrowthCompanyIntelligenceVerificationStatus
  confidence: number
}): boolean {
  return (
    input.verification_status === "verified" &&
    input.confidence >= 0.85 /* GROWTH_COMPANY_INTELLIGENCE_PROMOTION_MIN_CONFIDENCE */
  )
}
