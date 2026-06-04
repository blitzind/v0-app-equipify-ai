/** Phase 7.5B — Social profile discovery runtime integration (client-safe). */

import type {
  GrowthSocialProfileDiscoveryProfileType,
  GrowthSocialProfileDiscoveryScope,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER =
  "growth-social-profile-discovery-runtime-7.5b-v1" as const

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_JOB_MIGRATION =
  "20270716120000_growth_engine_social_profile_discovery_jobs_7_5b.sql" as const

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const
export type GrowthSocialProfileDiscoveryJobStatus =
  (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_JOB_STATUSES)[number]

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_JOB_TRIGGERS = [
  "manual",
  "person_created",
  "company_enriched",
  "browser_extension",
  "infrastructure_panel",
] as const
export type GrowthSocialProfileDiscoveryJobTrigger =
  (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_JOB_TRIGGERS)[number]

export type GrowthSocialProfileDiscoveryOperatorStatus = {
  company_id: string
  person_id: string | null
  discovery_scope: GrowthSocialProfileDiscoveryScope
  has_verified_profile: boolean
  verified_profile: string | null
  verified_profile_type: GrowthSocialProfileDiscoveryProfileType | null
  discovery_status: "none" | "pending" | "running" | "completed" | "failed"
  job_status: GrowthSocialProfileDiscoveryJobStatus | null
  job_id: string | null
  last_run_id: string | null
  last_run_status: string | null
  last_run_at: string | null
  evidence_count: number
  can_discover: boolean
  can_view_evidence: boolean
  active_job_blocked: boolean
}

export const GROWTH_SOCIAL_PROFILE_DISCOVERY_PROSPECT_FILTERS = [
  "has_verified_profile",
  "missing_verified_profile",
  "discovery_pending",
  "discovery_failed",
] as const
export type GrowthSocialProfileDiscoveryProspectFilter =
  (typeof GROWTH_SOCIAL_PROFILE_DISCOVERY_PROSPECT_FILTERS)[number]

export type GrowthSocialProfileDiscoveryLeadRollup = {
  lead_id: string
  company_id: string | null
  canonical_pair_count: number
  has_verified_profile: boolean
  missing_verified_profile: boolean
  discovery_pending: boolean
  discovery_failed: boolean
}

export function matchesSocialProfileDiscoveryProspectFilter(
  filter: GrowthSocialProfileDiscoveryProspectFilter,
  rollup: GrowthSocialProfileDiscoveryLeadRollup,
): boolean {
  if (rollup.canonical_pair_count === 0) return false
  switch (filter) {
    case "has_verified_profile":
      return rollup.has_verified_profile
    case "missing_verified_profile":
      return rollup.missing_verified_profile
    case "discovery_pending":
      return rollup.discovery_pending
    case "discovery_failed":
      return rollup.discovery_failed
    default:
      return false
  }
}
