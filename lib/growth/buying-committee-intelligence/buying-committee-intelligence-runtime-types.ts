/** Phase 7.7B — Buying committee intelligence runtime integration (client-safe). */

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER =
  "growth-buying-committee-intelligence-runtime-7.7b-v1" as const

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_JOB_MIGRATION =
  "20270720120000_growth_engine_buying_committee_jobs_7_7b.sql" as const

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const
export type GrowthBuyingCommitteeIntelligenceJobStatus =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_JOB_STATUSES)[number]

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_JOB_TRIGGERS = [
  "manual",
  "company_intelligence_completed",
  "browser_extension",
  "infrastructure_panel",
] as const
export type GrowthBuyingCommitteeIntelligenceJobTrigger =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_JOB_TRIGGERS)[number]

export type GrowthBuyingCommitteeIntelligenceDisplayStatus =
  | "none"
  | "pending"
  | "running"
  | "completed"
  | "failed"

export const GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROSPECT_FILTERS = [
  "has_verified_committee",
  "missing_verified_committee",
  "discovery_pending",
  "discovery_failed",
] as const
export type GrowthBuyingCommitteeIntelligenceProspectFilter =
  (typeof GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROSPECT_FILTERS)[number]

export type GrowthBuyingCommitteeIntelligenceLeadRollup = {
  lead_id: string
  company_id: string | null
  has_canonical_company: boolean
  has_verified_committee: boolean
  missing_verified_committee: boolean
  discovery_pending: boolean
  discovery_failed: boolean
}

export function matchesBuyingCommitteeIntelligenceProspectFilter(
  filter: GrowthBuyingCommitteeIntelligenceProspectFilter,
  rollup: GrowthBuyingCommitteeIntelligenceLeadRollup,
): boolean {
  if (!rollup.has_canonical_company) return false
  switch (filter) {
    case "has_verified_committee":
      return rollup.has_verified_committee
    case "missing_verified_committee":
      return rollup.missing_verified_committee
    case "discovery_pending":
      return rollup.discovery_pending
    case "discovery_failed":
      return rollup.discovery_failed
    default:
      return false
  }
}
