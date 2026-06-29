/** Phase GS-2B — Prospect Execution Plan types (client-safe). */

import type { ProspectDiscoveryProvider, ProspectSearchPlan, ProspectSearchResultQuality } from "@/lib/growth/prospect-discovery/prospect-search-intent-types"

export const PROSPECT_EXECUTION_QA_MARKER = "growth-prospect-execution-gs2b-v1" as const

export const PROSPECT_EXECUTION_EXECUTE_CONFIRM =
  "RUN_PROSPECT_EXECUTION_PLANNER_CERTIFICATION" as const

export const PROSPECT_EXECUTION_STAGES = [
  "company_discovery",
  "signal_enrichment",
  "contact_discovery",
  "company_intelligence",
  "buying_committee_expansion",
  "qualification",
] as const

export type ProspectExecutionStageId = (typeof PROSPECT_EXECUTION_STAGES)[number]

export const PROSPECT_BUDGET_GUARD_RAIL_LEVELS = ["low", "medium", "high", "expensive"] as const

export type ProspectBudgetGuardRailLevel = (typeof PROSPECT_BUDGET_GUARD_RAIL_LEVELS)[number]

export const PROSPECT_EXECUTION_READINESS_STATUSES = [
  "ready",
  "partially_ready",
  "blocked",
] as const

export type ProspectExecutionReadinessStatus = (typeof PROSPECT_EXECUTION_READINESS_STATUSES)[number]

export type ProspectExecutionStage = {
  stage_id: ProspectExecutionStageId
  label: string
  order: number
  providers: ProspectDiscoveryProvider[]
  description: string
}

export type ProspectExecutionCostBreakdown = {
  apollo_credits: number
  pdl_lookup_units: number
  serp_requests: number
  google_places_requests: number
  website_crawl_pages: number
  total_provider_units: number
}

export type ProspectExecutionPlan = {
  qa_marker: typeof PROSPECT_EXECUTION_QA_MARKER
  search_plan_id: string
  providers: ProspectDiscoveryProvider[]
  provider_order: ProspectDiscoveryProvider[]
  execution_stages: ProspectExecutionStage[]
  estimated_companies: number
  estimated_contacts: number
  estimated_credits: number
  estimated_runtime_seconds: number
  estimated_result_quality: ProspectSearchResultQuality
  cost_breakdown: ProspectExecutionCostBreakdown
  budget_guardrail: ProspectBudgetGuardRailLevel
  warnings: string[]
  risks: string[]
  requires_human_approval: true
  execution_enabled: false
}

export type ProspectExecutionReadinessReason = {
  code: string
  severity: "info" | "warning" | "blocker"
  message: string
  provider?: ProspectDiscoveryProvider | null
}

export type ProspectExecutionReadiness = {
  qa_marker: typeof PROSPECT_EXECUTION_QA_MARKER
  search_plan_id: string | null
  status: ProspectExecutionReadinessStatus
  reasons: ProspectExecutionReadinessReason[]
  provider_status: Array<{
    provider: ProspectDiscoveryProvider
    configured: boolean
    enabled: boolean
    blocker: string | null
  }>
  requires_human_approval: true
  execution_enabled: false
}

export type ProspectExecutionPlanApproval = {
  qa_marker: typeof PROSPECT_EXECUTION_QA_MARKER
  approval_id: string
  search_plan_id: string
  execution_plan_id: string
  status: "approved"
  approved_at: string
  approved_by_user_id: string | null
  execution_enabled: false
  outreach_enabled: false
  enrollment_enabled: false
}

export type ProspectExecutionPlanInput = {
  search_plan: ProspectSearchPlan
  search_plan_id?: string | null
}

export type ProspectProviderEnvSnapshot = {
  apollo_configured: boolean
  apollo_enabled: boolean
  apollo_disabled: boolean
  pdl_configured: boolean
  pdl_enabled: boolean
  pdl_disabled: boolean
  google_places_enabled: boolean
  serp_enabled: boolean
}
