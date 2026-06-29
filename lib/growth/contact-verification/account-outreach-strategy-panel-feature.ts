/**
 * GE-IRE-6G — Account Outreach Strategy panel feature flags (client-safe).
 */

export const GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL_QA_MARKER =
  "account-outreach-strategy-panel-v1" as const

export function isAccountOutreachStrategyPanelEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL === "true"
}

export function isAccountOutreachStrategyPanelEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_ACCOUNT_OUTREACH_STRATEGY_PANEL === "true"
}
