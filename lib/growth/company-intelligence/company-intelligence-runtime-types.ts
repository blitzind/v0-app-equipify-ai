/** Phase 7.6B — Company intelligence runtime integration (client-safe). */

export const GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER =
  "growth-company-intelligence-runtime-7.6b-v1" as const

export const GROWTH_COMPANY_INTELLIGENCE_JOB_MIGRATION =
  "20270718120000_growth_engine_company_intelligence_jobs_7_6b.sql" as const

export const GROWTH_COMPANY_INTELLIGENCE_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const
export type GrowthCompanyIntelligenceJobStatus =
  (typeof GROWTH_COMPANY_INTELLIGENCE_JOB_STATUSES)[number]

export const GROWTH_COMPANY_INTELLIGENCE_JOB_TRIGGERS = [
  "manual",
  "company_enriched",
  "browser_extension",
  "infrastructure_panel",
] as const
export type GrowthCompanyIntelligenceJobTrigger =
  (typeof GROWTH_COMPANY_INTELLIGENCE_JOB_TRIGGERS)[number]

export type GrowthCompanyIntelligenceDisplayStatus =
  | "none"
  | "pending"
  | "running"
  | "completed"
  | "failed"

export type GrowthCompanyIntelligenceOperatorStatus = {
  company_id: string
  company_name: string
  has_verified_intelligence: boolean
  has_intelligence_snapshots: boolean
  snapshot_count: number
  categories_present: string[]
  discovery_status: GrowthCompanyIntelligenceDisplayStatus
  job_status: GrowthCompanyIntelligenceJobStatus | null
  job_id: string | null
  last_run_id: string | null
  last_run_status: string | null
  last_run_at: string | null
  latest_finding_count: number
  latest_verified_count: number
  latest_promoted_count: number
  evidence_count: number
  can_discover: boolean
  can_view_evidence: boolean
  active_job_blocked: boolean
}

export const GROWTH_COMPANY_INTELLIGENCE_PROSPECT_FILTERS = [
  "has_verified_intelligence",
  "missing_verified_intelligence",
  "discovery_pending",
  "discovery_failed",
] as const
export type GrowthCompanyIntelligenceProspectFilter =
  (typeof GROWTH_COMPANY_INTELLIGENCE_PROSPECT_FILTERS)[number]

export type GrowthCompanyIntelligenceLeadRollup = {
  lead_id: string
  company_id: string | null
  has_canonical_company: boolean
  has_verified_intelligence: boolean
  missing_verified_intelligence: boolean
  discovery_pending: boolean
  discovery_failed: boolean
}

export function matchesCompanyIntelligenceProspectFilter(
  filter: GrowthCompanyIntelligenceProspectFilter,
  rollup: GrowthCompanyIntelligenceLeadRollup,
): boolean {
  if (!rollup.has_canonical_company) return false
  switch (filter) {
    case "has_verified_intelligence":
      return rollup.has_verified_intelligence
    case "missing_verified_intelligence":
      return rollup.missing_verified_intelligence
    case "discovery_pending":
      return rollup.discovery_pending
    case "discovery_failed":
      return rollup.discovery_failed
    default:
      return false
  }
}
