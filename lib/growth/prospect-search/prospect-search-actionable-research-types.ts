/** Prospect Search — actionable Growth Engine research (Phase 7.PS-C). Client-safe. */

export const GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER =
  "growth-prospect-search-actionable-research-7-ps-c-v1" as const

export const GROWTH_PROSPECT_SEARCH_GROWTH_ENGINE_JOB_LANES = [
  "email_discovery",
  "phone_discovery",
  "social_profile_discovery",
  "company_intelligence",
  "buying_committee_intelligence",
  "legacy_contact_discovery",
] as const

export type GrowthProspectSearchGrowthEngineJobLane =
  (typeof GROWTH_PROSPECT_SEARCH_GROWTH_ENGINE_JOB_LANES)[number]

export type GrowthProspectSearchActionableResearchPlan = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER
  lane: GrowthProspectSearchGrowthEngineJobLane
  label: string
  description: string
  requires_canonical_company: boolean
  requires_canonical_person: boolean
  can_execute: boolean
  blocked_reason: string | null
  company_id: string | null
  person_id: string | null
  discovery_scope?: "person" | "company"
}

export type GrowthProspectSearchActionableResearchExecuteResult = {
  ok: boolean
  lane: GrowthProspectSearchGrowthEngineJobLane
  enqueued: boolean
  message: string
  job_id?: string | null
  reason?: string | null
}

export type GrowthProspectSearchEngineDiscoveryRollupLane = {
  key: string
  label: string
  status: string
  status_tone: "verified" | "pending" | "gap" | "blocked"
  hint: string | null
}

export type GrowthProspectSearchEngineDiscoveryRollup = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER
  lanes: GrowthProspectSearchEngineDiscoveryRollupLane[]
  summary: string | null
}
