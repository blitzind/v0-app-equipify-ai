/** Confidence tier assignment for email discovery (Phase 7.3A). Client-safe. */

import type {
  GrowthEmailDiscoveryConfidenceTier,
  GrowthEmailDiscoverySource,
  GrowthEmailDiscoveryVerificationStatus,
} from "@/lib/growth/email-discovery/email-discovery-types"
import { shadowCompareEmailDiscoveryConfidence } from "@/lib/growth/contact-verification/confidence-signals-shadow"

export function confidenceTierForEmailDiscovery(input: {
  source: GrowthEmailDiscoverySource
  verification_status: GrowthEmailDiscoveryVerificationStatus
  base_confidence: number
}): GrowthEmailDiscoveryConfidenceTier {
  let tier: GrowthEmailDiscoveryConfidenceTier
  if (input.source === "website") {
    tier = "direct_evidence"
  } else if (input.source === "staging_contact") {
    tier = input.base_confidence >= 0.75 ? "direct_evidence" : "provider_evidence"
  } else if (input.source === "pdl") {
    tier = "provider_evidence"
  } else if (input.source === "pattern") {
    tier = input.verification_status === "verified" ? "pattern_verified" : "pattern_unverified"
  } else {
    tier = "low"
  }

  shadowCompareEmailDiscoveryConfidence({
    source: input.source,
    verification_status: input.verification_status,
    legacy_confidence: input.base_confidence,
    integration: "confidenceTierForEmailDiscovery",
  })

  return tier
}

export function baseConfidenceForSource(source: GrowthEmailDiscoverySource): number {
  let score: number
  switch (source) {
    case "website":
      score = 0.88
      break
    case "staging_contact":
      score = 0.8
      break
    case "pdl":
      score = 0.82
      break
    case "pattern":
      score = 0.35
      break
    case "manual":
      score = 0.7
      break
    default:
      score = 0.2
  }

  shadowCompareEmailDiscoveryConfidence({
    source,
    verification_status: "unverified",
    legacy_confidence: score,
    integration: "baseConfidenceForSource",
  })

  return score
}

export function canPromoteEmailDiscoveryCandidate(input: {
  verification_status: GrowthEmailDiscoveryVerificationStatus | string
  confidence: number
  min_confidence?: number
}): boolean {
  const min = input.min_confidence ?? 0.85
  return input.verification_status === "verified" && input.confidence >= min
}
