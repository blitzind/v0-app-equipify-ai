/**
 * GE-AIOS-SDR-2A — Daily revenue work queue feature flags (client-safe).
 */

import { isCommunicationStrategyEnabled } from "@/lib/growth/contact-verification/communication-strategy-feature"

export const GROWTH_DAILY_REVENUE_WORK_QUEUE_PANEL_QA_MARKER =
  "daily-revenue-work-queue-panel-v1" as const

export function isDailyRevenueWorkQueueEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GROWTH_DAILY_REVENUE_WORK_QUEUE === "true") return true
  return isCommunicationStrategyEnabled(env)
}

export function isDailyRevenueWorkQueueEnabledClient(): boolean {
  if (process.env.NEXT_PUBLIC_GROWTH_DAILY_REVENUE_WORK_QUEUE === "true") return true
  return process.env.NEXT_PUBLIC_GROWTH_COMMUNICATION_STRATEGY === "true"
}
