/**
 * GE-IRE-8A — Native revenue decision integration feature flags (client-safe).
 */

export const GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER = "native-revenue-decision-engine-v1" as const

export function isNativeRevenueDecisionEngineEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.GROWTH_NATIVE_DECISION_ENGINE === "true"
}

export function isNativeRevenueDecisionEngineEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_NATIVE_DECISION_ENGINE === "true"
}
