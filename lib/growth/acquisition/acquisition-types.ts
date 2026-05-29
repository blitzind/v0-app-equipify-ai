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

/** Stop discovery after this many consecutive zero-result queries across geo tiles. */
export const GROWTH_BULK_ACQUISITION_ZERO_DISCOVERY_STOP = 5

export const GROWTH_BULK_ACQUISITION_COMPANY_SCAN_BATCH = 100

export type GrowthBulkAcquisitionKeysetCursor = {
  created_at: string
  id: string
}

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

export type GrowthBulkAcquisitionThroughputMetrics = {
  ticks_completed: number
  last_tick_duration_ms: number
  total_tick_duration_ms: number
  provider_errors: number
  verification_failures: number
  emails_verification_attempted: number
  contacts_discovered: number
  emails_verified: number
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
  metrics: GrowthBulkAcquisitionThroughputMetrics
  geo_tiles: string[]
  geo_tile_index: number
  executed_query_keys: string[]
  consecutive_zero_discovery: number
  target_company_count: number | null
  discovery_exhausted: boolean
  contact_discovery_cursor: GrowthBulkAcquisitionKeysetCursor | null
  contact_discovery_exhausted: boolean
  verify_company_scan_cursor: GrowthBulkAcquisitionKeysetCursor | null
  promote_company_scan_cursor: GrowthBulkAcquisitionKeysetCursor | null
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
  tick_duration_ms: number
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

export function emptyAcquisitionThroughputMetrics(): GrowthBulkAcquisitionThroughputMetrics {
  return {
    ticks_completed: 0,
    last_tick_duration_ms: 0,
    total_tick_duration_ms: 0,
    provider_errors: 0,
    verification_failures: 0,
    emails_verification_attempted: 0,
    contacts_discovered: 0,
    emails_verified: 0,
  }
}

export function emptyAcquisitionRunState(
  input: Pick<
    GrowthBulkAcquisitionRunState,
    "search_inputs" | "query_plan" | "limit_per_query" | "geo_tiles" | "target_company_count"
  >,
): GrowthBulkAcquisitionRunState {
  return {
    qa_marker: GROWTH_BULK_ACQUISITION_QA_MARKER,
    phase: "discover_companies",
    search_inputs: input.search_inputs,
    query_plan: input.query_plan,
    query_index: 0,
    use_fallback_queries: false,
    child_run_ids: [],
    limit_per_query: input.limit_per_query,
    stats: emptyAcquisitionStats(),
    metrics: emptyAcquisitionThroughputMetrics(),
    geo_tiles: input.geo_tiles,
    geo_tile_index: 0,
    executed_query_keys: [],
    consecutive_zero_discovery: 0,
    target_company_count: input.target_company_count,
    discovery_exhausted: false,
    contact_discovery_cursor: null,
    contact_discovery_exhausted: false,
    verify_company_scan_cursor: null,
    promote_company_scan_cursor: null,
    last_tick_at: null,
    last_error: null,
  }
}
