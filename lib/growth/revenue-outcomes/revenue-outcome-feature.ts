/**
 * GE-AIOS-SDR-2C — Revenue outcome integration feature flags (client-safe).
 */

export function isRevenueOutcomeIntegrationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GROWTH_REVENUE_OUTCOME_INTEGRATION === "true") return true
  if (env.GROWTH_REVENUE_OUTCOME_INTEGRATION === "false") return false
  if (env.GROWTH_DAILY_REVENUE_WORK_QUEUE === "true") return true
  if (env.GROWTH_COMMUNICATION_STRATEGY === "true") return true
  if (env.GROWTH_NATIVE_DECISION_ENGINE === "true") return true
  return false
}
