/** Bulk contact acquisition — types and constants. Client-safe. */

import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"

export const GROWTH_BULK_ACQUISITION_QA_MARKER = "growth-bulk-acquisition-v1" as const

export const GROWTH_BULK_ACQUISITION_RUN_STATUSES = [
  "running",
  "completed",
  "partial",
  "failed",
] as const

export type GrowthBulkAcquisitionRunStatus =
  (typeof GROWTH_BULK_ACQUISITION_RUN_STATUSES)[number]

export const GROWTH_BULK_ACQUISITION_PHASES = [
  "discover_companies",
  "discover_contacts",
  "verify_contacts",
  "promote_leads",
  "done",
] as const

export type GrowthBulkAcquisitionPhase = (typeof GROWTH_BULK_ACQUISITION_PHASES)[number]

export const GROWTH_BULK_ACQUISITION_COMPANIES_PER_TICK = 3

export const GROWTH_BULK_ACQUISITION_VERIFY_PER_TICK = 25

export const GROWTH_BULK_ACQUISITION_PROMOTE_PER_TICK = 100

export const GROWTH_BULK_ACQUISITION_DEFAULT_QUERY_LIMIT = 50

export type GrowthBulkAcquisitionStats = {
  companies_discovered: number
  companies_contacts_processed: number
  contact_candidates_stored: number
  company_contacts_synced: number
  contacts_verified: number
  leads_created: number
  leads_linked_duplicate: number
  leads_suppressed: number
  leads_skipped: number
  leads_error: number
}

export type GrowthBulkAcquisitionRunState = {
  qa_marker: typeof GROWTH_BULK_ACQUISITION_QA_MARKER
  phase: GrowthBulkAcquisitionPhase
  search_inputs: GrowthRealWorldDiscoverySearchInputs
  query_plan: {
    primary: string[]
    fallback: string[]
  }
  query_index: number
  use_fallback_queries: boolean
  child_run_ids: string[]
  limit_per_query: number
  stats: GrowthBulkAcquisitionStats
  last_tick_at: string | null
  last_error: string | null
}

export type GrowthBulkAcquisitionRun = {
  id: string
  query: string
  industry: string | null
  location: string | null
  status: GrowthBulkAcquisitionRunStatus
  created_by: string | null
  created_at: string
  updated_at: string
  state: GrowthBulkAcquisitionRunState
}

export type GrowthBulkAcquisitionTickResult = {
  run: GrowthBulkAcquisitionRun
  phase: GrowthBulkAcquisitionPhase
  tick_actions: string[]
  done: boolean
}

export type PromoteVerifiedContactOutcome =
  | { status: "created"; leadId: string; decisionMakerId: string; companyContactId: string }
  | { status: "linked_duplicate"; leadId: string; companyContactId: string; rule: string }
  | { status: "suppressed"; companyContactId: string; reason: string }
  | { status: "skipped"; companyContactId: string; reason: string }
  | { status: "error"; companyContactId: string; message: string }

export function emptyAcquisitionStats(): GrowthBulkAcquisitionStats {
  return {
    companies_discovered: 0,
    companies_contacts_processed: 0,
    contact_candidates_stored: 0,
    company_contacts_synced: 0,
    contacts_verified: 0,
    leads_created: 0,
    leads_linked_duplicate: 0,
    leads_suppressed: 0,
    leads_skipped: 0,
    leads_error: 0,
  }
}
