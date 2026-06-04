/** Social profile discovery confidence tiers and promotion gates (client-safe). */

import type {
  GrowthSocialProfileDiscoveryProfileType,
  GrowthSocialProfileDiscoverySource,
  GrowthSocialProfileDiscoveryVerificationStatus,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export function baseConfidenceForSocialProfileSource(source: GrowthSocialProfileDiscoverySource): number {
  switch (source) {
    case "website":
      return 0.88
    case "staging_contact":
      return 0.82
    case "canonical_channel":
      return 0.8
    case "manual":
      return 0.75
    default:
      return 0.5
  }
}

export function confidenceTierForSocialProfileDiscovery(input: {
  source: GrowthSocialProfileDiscoverySource
  verification_status: GrowthSocialProfileDiscoveryVerificationStatus | string
  base_confidence: number
}): "direct_evidence" | "provider_evidence" | "low" {
  if (input.verification_status === "invalid") return "low"
  if (input.source === "website" || input.source === "staging_contact") {
    return input.base_confidence >= 0.85 ? "direct_evidence" : "provider_evidence"
  }
  if (input.source === "canonical_channel") return "provider_evidence"
  return "low"
}

export function canPromoteSocialProfileDiscoveryCandidate(input: {
  verification_status: string
  confidence: number
  min_confidence?: number
}): boolean {
  const min = input.min_confidence ?? 0.85
  return input.verification_status === "verified" && input.confidence >= min
}

export function isPersonScopedProfileType(
  profile_type: GrowthSocialProfileDiscoveryProfileType,
): boolean {
  return profile_type !== "linkedin_company"
}
