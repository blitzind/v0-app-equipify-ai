/** Growth Engine — Prospect Search + ICP Builder types (Prompt 23). Client-safe. */

import type { GrowthCompanySignalUiSummary } from "@/lib/growth/company-signals/company-signal-types"
import type { GrowthSignalTier } from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import type { GrowthTerritoryIntelligenceSummary } from "@/lib/growth/territory-intelligence/territory-intelligence-types"
import type { GrowthCompanyConfidenceScore } from "@/lib/growth/confidence-intelligence/confidence-intelligence-types"
import type { GrowthCompanyRelationship } from "@/lib/growth/market-intelligence/market-intelligence-types"
import type { GrowthProspectSearchCommitteeCompletion } from "@/lib/growth/market-intelligence/integrations/prospect-search-market-overlay"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import type { GrowthBuyingStage } from "@/lib/growth/buying-stage/buying-stage-types"
import type { GrowthSearchIntentCategory } from "@/lib/growth/search-intent/search-intent-types"
import type { GrowthSignalType } from "@/lib/growth/signals/signal-types"
import { GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER } from "@/lib/growth/real-world-discovery/providers/serp-types"
import { GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER } from "@/lib/growth/real-world-discovery/providers/google-places-query-expansion"
import { GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER } from "@/lib/growth/real-world-discovery/live-provider-query-expansion"
import { GROWTH_PROVIDER_CACHE_QA_MARKER } from "@/lib/growth/provider-cache/provider-cache-types"
import type { GrowthProspectSearchExternalFilterDiagnostics } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import type { GrowthProspectSearchProviderRuntimeDiagnostics } from "@/lib/growth/prospect-search/prospect-search-provider-runtime-diagnostics"
import {
  GROWTH_PROVIDER_RELAXED_FILTER_RETRY_QA_MARKER,
  GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-provider-runtime-diagnostics"
import {
  GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
  type GrowthSignalMomentumLabel,
} from "@/lib/growth/signals/company-signal-rollup"
import type { GrowthSignalAiInsightClientFields } from "@/lib/growth/signals/ai/signal-copilot-client-types"

export {
  GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER,
  GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER,
  GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER,
  GROWTH_PROVIDER_CACHE_QA_MARKER,
  GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
}

export type { GrowthSignalMomentumLabel }

export const GROWTH_PROSPECT_SEARCH_QA_MARKER = "growth-prospect-search-v1" as const

export const GROWTH_PROSPECT_SEARCH_SOURCE_TYPES = [
  "growth_lead",
  /** Legacy materialized index rows only — live loader uses growth_lead. */
  "lead_inbox",
  "crm_prospect",
  "crm_customer",
  "external_discovered",
] as const

export const GROWTH_PROSPECT_SEARCH_DISCOVERY_MODES = [
  "internal",
  "discover_external",
] as const

export const GROWTH_PROSPECT_SEARCH_SORT_OPTIONS = ["rank", "signal_momentum"] as const

export type GrowthProspectSearchSortBy = (typeof GROWTH_PROSPECT_SEARCH_SORT_OPTIONS)[number]

export type GrowthProspectSearchDiscoveryMode =
  (typeof GROWTH_PROSPECT_SEARCH_DISCOVERY_MODES)[number]

export type GrowthProspectSearchSourceType = (typeof GROWTH_PROSPECT_SEARCH_SOURCE_TYPES)[number]

export const GROWTH_PROSPECT_SEARCH_EMPLOYEE_SIZE_BANDS = [
  "1-10",
  "11-20",
  "21-50",
  "51-100",
  "101-250",
  "251-500",
  "501-1000",
  "1000+",
  "unknown",
] as const

export type GrowthProspectSearchEmployeeSizeBand =
  (typeof GROWTH_PROSPECT_SEARCH_EMPLOYEE_SIZE_BANDS)[number]

export const GROWTH_PROSPECT_SEARCH_REVENUE_BANDS = [
  "under_1m",
  "1m_5m",
  "5m_10m",
  "10m_50m",
  "50m_100m",
  "100m+",
  "unknown",
] as const

export type GrowthProspectSearchRevenueBand = (typeof GROWTH_PROSPECT_SEARCH_REVENUE_BANDS)[number]

export const GROWTH_PROSPECT_SEARCH_EXISTING_ACCOUNT_MODES = [
  "any",
  "exclude_customers",
  "exclude_crm",
  "include_only",
  "exclude",
] as const

export type GrowthProspectSearchExistingAccountMode =
  (typeof GROWTH_PROSPECT_SEARCH_EXISTING_ACCOUNT_MODES)[number]

export const GROWTH_PROSPECT_SEARCH_SUPPRESSION_MODES = [
  "any",
  "exclude",
  "include_only",
  "suppressed_only",
] as const

export type GrowthProspectSearchSuppressionMode =
  (typeof GROWTH_PROSPECT_SEARCH_SUPPRESSION_MODES)[number]

export const GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS = [
  "save_search",
  "refresh_saved_search_counts",
  "delete_saved_search",
  "save_territory",
  "refresh_territory",
  "push_territory_top_prospects",
  "create_list",
  "push_to_lead_inbox",
  "bulk_push_to_lead_inbox",
  "run_lead_engine",
  "open_workspace",
  "record_prospect_workflow_continuity",
  "export_csv",
  "export_people_csv",
  "add_people_to_list",
  "refresh_people_verification",
  "refresh_visible_contacts",
  "refresh_stale_contacts",
  "enqueue_people_call_queue",
] as const

export type GrowthProspectSearchResultAction =
  (typeof GROWTH_PROSPECT_SEARCH_RESULT_ACTIONS)[number]

export type GrowthProspectSearchTerritoryRadiusFilter = {
  center_lat: number
  center_lng: number
  miles: number
  label?: string
}

export type GrowthProspectSearchTerritoryFilter = {
  country?: string
  states?: string[]
  cities?: string[]
  metros?: string[]
  postal_codes?: string[]
  radius?: GrowthProspectSearchTerritoryRadiusFilter
}

/** ICP Builder filter set — all optional facets. */
export type GrowthProspectSearchFilters = {
  industry?: string | null
  subindustry?: string | null
  employee_size_bands?: GrowthProspectSearchEmployeeSizeBand[]
  revenue_bands?: GrowthProspectSearchRevenueBand[]
  location?: string | null
  territory_filter?: GrowthProspectSearchTerritoryFilter
  service_area?: string | null
  company_age_years_min?: number | null
  company_age_years_max?: number | null
  keywords?: string[]
  naics_codes?: string[]
  excluded_naics_codes?: string[]
  sic_codes?: string[]
  excluded_sic_codes?: string[]
  technologies?: string[]
  crm_detected?: string | null
  website_platform?: string | null
  field_service_software?: string | null
  intent_score_min?: number | null
  buying_stages?: GrowthBuyingStage[]
  search_intent_categories?: GrowthSearchIntentCategory[]
  company_identification_confidence_min?: number | null
  returning_visitor_only?: boolean
  existing_account_mode?: GrowthProspectSearchExistingAccountMode
  suppression_mode?: GrowthProspectSearchSuppressionMode
  lead_score_min?: number | null
  decision_maker_role?: string | null
  title_contains?: string | null
  verification_status?: string | null
  priority?: string | null
  source_types?: GrowthProspectSearchSourceType[]
  growth_signal_score_min?: number | null
  growth_signal_tiers?: GrowthSignalTier[]
  territory_id?: string | null
  /** Growth Engine 7.3–7.5: company has ≥1 verified email on canonical persons (7.PS-B). */
  engine_verified_email?: boolean
  /** Growth Engine 7.3–7.5: company has ≥1 verified phone (7.PS-B). */
  engine_verified_phone?: boolean
  /** Growth Engine 7.5: company has ≥1 verified social profile (7.PS-B). */
  engine_verified_profile?: boolean
  /** Growth Engine 7.7: at least one selected committee role present (7.PS-B). */
  buying_committee_roles?: import("@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types").GrowthBuyingCommitteeIntelligenceRole[]
  /** Growth Engine 7.6: at least one selected intelligence category present (7.PS-B). */
  company_intelligence_categories?: import("@/lib/growth/company-intelligence/company-intelligence-types").GrowthCompanyIntelligenceCategory[]
  /** Phase 7.PS-D — readiness prioritization tier filter (post-hydration). */
  prioritization_tiers?: import("@/lib/growth/prospect-search/prospect-search-engine-readiness-types").GrowthProspectSearchPrioritizationTier[]
  /** Phase 7.PS-D — research completeness filter (post-hydration). */
  research_completeness?: import("@/lib/growth/prospect-search/prospect-search-engine-readiness-types").GrowthProspectSearchResearchCompleteness[]
}

export type GrowthProspectSearchParsedQuery = {
  raw_query: string
  keywords: string[]
  industry_hints: string[]
  location_hints: string[]
  employee_min: number | null
  employee_max: number | null
  title_hints: string[]
}

export type GrowthProspectSearchIndexCompany = {
  id: string
  source_type: GrowthProspectSearchSourceType
  company_name: string
  website: string | null
  industry: string | null
  subindustry: string | null
  employees: string | null
  revenue_range: string | null
  location: string | null
  city: string | null
  state: string | null
  postal_code?: string | null
  country?: string | null
  metro?: string | null
  lat?: number | null
  lng?: number | null
  service_area: string | null
  notes: string | null
  keywords: string[]
  crm_detected: string | null
  website_platform: string | null
  field_service_software: string | null
  intent_score: number | null
  buying_stage: string | null
  buying_stage_confidence: number | null
  buying_stage_reason: string | null
  buying_stage_last_assessed_at: string | null
  lead_score: number | null
  lead_engine_score: number | null
  lead_engine_score_label: string | null
  lead_engine_score_explanation: string | null
  lead_engine_last_run_at: string | null
  company_match_confidence: number | null
  decision_maker_count: number
  verification_status: string
  priority: string | null
  signals: string[]
  search_intent_category: string | null
  returning_visitor: boolean
  existing_account: boolean
  in_revenue_queue: boolean
  existing_customer: boolean
  existing_prospect: boolean
  already_pushed: boolean
  is_suppressed: boolean
  suppression_reason: string | null
  suppression_scope: string | null
  suppressed_at: string | null
  growth_lead_id: string | null
  prospect_id: string | null
  customer_id: string | null
  company_signal_summary?: GrowthCompanySignalUiSummary | null
  signal_confidence?: number | null
  signal_count?: number
}

export type GrowthProspectSearchIndexPerson = {
  id: string
  source_type: GrowthProspectSearchSourceType
  company_id: string
  company_name: string
  full_name: string | null
  title: string | null
  email: string | null
  phone: string | null
  role: string | null
  verification_status: string
}

export type GrowthProspectSearchCompanyResult = GrowthSignalAiInsightClientFields & {
  id: string
  source_type: GrowthProspectSearchSourceType
  /** Real-world / external discovery provider type when source_type is external_discovered. */
  discovery_provider_type?: string | null
  discovery_provider_name?: string | null
  discovery_source_badge?: string | null
  company_name: string
  website: string | null
  industry: string | null
  subindustry: string | null
  employees: string | null
  revenue_range: string | null
  location: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  metro?: string | null
  lat?: number | null
  lng?: number | null
  intent_score: number | null
  buying_stage: string | null
  buying_stage_confidence: number | null
  buying_stage_reason: string | null
  buying_stage_last_assessed_at: string | null
  lead_score: number | null
  lead_engine_score: number | null
  lead_engine_score_label: string | null
  lead_engine_score_explanation: string | null
  lead_engine_last_run_at: string | null
  confidence: number
  company_match_confidence: number | null
  decision_maker_coverage: number | null
  verification_status: string
  signals: string[]
  search_intent_category: string | null
  growth_lead_id: string | null
  prospect_id: string | null
  customer_id: string | null
  rank_score: number
  match_reasoning: string[]
  /** Evidence-backed company signal summary when intelligence run. */
  company_signal_summary?: GrowthCompanySignalUiSummary | null
  /** Average detector confidence when internal signals are hydrated. */
  signal_confidence?: number | null
  signal_count?: number
  service_area?: string | null
  crm_detected?: string | null
  website_platform?: string | null
  field_service_software?: string | null
  existing_account?: boolean
  in_revenue_queue?: boolean
  existing_customer?: boolean
  existing_prospect?: boolean
  already_pushed?: boolean
  is_suppressed?: boolean
  suppression_reason?: string | null
  suppression_scope?: string | null
  suppressed_at?: string | null
  score_explanation_items?: string[]
  confidence_explanation_items?: string[]
  recommended_next_step_reason?: string | null
  /** Deterministic pipeline automation overlay (Sprint 4.2). Does not affect rank_score. */
  recommended_next_action?: string | null
  recommended_next_action_reason?: string | null
  recommended_workflow_path?: string | null
  recommended_sequence_label?: string | null
  recommended_sequence_confidence?: number | null
  recommended_sequence_reason?: string | null
  recommended_first_touch?: string | null
  pipeline_automation?: import("@/lib/growth/prospect-search/prospect-pipeline-automation").GrowthProspectPipelineAutomationOverlay | null
  workflow_context_token?: string | null
  matched_territory_label?: string | null
  territory_match_reasons?: string[]
  /** Evidence-backed decision maker / committee overlay (Sprint 4C). */
  contact_intelligence?: GrowthProspectSearchContactIntelligence | null
  /** Resolved growth.companies id when Prospect Search links to canonical company (7.PS-A). */
  canonical_company_id?: string | null
  /** Multi-source growth signal score overlay. */
  growth_signal_score?: number | null
  growth_signal_tier?: GrowthSignalTier | null
  growth_signal_recommended_action?: string | null
  growth_signal_last_computed_at?: string | null
  /** Top related companies from market graph intelligence. */
  related_companies?: GrowthCompanyRelationship[]
  /** Evidence-backed confidence dimensions. */
  company_confidence?: GrowthCompanyConfidenceScore | null
  /** Expanded committee completion scoring. */
  committee_completion?: GrowthProspectSearchCommitteeCompletion | null
  /** Keyword hints for external discovery industry matching. */
  keywords?: string[]
  notes?: string | null
  /** Contact-first reachable human scoring overlay. */
  reachable_human?: import("@/lib/growth/prospect-search/prospect-search-reachable-human-scoring").ProspectSearchReachableHumanSnapshot | null
  contactability_status?: import("@/lib/growth/prospect-search/prospect-search-reachable-human-scoring").ProspectSearchReachableHumanLabel | null
  contact_first_rank_score?: number | null
  lightweight_mode?: boolean
  lightweight_market_index?: import("@/lib/growth/prospect-search/prospect-search-massive-market-index").ProspectSearchLightweightMarketIndexRecord | null
  progressive_enrichment?: import("@/lib/growth/prospect-search/prospect-search-progressive-enrichment").ProspectSearchProgressiveEnrichmentPlan | null
  /** Intent Signals momentum overlay (Milestone E). */
  signal_momentum_score?: number | null
  signal_momentum_label?: GrowthSignalMomentumLabel | null
  recent_signal_count?: number | null
  latest_signal_summary?: string | null
  top_signal_types?: GrowthSignalType[]
  hiring_intensity?: string | null
  watchlist_matches?: Array<{ watchlist_id: string; watchlist_name: string }>
  signal_evidence_count?: number | null
  signal_intelligence_qa_marker?: typeof GROWTH_SIGNAL_MOMENTUM_QA_MARKER | null
}

export type GrowthProspectSearchPersonResult = {
  id: string
  source_type: GrowthProspectSearchSourceType
  company_id: string
  company_name: string
  full_name: string | null
  title: string | null
  email: string | null
  phone: string | null
  role: string | null
  verification_status: string
  rank_score: number
}

/** Serializable People row payload for Prospect Search actions. */
export type GrowthProspectSearchPeopleActionRow = {
  id: string
  contact_id: string
  company_id: string
  company_name: string
  full_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  source_label?: string | null
  source_page_url?: string | null
  confidence?: number
  verification_status?: string
  outreach_ready?: boolean
  call_ready?: boolean
  sms_ready?: boolean
  call_eligibility?: string
  sms_eligibility?: string
  email_eligibility?: string
  call_block_reason?: string | null
  sms_block_reason?: string | null
  compliance_status?: string
  freshness_status?: string
  last_verified_at?: string | null
  discovered_at?: string | null
  verification_expires_at?: string | null
  email_verification_depth?: string
  phone_verification_depth?: string
  confidence_label?: string
  confidence_reason?: string
  stale_warning?: string | null
  outreach_rank_score?: number
  priority_tier?: string
  persona_type?: string
  persona_icp_relevance?: number
  ranking_reasons?: string[]
  recommended_next_action?: string
  is_recommended_contact?: boolean
  company?: GrowthProspectSearchCompanyResult | null
}

/** Normalized Discover search row — company + optional primary contact fields. */
export type GrowthProspectSearchDiscoverResult = {
  company_id: string
  provider_company_id?: string | null
  company_name: string
  domain?: string | null
  website?: string | null
  industry?: string | null
  location?: string | null
  employee_count?: string | null
  company_size?: string | null
  revenue?: string | null
  contact_id?: string | null
  provider_contact_id?: string | null
  contact_name?: string | null
  contact_title?: string | null
  contact_email?: string | null
  contact_email_status?: string | null
  contact_phone?: string | null
  contact_phone_status?: string | null
  source_provider?: string | null
  confidence?: number | null
  evidence?: string | null
  lead_score?: number | null
  icp_fit?: number | null
  buying_stage?: string | null
  buying_signals?: string[]
  /** Full company payload for intelligence panels. */
  company: GrowthProspectSearchCompanyResult
  contact_coverage_status?: string | null
  contact_coverage_label?: string | null
}

export type GrowthProspectSearchProviderDiagnostic = {
  provider_type: string
  provider_name: string
  provider_executed: boolean
  provider_latency_ms: number
  provider_result_count: number
  provider_fallback_reason?: string | null
  provider_query_generated?: string[]
  provider_query_result_count?: number[]
  provider_merged_result_count?: number
  provider_cache_hit?: boolean
  provider_cache_age_ms?: number | null
  provider_cost_estimate?: number
  provider_live_request_count?: number
  provider_cache_hit_count?: number
}

export type GrowthProspectSearchIndexDiagnostics = {
  index_mode: "materialized" | "fallback"
  index_row_count: number | null
  last_indexed_at: string | null
  territory_radius_note?: string | null
}

export type GrowthProspectSearchResult = {
  qa_marker: typeof GROWTH_PROSPECT_SEARCH_QA_MARKER
  discovery_mode: GrowthProspectSearchDiscoveryMode
  query: string
  parsed_query: GrowthProspectSearchParsedQuery
  filters: GrowthProspectSearchFilters
  companies: GrowthProspectSearchCompanyResult[]
  people: GrowthProspectSearchPersonResult[]
  /** Discover mode: provider rows before post-search filters. */
  raw_provider_companies?: GrowthProspectSearchCompanyResult[]
  discover_results?: GrowthProspectSearchDiscoverResult[]
  filtered_discover_results?: GrowthProspectSearchDiscoverResult[]
  total_companies: number
  total_people: number
  page?: number
  page_size?: number
  has_next_page?: boolean
  index_diagnostics?: GrowthProspectSearchIndexDiagnostics
  source_counts: Record<GrowthProspectSearchSourceType, number>
  external_discovery_run_id?: string | null
  real_world_discovery_run_id?: string | null
  real_world_built_query?: string | null
  provider_messages?: string[]
  provider_status_label?: string | null
  provider_status_message?: string | null
  provider_diagnostics?: GrowthProspectSearchProviderDiagnostic[]
  provider_fallback_reason?: string | null
  provider_audit_qa_marker?: typeof GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER | null
  google_places_query_expansion_qa_marker?: typeof GROWTH_GOOGLE_PLACES_QUERY_EXPANSION_QA_MARKER | null
  live_provider_query_expansion_qa_marker?: typeof GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER | null
  provider_cache_qa_marker?: typeof GROWTH_PROVIDER_CACHE_QA_MARKER | null
  external_filter_diagnostics?: GrowthProspectSearchExternalFilterDiagnostics
  provider_runtime_diagnostics?: GrowthProspectSearchProviderRuntimeDiagnostics
  used_relaxed_external_filters?: boolean
  provider_runtime_diagnostics_qa_marker?: typeof GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER | null
  provider_relaxed_filter_retry_qa_marker?: typeof GROWTH_PROVIDER_RELAXED_FILTER_RETRY_QA_MARKER | null
  sort_by?: GrowthProspectSearchSortBy
  signal_momentum_qa_marker?: typeof GROWTH_SIGNAL_MOMENTUM_QA_MARKER | null
  expanded_search_exhausted?: boolean
  territory_intelligence?: GrowthTerritoryIntelligenceSummary | null
  discovery_hydration?: import("@/lib/growth/prospect-search/prospect-search-discovery-hydration").GrowthProspectSearchHydrationSnapshot | null
  contact_first_hydration?: import("@/lib/growth/prospect-search/prospect-search-contact-first-orchestration").GrowthProspectSearchContactFirstHydrationSnapshot | null
  contact_first_qa_marker?: typeof import("@/lib/growth/prospect-search/prospect-search-progressive-enrichment").GROWTH_CONTACT_FIRST_DISCOVERY_QA_MARKER | null
  scalable_search_qa_marker?: typeof import("@/lib/growth/prospect-search/prospect-search-scalable-pagination").GROWTH_SCALABLE_PROSPECT_SEARCH_QA_MARKER | null
  result_mode?: import("@/lib/growth/prospect-search/prospect-search-contact-discovery").ProspectSearchResultMode
  people_rows?: import("@/lib/growth/prospect-search/prospect-search-contact-discovery").GrowthProspectSearchPeopleResultRow[]
  people_cursor?: string | null
  people_next_cursor?: string | null
  contact_native_search_qa_marker?: typeof import("@/lib/growth/prospect-search/prospect-search-contact-native-index").GROWTH_CONTACT_NATIVE_SEARCH_QA_MARKER | null
  contact_native_pagination_qa_marker?: typeof import("@/lib/growth/prospect-search/prospect-search-contact-native-search").GROWTH_CONTACT_NATIVE_PAGINATION_QA_MARKER | null
  prospeo_style_results_qa_marker?: typeof import("@/lib/growth/prospect-search/prospect-search-contact-native-search").GROWTH_PROSPEO_STYLE_RESULTS_QA_MARKER | null
  progressive_company_overlay_qa_marker?: typeof import("@/lib/growth/prospect-search/prospect-search-contact-native-search").GROWTH_PROGRESSIVE_COMPANY_OVERLAY_QA_MARKER | null
  discovery_runtime_hardening_qa_marker?: typeof import("@/lib/growth/prospect-search/prospect-search-safe-fetch-json").GROWTH_DISCOVERY_RUNTIME_HARDENING_QA_MARKER | null
}

export type GrowthProspectSearchSavedSearchRow = {
  id: string
  created_at: string
  updated_at: string
  created_by: string | null
  name: string
  query_text: string
  filters: GrowthProspectSearchFilters
  metadata: Record<string, unknown>
}

export type GrowthProspectSearchListRow = {
  id: string
  created_at: string
  updated_at: string
  created_by: string | null
  name: string
  description: string
  member_count: number
  metadata: Record<string, unknown>
}

export type GrowthProspectSearchListMemberRow = {
  id: string
  created_at: string
  list_id: string
  source_type: GrowthProspectSearchSourceType | "person"
  source_id: string
  company_name: string
  snapshot: Record<string, unknown>
}

export type GrowthProspectSearchActionResult = {
  ok: boolean
  action: GrowthProspectSearchResultAction
  message: string
  growth_lead_id?: string | null
  list_id?: string | null
  saved_search_id?: string | null
  territory_id?: string | null
  workspace_url?: string | null
  push_outcome?: "pushed" | "already_exists" | "skipped_invalid" | "suppressed" | "failed"
  selected_total?: number
  pushed?: number
  already_exists?: number
  skipped_invalid?: number
  suppressed?: number
  failed?: number
  bulk_items?: Array<{
    outcome: "pushed" | "already_exists" | "skipped_invalid" | "suppressed" | "failed"
    company_name: string
    source_type: GrowthProspectSearchSourceType
    message: string
  }>
  export_csv_content?: string
  export_csv_filename?: string
}
