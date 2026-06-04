/** Phase 7.4B — Phone discovery runtime integration (client-safe). */

export const GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER =
  "growth-phone-discovery-runtime-7.4b-v1" as const

export const GROWTH_PHONE_DISCOVERY_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const
export type GrowthPhoneDiscoveryJobStatus = (typeof GROWTH_PHONE_DISCOVERY_JOB_STATUSES)[number]

export const GROWTH_PHONE_DISCOVERY_JOB_TRIGGERS = [
  "manual",
  "person_created",
  "company_enriched",
  "browser_extension",
  "infrastructure_panel",
] as const
export type GrowthPhoneDiscoveryJobTrigger = (typeof GROWTH_PHONE_DISCOVERY_JOB_TRIGGERS)[number]

/** Operator-facing discovery rollup for a company + person pair. */
export type GrowthPhoneDiscoveryOperatorStatus = {
  company_id: string
  person_id: string
  has_verified_phone: boolean
  verified_phone: string | null
  discovery_status: "none" | "pending" | "running" | "completed" | "failed"
  job_status: GrowthPhoneDiscoveryJobStatus | null
  job_id: string | null
  last_run_id: string | null
  last_run_status: string | null
  last_run_at: string | null
  evidence_count: number
  can_discover: boolean
  can_view_evidence: boolean
  active_job_blocked: boolean
}

export const GROWTH_PHONE_DISCOVERY_PROSPECT_FILTERS = [
  "has_verified_phone",
  "missing_verified_phone",
  "discovery_pending",
  "discovery_failed",
] as const
export type GrowthPhoneDiscoveryProspectFilter =
  (typeof GROWTH_PHONE_DISCOVERY_PROSPECT_FILTERS)[number]

export type GrowthPhoneDiscoveryLeadRollup = {
  lead_id: string
  company_id: string | null
  canonical_pair_count: number
  has_verified_phone: boolean
  missing_verified_phone: boolean
  discovery_pending: boolean
  discovery_failed: boolean
}

export function matchesPhoneDiscoveryProspectFilter(
  filter: GrowthPhoneDiscoveryProspectFilter,
  rollup: GrowthPhoneDiscoveryLeadRollup,
): boolean {
  if (rollup.canonical_pair_count === 0) return false
  switch (filter) {
    case "has_verified_phone":
      return rollup.has_verified_phone
    case "missing_verified_phone":
      return rollup.missing_verified_phone
    case "discovery_pending":
      return rollup.discovery_pending
    case "discovery_failed":
      return rollup.discovery_failed
    default:
      return false
  }
}
