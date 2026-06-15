/** Phase GS-2C — Prospect execution run types (client-safe). */

import type { ProspectExecutionStageId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export const PROSPECT_DISCOVERY_EXECUTION_QA_MARKER = "growth-prospect-discovery-execution-gs2c-v1" as const

export const PROSPECT_DISCOVERY_EXECUTION_CONFIRM = "RUN_PROSPECT_DISCOVERY_EXECUTION" as const

export const PROSPECT_EXECUTION_RUN_STATUSES = [
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const

export type ProspectExecutionRunStatus = (typeof PROSPECT_EXECUTION_RUN_STATUSES)[number]

export type ProspectExecutionStageState = {
  stage_id: ProspectExecutionStageId
  status: "pending" | "running" | "completed" | "failed" | "skipped"
  started_at: string | null
  completed_at: string | null
  companies_delta: number
  contacts_delta: number
  credits_delta: number
  message: string | null
}

export type ProspectExecutionRun = {
  qa_marker: typeof PROSPECT_DISCOVERY_EXECUTION_QA_MARKER
  execution_run_id: string
  execution_plan_id: string
  search_plan_id: string
  operator_id: string | null
  status: ProspectExecutionRunStatus
  current_stage: ProspectExecutionStageId | null
  completed_stages: ProspectExecutionStageId[]
  stage_states: ProspectExecutionStageState[]
  estimated_progress_pct: number
  companies_discovered: number
  contacts_discovered: number
  credits_consumed: number
  warnings: string[]
  failures: string[]
  discovery_run_id: string | null
  company_ids: string[]
  qualified_company_ids: string[]
  signal_feed_routed_count: number
  execution_started_at: string | null
  execution_completed_at: string | null
  enrollment_enabled: false
  outreach_enabled: false
}

export type ProspectExecutionProgress = {
  qa_marker: typeof PROSPECT_DISCOVERY_EXECUTION_QA_MARKER
  execution_run_id: string
  status: ProspectExecutionRunStatus
  current_stage: ProspectExecutionStageId | null
  current_stage_label: string | null
  estimated_progress_pct: number
  companies_discovered: number
  contacts_discovered: number
  credits_consumed: number
  estimated_seconds_remaining: number | null
  warnings: string[]
  completed_stages: ProspectExecutionStageId[]
}

export type ProspectExecutionRunResults = {
  qa_marker: typeof PROSPECT_DISCOVERY_EXECUTION_QA_MARKER
  execution_run_id: string
  companies: GrowthProspectSearchCompanyResult[]
  qualified_companies: GrowthProspectSearchCompanyResult[]
  discovery_run_id: string | null
  signal_feed_routed_count: number
}

export type ProspectBudgetGuardAction = "continue" | "pause" | "abort"
