import type { GrowthCompanyIntelligenceDraftFinding } from "@/lib/growth/company-intelligence/company-intelligence-types"
import { GROWTH_COMPANY_INTELLIGENCE_MAX_VERIFY_PER_RUN } from "@/lib/growth/company-intelligence/company-intelligence-types"

const SOURCE_PRIORITY: Record<GrowthCompanyIntelligenceDraftFinding["source"], number> = {
  website: 5,
  canonical_social: 4,
  canonical_company: 3,
  canonical_snapshot: 3,
  staging_company: 2,
  manual: 6,
  unknown: 0,
}

export function limitCompanyIntelligenceDraftsForVerification(
  drafts: GrowthCompanyIntelligenceDraftFinding[],
  max = GROWTH_COMPANY_INTELLIGENCE_MAX_VERIFY_PER_RUN,
): { drafts: GrowthCompanyIntelligenceDraftFinding[]; truncated: number } {
  const sorted = [...drafts].sort((a, b) => {
    const pa = SOURCE_PRIORITY[a.source] ?? 0
    const pb = SOURCE_PRIORITY[b.source] ?? 0
    if (pb !== pa) return pb - pa
    return b.confidence - a.confidence
  })
  if (sorted.length <= max) return { drafts: sorted, truncated: 0 }
  return { drafts: sorted.slice(0, max), truncated: sorted.length - max }
}
