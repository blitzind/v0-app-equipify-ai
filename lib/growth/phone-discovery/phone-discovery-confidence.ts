/** Confidence tier assignment for phone discovery (Phase 7.4A). Client-safe. */

import type {
  GrowthPhoneDiscoveryConfidenceTier,
  GrowthPhoneDiscoverySource,
  GrowthPhoneDiscoveryVerificationStatus,
} from "@/lib/growth/phone-discovery/phone-discovery-types"

export function confidenceTierForPhoneDiscovery(input: {
  source: GrowthPhoneDiscoverySource
  verification_status: GrowthPhoneDiscoveryVerificationStatus
  base_confidence: number
}): GrowthPhoneDiscoveryConfidenceTier {
  if (input.source === "website") return "direct_evidence"
  if (input.source === "staging_contact" || input.source === "canonical_channel") {
    return input.base_confidence >= 0.75 ? "direct_evidence" : "provider_evidence"
  }
  if (input.source === "pdl") return "provider_evidence"
  return "low"
}

export function baseConfidenceForPhoneSource(source: GrowthPhoneDiscoverySource): number {
  switch (source) {
    case "website":
      return 0.88
    case "staging_contact":
      return 0.8
    case "canonical_channel":
      return 0.78
    case "pdl":
      return 0.8
    case "manual":
      return 0.72
    default:
      return 0.2
  }
}

export function canPromotePhoneDiscoveryCandidate(input: {
  verification_status: GrowthPhoneDiscoveryVerificationStatus | string
  confidence: number
  min_confidence?: number
}): boolean {
  const min = input.min_confidence ?? 0.85
  return input.verification_status === "verified" && input.confidence >= min
}
