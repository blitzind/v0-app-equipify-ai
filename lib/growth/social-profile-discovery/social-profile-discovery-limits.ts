import { GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_VERIFY_PER_RUN } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"
import type { GrowthSocialProfileDiscoveryDraftCandidate } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export function limitSocialProfileDiscoveryDraftsForVerification(
  drafts: GrowthSocialProfileDiscoveryDraftCandidate[],
  max = GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_VERIFY_PER_RUN,
): { drafts: GrowthSocialProfileDiscoveryDraftCandidate[]; truncated: number } {
  const sorted = [...drafts].sort((a, b) => b.confidence - a.confidence)
  if (sorted.length <= max) return { drafts: sorted, truncated: 0 }
  return { drafts: sorted.slice(0, max), truncated: sorted.length - max }
}
