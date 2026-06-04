/** Verification volume limits (client-safe). */

import {
  GROWTH_EMAIL_DISCOVERY_MAX_VERIFY_PER_RUN,
  type GrowthEmailDiscoveryDraftCandidate,
} from "@/lib/growth/email-discovery/email-discovery-types"

const SOURCE_PRIORITY: Record<GrowthEmailDiscoveryDraftCandidate["source"], number> = {
  website: 0,
  staging_contact: 1,
  pdl: 2,
  manual: 3,
  pattern: 4,
  unknown: 5,
}

/** Prefer direct evidence sources; cap pattern-heavy verification cost. */
export function limitEmailDiscoveryDraftsForVerification(
  drafts: GrowthEmailDiscoveryDraftCandidate[],
  max = GROWTH_EMAIL_DISCOVERY_MAX_VERIFY_PER_RUN,
): { drafts: GrowthEmailDiscoveryDraftCandidate[]; truncated: number } {
  const sorted = [...drafts].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.source] ?? 99
    const pb = SOURCE_PRIORITY[b.source] ?? 99
    if (pa !== pb) return pa - pb
    return b.confidence - a.confidence
  })
  if (sorted.length <= max) return { drafts: sorted, truncated: 0 }
  return { drafts: sorted.slice(0, max), truncated: sorted.length - max }
}
