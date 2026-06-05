/** Phase 7.PS-HS — Prospect graph expansion types. Client-safe. */

export const GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER =
  "growth-prospect-graph-expansion-7-ps-hs-v1" as const

export const GROWTH_PROSPECT_SOURCE_REGISTRY_QA_MARKER =
  "growth-prospect-source-registry-7-ps-hs-v1" as const

export const GROWTH_PROSPECT_CONTINUOUS_ACQUISITION_QA_MARKER =
  "growth-prospect-continuous-acquisition-7-ps-hs-v1" as const

/** Evidence-backed prospect contact source types (no synthetic providers). */
export const GROWTH_PROSPECT_SOURCE_TYPES = [
  "website",
  "team_page",
  "leadership_page",
  "schema_org",
  "contact_page",
  "directory",
  "association",
  "conference_exhibitor",
] as const

export type GrowthProspectSourceType = (typeof GROWTH_PROSPECT_SOURCE_TYPES)[number]

export type GrowthProspectSourceRegistryEntry = {
  source_type: GrowthProspectSourceType
  label: string
  description: string
  /** Days between scheduled re-acquisition for stale evidence. */
  refresh_cadence_days: number
  /** Relative priority when multiple sources are eligible (higher = earlier). */
  acquisition_priority: number
  /** Maps to company_contacts.source_type when persisted. */
  company_contact_source_type: string
  evidence_depth: "page" | "structured" | "directory_listing" | "event_listing"
  requires_public_url: boolean
  live: boolean
}

export type GrowthProspectGraphEvidenceVersion = {
  version_id: string
  captured_at: string
  company_id: string
  source_types_observed: GrowthProspectSourceType[]
  evidence_count: number
  metrics_snapshot: GrowthProspectGraphExpansionMetrics
  evidence: Array<{ claim: string; evidence: string; source: string }>
}

export type GrowthProspectGraphExpansionMetrics = {
  companies_total: number
  companies_with_website: number
  persons_total: number
  named_persons_total: number
  titles_total: number
  verified_emails_total: number
  verified_phones_total: number
  verified_profiles_total: number
  committee_members_verified: number
  named_person_density_pct: number
  committee_density_pct: number
  source_attribution: Partial<Record<GrowthProspectSourceType, number>>
  evidence_freshness: {
    fresh_sources: number
    stale_sources: number
    unknown_sources: number
  }
}

export type GrowthProspectGraphAcquisitionJob = {
  job_key: string
  company_id: string
  company_name: string
  segment_key: string
  source_types: GrowthProspectSourceType[]
  status: "pending" | "running" | "completed" | "failed"
  scheduled_for: string
  evidence_version_before: string | null
  evidence_version_after: string | null
}

export type GrowthProspectGraphMaterializationSummary = {
  qa_marker: string
  candidates_discovered: number
  candidates_promoted: number
  candidates_blocked: number
  companies_added: number
  persons_promoted: number
  promotion_rate_pct: number
  promotion_blockers: string[]
}

export type GrowthProspectGraphExpansionCycleResult = {
  qa_marker: typeof GROWTH_PROSPECT_GRAPH_EXPANSION_QA_MARKER
  ok: boolean
  jobs_queued: number
  jobs_processed: number
  jobs_failed: number
  discovery_new_companies: number
  materialization: GrowthProspectGraphMaterializationSummary | null
  metrics_before: GrowthProspectGraphExpansionMetrics
  metrics_after: GrowthProspectGraphExpansionMetrics
  metrics_delta: Partial<GrowthProspectGraphExpansionMetrics>
  evidence_versions_created: number
  outreach_ready_estimate: {
    before: number
    after: number
    delta: number
  }
  messages: string[]
}
