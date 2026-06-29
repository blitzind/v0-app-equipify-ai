/**
 * GE-AVA-FRESH-SLATE-1A — Safe Growth Engine operational data reset constants.
 */

export const GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER =
  "growth-engine-operational-reset-fresh-slate-1a-v1" as const

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

export type GrowthEngineOperationalResetScopeKind =
  | "organization_id"
  | "org_id"
  | "lead_id"
  | "single_tenant"
