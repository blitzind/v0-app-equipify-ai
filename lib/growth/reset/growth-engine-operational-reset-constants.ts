/**
 * GE-AVA-FRESH-SLATE-1A — Safe Growth Engine operational data reset constants.
 */

export const GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER =
  "growth-engine-operational-reset-fresh-slate-1a-v1" as const

export const GROWTH_HOME_STALE_DATA_DIAGNOSTIC_QA_MARKER =
  "growth-home-stale-data-diagnostic-fresh-slate-1b-v1" as const

export const GROWTH_HOME_DEBUG_SOURCE_QA_MARKER =
  "growth-home-debug-source-fresh-slate-1c-v1" as const

export const GROWTH_RESET_SERVICE_ROLE_DELETE_GRANTS_QA_MARKER =
  "growth-reset-service-role-delete-grants-fresh-slate-1g-v1" as const

/** GE-AVA-FRESH-SLATE-1G — growth tables needing service_role DELETE for operational reset. */
export const GROWTH_RESET_SERVICE_ROLE_DELETE_GRANT_TABLES = [
  "ai_os_event_deliveries",
  "closed_loop_learning_events",
  "ai_os_events",
  "ai_executive_brain_runtime",
  "sequence_enrollment_channel_events",
  "growth_sendr_launch_runs",
  "opportunity_stage_history",
  "meetings",
  "cadence_tasks",
  "lead_timeline_events",
  "platform_timeline_events",
] as const

export const GROWTH_RESET_SERVICE_ROLE_DELETE_GRANTS_MIGRATION =
  "supabase/migrations/20271001260000_growth_reset_service_role_delete_grants.sql" as const

/** Precision Biomedical AI OS workspace — default target org. */
export const PRECISION_BIOMEDICAL_AI_OS_ORG_ID = "5876176a-61ec-4532-ad99-0c31482d5a91" as const

export const GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV =
  "GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID" as const

export const REPORT_PATHS = {
  before: "tmp/growth-engine-operational-reset-before.json",
  after: "tmp/growth-engine-operational-reset-after.json",
  summary: "tmp/growth-engine-operational-reset-summary.json",
} as const

export type GrowthEngineOperationalResetCategory =
  | "ai_os_command_center"
  | "approvals_human_execution"
  | "outreach_sequence_runtime"
  | "lead_research"
  | "notifications"
  | "dashboard_counters"
  | "inbox_intelligence"
  | "automation_runs"
  | "deliverability_ops_snapshots"
  | "home_entity_runtime"
  | "home_inbox_conversations"
  | "home_pipeline_meetings"

export type GrowthEngineOperationalResetScopeKind =
  | "organization_id"
  | "org_id"
  | "lead_id"
  | "lead_pk"
  | "thread_id"
  | "job_id"
  | "opportunity_id"
  /** Platform/runtime rows with no tenant column — scoped via id IS NOT NULL (required WHERE). */
  | "workspace_disposable"
  /** lead_inbox has no org/lead FK — full queue clear via id IS NOT NULL. */
  | "lead_inbox_queue"
