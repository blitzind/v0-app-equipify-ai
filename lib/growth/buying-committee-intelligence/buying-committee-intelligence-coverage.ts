/** Committee coverage analysis — deterministic role presence (client-safe). */

import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES,
  type GrowthBuyingCommitteeIntelligenceCoverage,
  type GrowthBuyingCommitteeIntelligenceRole,
} from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

export function analyzeBuyingCommitteeCoverage(input: {
  verified_roles: GrowthBuyingCommitteeIntelligenceRole[]
  verified_person_ids: string[]
}): GrowthBuyingCommitteeIntelligenceCoverage {
  const present = new Set(input.verified_roles)
  const roles_present = GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES.filter((r) => present.has(r))
  const roles_missing = GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES.filter((r) => !present.has(r))
  const coverage_score = Number(
    (roles_present.length / GROWTH_BUYING_COMMITTEE_INTELLIGENCE_ROLES.length).toFixed(3),
  )
  const uniquePeople = new Set(input.verified_person_ids.filter(Boolean))

  return {
    roles_present,
    roles_missing,
    coverage_score,
    single_thread_risk: uniquePeople.size <= 1,
    verified_member_count: uniquePeople.size,
  }
}
