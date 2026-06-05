/** Prospect Search operator workspace (Phase 7.PS-FA). Client-safe. */

import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import type { GrowthProspectSearchEngineReadiness } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { GrowthProspectSearchPrioritizationTier } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { ProspectSearchIntelligenceCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import type { GrowthProspectSearchGrowthEngineJobLane } from "@/lib/growth/prospect-search/prospect-search-actionable-research-types"

export const GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER =
  "growth-prospect-search-workspace-7-ps-fa-v1" as const

export const PROSPECT_SEARCH_WORKSPACE_PRIORITIZATION_AGGREGATES = [
  "accounts_ready_for_outreach",
  "accounts_with_gaps",
  "research_first_accounts",
  "insufficient_data_accounts",
] as const

export type ProspectSearchWorkspacePrioritizationAggregate =
  (typeof PROSPECT_SEARCH_WORKSPACE_PRIORITIZATION_AGGREGATES)[number]

export const PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS = [
  "missing_verified_email",
  "missing_verified_phone",
  "missing_verified_social",
  "missing_committee",
  "missing_company_intelligence",
  "unresolved_company",
  "unresolved_contacts",
] as const

export type ProspectSearchWorkspaceResearchQueueId =
  (typeof PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS)[number]

export const PROSPECT_SEARCH_WORKSPACE_COVERAGE_QUEUE_IDS = [
  "low_person_linkage",
  "single_thread_risk",
  "no_economic_buyer",
  "no_champion",
  "low_company_intelligence_coverage",
] as const

export type ProspectSearchWorkspaceCoverageQueueId =
  (typeof PROSPECT_SEARCH_WORKSPACE_COVERAGE_QUEUE_IDS)[number]

export type ProspectSearchWorkspaceQueueId =
  | ProspectSearchWorkspaceResearchQueueId
  | ProspectSearchWorkspaceCoverageQueueId

export const PROSPECT_SEARCH_WORKSPACE_VIEW_IDS = [
  "outreach_ready",
  "research_queue",
  "committee_gaps",
  "missing_emails",
  "missing_phones",
  "low_coverage",
  "unresolved_accounts",
] as const

export type ProspectSearchWorkspaceViewId = (typeof PROSPECT_SEARCH_WORKSPACE_VIEW_IDS)[number]

export const PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_KINDS = [
  "email_discovery",
  "phone_discovery",
  "social_profile_discovery",
  "company_intelligence",
  "buying_committee_intelligence",
] as const

export type ProspectSearchWorkspaceBulkActionKind =
  (typeof PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_KINDS)[number]

export type ProspectSearchWorkspaceCompanyRef = {
  company_key: string
  company_id: string
  source_type: string
  company_name: string
  canonical_company_id: string | null
  growth_lead_id: string | null
  readiness: GrowthProspectSearchEngineReadiness | null
  coverage: ProspectSearchIntelligenceCoverage | null
  engine: GrowthProspectSearchEngineIntelligence | null
}

export type ProspectSearchWorkspacePrioritizationRollup = {
  key: ProspectSearchWorkspacePrioritizationAggregate
  label: string
  count: number
  company_keys: string[]
}

export type ProspectSearchWorkspaceQueueRollup = {
  queue_id: ProspectSearchWorkspaceQueueId
  label: string
  description: string
  count: number
  company_keys: string[]
}

export type ProspectSearchWorkspaceAggregates = {
  prioritization: ProspectSearchWorkspacePrioritizationRollup[]
  research_queues: ProspectSearchWorkspaceQueueRollup[]
  coverage_queues: ProspectSearchWorkspaceQueueRollup[]
}

export type ProspectSearchWorkspaceHealth = {
  account_count: number
  hydrated_account_count: number
  canonical_company_coverage_pct: number
  person_linkage_pct: number
  verified_channel_coverage_pct: number
  committee_coverage_pct: number
  company_intelligence_coverage_pct: number
  outreach_ready_pct: number
}

export type ProspectSearchWorkspaceViewDefinition = {
  id: ProspectSearchWorkspaceViewId
  label: string
  description: string
  prioritization_tiers?: GrowthProspectSearchPrioritizationTier[]
  queue_ids?: ProspectSearchWorkspaceQueueId[]
  match_mode: "any_queue" | "all_queues" | "tier_only"
}

export type ProspectSearchWorkspaceViewMatch = {
  view_id: ProspectSearchWorkspaceViewId
  label: string
  count: number
  company_keys: string[]
}

export type ProspectSearchWorkspaceBulkBlockedAccount = {
  company_key: string
  company_name: string
  reason: string
}

export type ProspectSearchWorkspaceBulkExecutableAccount = {
  company_key: string
  company_name: string
  lane: GrowthProspectSearchGrowthEngineJobLane
  canonical_company_id: string | null
  canonical_person_id: string | null
}

export type ProspectSearchWorkspaceBulkActionPlan = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER
  action_kind: ProspectSearchWorkspaceBulkActionKind
  lane: GrowthProspectSearchGrowthEngineJobLane
  label: string
  description: string
  action_count: number
  executable_count: number
  blocked_count: number
  affected_account_count: number
  affected_company_count: number
  affected_person_count: number
  executable_accounts: ProspectSearchWorkspaceBulkExecutableAccount[]
  blocked_accounts: ProspectSearchWorkspaceBulkBlockedAccount[]
  planner_note: string
}

export type GrowthProspectSearchOperatorWorkspace = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER
  account_count: number
  aggregates: ProspectSearchWorkspaceAggregates
  health: ProspectSearchWorkspaceHealth
  views: ProspectSearchWorkspaceViewMatch[]
  company_refs: ProspectSearchWorkspaceCompanyRef[]
}
