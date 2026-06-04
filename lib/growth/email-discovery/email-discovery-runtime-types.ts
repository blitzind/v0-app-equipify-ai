/** Phase 7.3B — Email discovery runtime integration (client-safe). */

export const GROWTH_EMAIL_DISCOVERY_RUNTIME_QA_MARKER =
  "growth-email-discovery-runtime-7.3b-v1" as const

export const GROWTH_EMAIL_DISCOVERY_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const
export type GrowthEmailDiscoveryJobStatus = (typeof GROWTH_EMAIL_DISCOVERY_JOB_STATUSES)[number]

export const GROWTH_EMAIL_DISCOVERY_JOB_TRIGGERS = [
  "manual",
  "person_created",
  "company_enriched",
  "browser_extension",
  "infrastructure_panel",
] as const
export type GrowthEmailDiscoveryJobTrigger = (typeof GROWTH_EMAIL_DISCOVERY_JOB_TRIGGERS)[number]

/** Operator-facing discovery rollup for a company + person pair. */
export type GrowthEmailDiscoveryOperatorStatus = {
  company_id: string
  person_id: string
  has_verified_email: boolean
  verified_email: string | null
  discovery_status: "none" | "pending" | "running" | "completed" | "failed"
  job_status: GrowthEmailDiscoveryJobStatus | null
  job_id: string | null
  last_run_id: string | null
  last_run_status: string | null
  last_run_at: string | null
  verified_candidate_count: number
  evidence_count: number
  can_discover: boolean
  can_view_evidence: boolean
  active_job_blocked: boolean
}

export const GROWTH_EMAIL_DISCOVERY_PROSPECT_FILTERS = [
  "has_verified_email",
  "missing_verified_email",
  "discovery_pending",
  "discovery_failed",
] as const
export type GrowthEmailDiscoveryProspectFilter =
  (typeof GROWTH_EMAIL_DISCOVERY_PROSPECT_FILTERS)[number]

export type GrowthEmailDiscoveryLeadRollup = {
  lead_id: string
  company_id: string | null
  canonical_pair_count: number
  has_verified_email: boolean
  missing_verified_email: boolean
  discovery_pending: boolean
  discovery_failed: boolean
}

export function matchesEmailDiscoveryProspectFilter(
  filter: GrowthEmailDiscoveryProspectFilter,
  rollup: GrowthEmailDiscoveryLeadRollup,
): boolean {
  if (rollup.canonical_pair_count === 0) return false
  switch (filter) {
    case "has_verified_email":
      return rollup.has_verified_email
    case "missing_verified_email":
      return rollup.missing_verified_email
    case "discovery_pending":
      return rollup.discovery_pending
    case "discovery_failed":
      return rollup.discovery_failed
    default:
      return false
  }
}
