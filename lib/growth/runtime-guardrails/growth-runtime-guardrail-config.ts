/** GS-RG-1 — centralized runtime guardrail limits (client-safe). */

export const GROWTH_RUNTIME_GUARDRAILS_QA_MARKER =
  "growth-runtime-guardrails-gs-rg-1c-v1" as const

export const GROWTH_RUNTIME_GUARDRAILS_SCHEMA_MIGRATION =
  "20270901120000_growth_runtime_guardrails_gs_rg_1.sql" as const

/** Hard caps — every runtime feature must answer these before shipping. */
export const GROWTH_RUNTIME_GUARDRAIL_LIMITS = {
  MAX_SEARCH_RESULTS: 500,
  MAX_SEARCHES_PER_HOUR: 120,
  MAX_ESTIMATE_CALLS_PER_HOUR: 240,
  MAX_REFRESH_CALLS_PER_HOUR: 60,
  MAX_AUDIENCE_REFRESH_SIZE: 2_000,
  MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT: 10_000,
  MAX_AUDIENCE_REFRESHES_PER_DAY: 20,
  MAX_AUDIENCE_GENERATIONS_PER_HOUR: 10,
  MAX_AUDIENCE_ENROLLMENTS_PER_RUN: 100,
  MAX_AUDIENCE_ENROLLMENTS_PER_DAY: 500,
  MAX_AUDIENCE_DIFF_MEMBERS: 10_000,
  MAX_AUDIENCE_REFRESH_BATCH: 500,
  MAX_AUDIENCE_LEAD_CREATIONS_PER_RUN: 100,
  MAX_AUDIENCE_LEAD_CREATIONS_PER_DAY: 500,
  MAX_WAKE_EVALUATIONS_PER_RUN: 50,
  MAX_WAKE_EVALUATIONS_PER_ORG: 500,
  MAX_MEDIA_EVENTS_PER_SESSION: 200,
  MAX_MEDIA_ROLLUP_BATCH: 500,
  MAX_ENRICHMENTS_PER_DAY: 5_000,
  MAX_SEQUENCE_ENROLLMENTS_PER_DAY: 2_000,
  MAX_AUTOMATION_EXECUTIONS_PER_DAY: 1_000,
  MAX_HEADLESS_OBJECTIVES_PER_DAY: 500,
  MAX_EVENT_SIDE_EFFECTS: 20,
  RAW_EVENT_RETENTION_DAYS: 90,
  RETENTION_DELETE_BATCH: 1_000,
} as const

export type GrowthRuntimeResourceType =
  | "searches"
  | "estimates"
  | "refreshes"
  | "hydrations"
  | "enrichments"
  | "wake_evaluations"
  | "media_events"
  | "sequence_enrollments"
  | "automation_executions"
  | "headless_objectives"
  | "event_side_effects"
  | "audience_generations"
  | "audience_refreshes"
  | "audience_enrollments"
  | "audience_diffs"
  | "audience_lead_creations"

export type GrowthRuntimeBudgetWindowKind = "hourly" | "daily" | "monthly"

export type GrowthRuntimeKillSwitchKey =
  | "wake_execution_enabled"
  | "media_rollup_enabled"
  | "search_execution_enabled"
  | "retention_worker_enabled"
  | "cascade_budget_enforcement_enabled"
  | "audience_snapshot_enabled"
  | "audience_diff_enabled"
  | "audience_lead_creation_enabled"

export const GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES: Record<GrowthRuntimeKillSwitchKey, boolean> = {
  wake_execution_enabled: true,
  media_rollup_enabled: true,
  search_execution_enabled: true,
  retention_worker_enabled: true,
  cascade_budget_enforcement_enabled: true,
  audience_snapshot_enabled: true,
  audience_diff_enabled: true,
  audience_lead_creation_enabled: true,
}

/** Daily budget caps keyed by resource type. Zero = unlimited. */
export const GROWTH_RUNTIME_DAILY_BUDGET_CAPS: Partial<Record<GrowthRuntimeResourceType, number>> = {
  searches: 500,
  estimates: 1_000,
  refreshes: 200,
  hydrations: 2_000,
  enrichments: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_ENRICHMENTS_PER_DAY,
  wake_evaluations: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_WAKE_EVALUATIONS_PER_ORG,
  media_events: 50_000,
  sequence_enrollments: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_SEQUENCE_ENROLLMENTS_PER_DAY,
  automation_executions: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUTOMATION_EXECUTIONS_PER_DAY,
  headless_objectives: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_HEADLESS_OBJECTIVES_PER_DAY,
  audience_refreshes: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_REFRESHES_PER_DAY,
  audience_enrollments: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_DAY,
  audience_diffs: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_REFRESHES_PER_DAY,
  audience_lead_creations: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_LEAD_CREATIONS_PER_DAY,
}

/** Hourly budget caps keyed by resource type. */
export const GROWTH_RUNTIME_HOURLY_BUDGET_CAPS: Partial<Record<GrowthRuntimeResourceType, number>> = {
  searches: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_SEARCHES_PER_HOUR,
  estimates: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_ESTIMATE_CALLS_PER_HOUR,
  refreshes: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_REFRESH_CALLS_PER_HOUR,
  wake_evaluations: 200,
  audience_generations: GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_GENERATIONS_PER_HOUR,
}

/** Per-user hourly caps — evaluated AND org limits. */
export const GROWTH_RUNTIME_HOURLY_USER_BUDGET_CAPS: Partial<Record<GrowthRuntimeResourceType, number>> = {
  searches: 100,
  estimates: 200,
  refreshes: 50,
  hydrations: 500,
  audience_generations: 5,
}

export function getBudgetCapForResource(
  resourceType: GrowthRuntimeResourceType,
  windowKind: GrowthRuntimeBudgetWindowKind,
): number {
  if (windowKind === "hourly") {
    return GROWTH_RUNTIME_HOURLY_BUDGET_CAPS[resourceType] ?? 0
  }
  if (windowKind === "daily") {
    return GROWTH_RUNTIME_DAILY_BUDGET_CAPS[resourceType] ?? 0
  }
  return 0
}

export function getUserBudgetCapForResource(
  resourceType: GrowthRuntimeResourceType,
  windowKind: GrowthRuntimeBudgetWindowKind,
): number {
  if (windowKind === "hourly") {
    return GROWTH_RUNTIME_HOURLY_USER_BUDGET_CAPS[resourceType] ?? 0
  }
  return 0
}

export function truncateSearchResults<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  const cap = GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_SEARCH_RESULTS
  if (rows.length <= cap) return { rows, truncated: false }
  return { rows: rows.slice(0, cap), truncated: true }
}
