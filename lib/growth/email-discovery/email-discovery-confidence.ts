/** Confidence tier assignment for email discovery (Phase 7.3A). Client-safe. */

import type {
  GrowthEmailDiscoveryConfidenceTier,
  GrowthEmailDiscoverySource,
  GrowthEmailDiscoveryVerificationStatus,
} from "@/lib/growth/email-discovery/email-discovery-types"

export function confidenceTierForEmailDiscovery(input: {
  source: GrowthEmailDiscoverySource
  verification_status: GrowthEmailDiscoveryVerificationStatus
  base_confidence: number
}): GrowthEmailDiscoveryConfidenceTier {
  if (input.source === "website") {
    return "direct_evidence"
  }
  if (input.source === "staging_contact") {
    return input.base_confidence >= 0.75 ? "direct_evidence" : "provider_evidence"
  }
  if (input.source === "pdl") {
    return "provider_evidence"
  }
  if (input.source === "pattern") {
    if (input.verification_status === "verified") return "pattern_verified"
    return "pattern_unverified"
  }
  return "low"
}

export function baseConfidenceForSource(source: GrowthEmailDiscoverySource): number {
  switch (source) {
    case "website":
      return 0.88
    case "staging_contact":
      return 0.8
    case "pdl":
      return 0.82
    case "pattern":
      return 0.35
    case "manual":
      return 0.7
    default:
      return 0.2
  }
}

export function canPromoteEmailDiscoveryCandidate(input: {
  verification_status: GrowthEmailDiscoveryVerificationStatus | string
  confidence: number
  min_confidence?: number
}): boolean {
  const min = input.min_confidence ?? 0.85
  return input.verification_status === "verified" && input.confidence >= min
}
