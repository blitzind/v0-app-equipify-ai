/** GE-LAUNCH-1A — Unified revenue workflow feature flags (client-safe). */

import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"

export function isUnifiedRevenueWorkflowEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GROWTH_UNIFIED_REVENUE_WORKFLOW === "true") return true
  return isNativeRevenueDecisionEngineEnabled(env)
}

export function isUnifiedRevenueWorkflowEnabledClient(): boolean {
  if (process.env.NEXT_PUBLIC_GROWTH_UNIFIED_REVENUE_WORKFLOW === "true") return true
  return process.env.NEXT_PUBLIC_GROWTH_NATIVE_DECISION_ENGINE === "true"
}
