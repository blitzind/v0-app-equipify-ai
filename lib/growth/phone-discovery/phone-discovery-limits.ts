/** Verification volume limits (client-safe). */

import {
  GROWTH_PHONE_DISCOVERY_MAX_VERIFY_PER_RUN,
  type GrowthPhoneDiscoveryDraftCandidate,
} from "@/lib/growth/phone-discovery/phone-discovery-types"

const SOURCE_PRIORITY: Record<GrowthPhoneDiscoveryDraftCandidate["source"], number> = {
  website: 0,
  staging_contact: 1,
  canonical_channel: 2,
  pdl: 3,
  manual: 4,
  unknown: 5,
}

export function limitPhoneDiscoveryDraftsForVerification(
  drafts: GrowthPhoneDiscoveryDraftCandidate[],
  max = GROWTH_PHONE_DISCOVERY_MAX_VERIFY_PER_RUN,
): { drafts: GrowthPhoneDiscoveryDraftCandidate[]; truncated: number } {
  const sorted = [...drafts].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.source] ?? 99
    const pb = SOURCE_PRIORITY[b.source] ?? 99
    if (pa !== pb) return pa - pb
    return b.confidence - a.confidence
  })
  if (sorted.length <= max) return { drafts: sorted, truncated: 0 }
  return { drafts: sorted.slice(0, max), truncated: sorted.length - max }
}
