/**
 * GE-IRE-8B — Revenue execution plan feature flags (client-safe).
 */

export const GROWTH_REVENUE_EXECUTION_PLAN_PANEL_QA_MARKER =
  "revenue-execution-plan-panel-v1" as const

export function isRevenueExecutionPlanEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_REVENUE_EXECUTION_PLAN === "true"
}

export function isRevenueExecutionPlanEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_REVENUE_EXECUTION_PLAN === "true"
}
