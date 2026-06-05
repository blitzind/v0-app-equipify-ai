/** Prospect Search operator workspace (Phase 7.PS-FA). Client-safe. */

import type { GrowthProspectSearchEngineIntelligence } from "@/lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import type { GrowthProspectSearchEngineReadiness } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { GrowthProspectSearchPrioritizationTier } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { ProspectSearchIntelligenceCoverage } from "@/lib/growth/prospect-search/prospect-search-coverage-types"
import type { GrowthProspectSearchGrowthEngineJobLane } from "@/lib/growth/prospect-search/prospect-search-actionable-research-types"

export const GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER =
  "growth-prospect-search-workspace-7-ps-fa-v1" as const

export const GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER =
  "growth-prospect-search-workspace-7-ps-fb-v1" as const

export const GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER =
  "growth-prospect-search-workspace-7-ps-fc-v1" as const

export const GROWTH_PROSPECT_SEARCH_WORKSPACE_HA_FIX_QA_MARKER =
  "growth-prospect-search-workspace-7-ps-ha-fix-v1" as const

export const PROSPECT_SEARCH_WORKSPACE_BULK_EXECUTION_MAX_ACCOUNTS = 25

export type ProspectSearchWorkspaceBulkAccountExecutionStatus =
  | "enqueued"
  | "already_satisfied"
  | "skipped_blocked"
  | "failed"

export type ProspectSearchWorkspaceBulkAccountResult = {
  company_key: string
  company_name: string
  status: ProspectSearchWorkspaceBulkAccountExecutionStatus
  message: string
  lane: GrowthProspectSearchGrowthEngineJobLane | null
  job_id: string | null
  reason: string | null
}

export type ProspectSearchWorkspaceBulkExecutionResult = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER
  queue_id: ProspectSearchWorkspaceQueueId
  action_kind: ProspectSearchWorkspaceBulkActionKind
  requested_count: number
  executable_count: number
  skipped_count: number
  enqueued_count: number
  already_satisfied_count: number
  failed_count: number
  blocked_reasons: string[]
  per_account_results: ProspectSearchWorkspaceBulkAccountResult[]
}

export const PROSPECT_SEARCH_WORKSPACE_WORKLIST_KINDS = [
  "outreach_ready",
  "acquire_humans",
  "research_first",
  "missing_email",
  "missing_phone",
  "committee_gaps",
  "coverage_gaps",
  "unresolved_accounts",
] as const

export type ProspectSearchWorkspaceWorklistKind =
  (typeof PROSPECT_SEARCH_WORKSPACE_WORKLIST_KINDS)[number]

export type ProspectSearchWorkspaceWorklistRow = {
  company_key: string
  company_name: string
  canonical_company_id: string | null
  fields: Record<string, string | number | string[] | null>
}

export type ProspectSearchWorkspaceWorklist = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER
  kind: ProspectSearchWorkspaceWorklistKind
  label: string
  account_count: number
  rows: ProspectSearchWorkspaceWorklistRow[]
}

export type ProspectSearchWorkspaceWorklistMetrics = {
  visible_accounts: number
  selected_accounts: number
  executable_accounts: number
  blocked_accounts: number
}

export type ProspectSearchWorkspaceExecutionPreviewAccount = {
  company_key: string
  company_name: string
  recommended_action_kinds: string[]
  blocked_reasons: string[]
  canonical_company_id: string | null
  canonical_person_id: string | null
  contact_count: number
}

export type ProspectSearchWorkspaceExecutionPreview = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER
  queue_id: ProspectSearchWorkspaceQueueId | null
  selected_account_count: number
  affected_account_count: number
  affected_contact_count: number
  affected_canonical_company_count: number
  affected_canonical_person_count: number
  recommended_action_kinds: string[]
  accounts: ProspectSearchWorkspaceExecutionPreviewAccount[]
  planner_note: string
}

export const PROSPECT_SEARCH_WORKSPACE_PRIORITIZATION_AGGREGATES = [
  "accounts_ready_for_outreach",
  "accounts_with_gaps",
  "research_first_accounts",
  "insufficient_data_accounts",
] as const

export type ProspectSearchWorkspacePrioritizationAggregate =
  (typeof PROSPECT_SEARCH_WORKSPACE_PRIORITIZATION_AGGREGATES)[number]

export const PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS = [
  "acquire_humans",
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
  "acquire_humans",
  "research_queue",
  "committee_gaps",
  "missing_emails",
  "missing_phones",
  "low_coverage",
  "unresolved_accounts",
  "graph_expansion",
] as const

export type ProspectSearchWorkspaceViewId = (typeof PROSPECT_SEARCH_WORKSPACE_VIEW_IDS)[number]

export const PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_KINDS = [
  "human_acquisition",
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
