/**
 * GE-AIOS-SDR-1A — Communication strategy feature flags (client-safe).
 */

export const GROWTH_COMMUNICATION_STRATEGY_PANEL_QA_MARKER =
  "communication-strategy-panel-v1" as const

import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"

export function isCommunicationStrategyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GROWTH_COMMUNICATION_STRATEGY === "true") return true
  return isNativeRevenueDecisionEngineEnabled(env)
}

export function isCommunicationStrategyEnabledClient(): boolean {
  if (process.env.NEXT_PUBLIC_GROWTH_COMMUNICATION_STRATEGY === "true") return true
  return process.env.NEXT_PUBLIC_GROWTH_NATIVE_DECISION_ENGINE === "true"
}
