/**
 * GE-IRE-7D — Next best action feature flags (client-safe).
 */

export const GROWTH_NEXT_BEST_ACTION_PANEL_QA_MARKER = "next-best-action-panel-v1" as const

export function isNextBestActionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_NEXT_BEST_ACTION === "true"
}

export function isNextBestActionEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_NEXT_BEST_ACTION === "true"
}
