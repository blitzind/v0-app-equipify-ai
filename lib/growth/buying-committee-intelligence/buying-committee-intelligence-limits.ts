import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_VERIFY_PER_RUN } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import type { GrowthBuyingCommitteeIntelligenceDraftAssignment } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export function limitBuyingCommitteeDraftsForVerification(
  drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[],
): { drafts: GrowthBuyingCommitteeIntelligenceDraftAssignment[]; truncated: number } {
  const sorted = [...drafts].sort((a, b) => b.confidence - a.confidence)
  if (sorted.length <= GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_VERIFY_PER_RUN) {
    return { drafts: sorted, truncated: 0 }
  }
  return {
    drafts: sorted.slice(0, GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_VERIFY_PER_RUN),
    truncated: sorted.length - GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_VERIFY_PER_RUN,
  }
}
