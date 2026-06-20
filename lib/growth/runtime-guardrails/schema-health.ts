/** GS-RG-1 — schema health constants. */

export const GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION =
  "20270901120000_growth_runtime_guardrails_gs_rg_1.sql" as const

export const GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_MIGRATION =
  "20270901130000_growth_runtime_guardrails_gs_rg_1c.sql" as const

export const GROWTH_RUNTIME_GUARDRAILS_SCHEMA_TABLES = [
  "growth.runtime_budgets",
  "growth.runtime_guardrail_settings",
  "growth.runtime_wake_batch_state",
  "growth.growth_event_retention_config",
  "growth.video_page_rollups",
  "growth.runtime_cascade_budgets",
  "growth.runtime_search_audit_log",
  "growth.runtime_guardrail_audit_log",
  "growth.runtime_retention_batch_state",
] as const

export const GROWTH_RUNTIME_GUARDRAILS_1C_SCHEMA_TABLES = [
  "growth.runtime_user_budgets",
  "growth.runtime_health_counters",
] as const
