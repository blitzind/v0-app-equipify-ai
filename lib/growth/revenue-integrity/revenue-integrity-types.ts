/** Phase RV-1B — Revenue persistence integrity types (client-safe). */

export const REVENUE_INTEGRITY_QA_MARKER = "revenue-integrity-rv1b-v1" as const

export const REVENUE_INTEGRITY_CERTIFICATION_ID = "revenue-integrity-rv1b-v1" as const

export const REVENUE_INTEGRITY_EXECUTE_CONFIRM = "RUN_REVENUE_INTEGRITY_CERTIFICATION" as const

export const REVENUE_INTEGRITY_HENRY_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56" as const
export const REVENUE_INTEGRITY_HENRY_MEETING_ID = "263d2c2c-e9ee-425b-8b5c-5d79ce99088e" as const
export const REVENUE_INTEGRITY_HENRY_DRAFT_ID = "dc9a273b-f176-4cba-9ffd-c5c3276ec01c" as const
export const REVENUE_INTEGRITY_HENRY_OPPORTUNITY_ID = "80df826d-024c-47df-8618-2f31caba3726" as const

export const REVENUE_PERSISTENCE_INTEGRITY_CHECKS = [
  "opportunity_row_exists",
  "draft_opportunity_id_linked",
  "attribution_references_existing_row",
  "dashboard_counts_existing_row",
  "deal_intelligence_references_existing_row",
  "revenue_forecast_references_existing_row",
  "recompute_hooks_succeed",
  "transaction_rollback_protection",
  "duplicate_prevention",
] as const

export type RevenuePersistenceIntegrityCheckId = (typeof REVENUE_PERSISTENCE_INTEGRITY_CHECKS)[number]

export type RevenuePersistenceScenario =
  | "healthy"
  | "phantom_opportunity_reference"
  | "orphaned_opportunity_for_lead"
  | "draft_not_converted"
  | "draft_not_found"

export type RevenuePersistenceInvestigation = {
  qa_marker: typeof REVENUE_INTEGRITY_QA_MARKER
  draft_id: string
  scenario: RevenuePersistenceScenario
  draft_status: string | null
  draft_opportunity_id: string | null
  draft_lead_id: string | null
  opportunity_row_exists: boolean
  opportunity_by_lead_id: string | null
  attribution_touch_count: number
  attribution_opportunity_created: boolean
  attribution_opportunity_won: boolean
  revenue_event_count: number
  stage_history_count: number
  root_cause_hypothesis: string
  evidence: Record<string, unknown>
}

export type RevenuePersistenceRepairAction =
  | "none"
  | "recompute_only"
  | "restore_opportunity_row"
  | "link_draft_to_existing_opportunity"

export type RevenuePersistenceRepairReport = {
  qa_marker: typeof REVENUE_INTEGRITY_QA_MARKER
  ok: boolean
  dry_run: boolean
  draft_id: string
  action: RevenuePersistenceRepairAction
  investigation: RevenuePersistenceInvestigation
  opportunity_id: string | null
  blockers: string[]
  warnings: string[]
  steps: Array<{ step: string; ok: boolean; detail: Record<string, unknown> }>
}
