/** Shared types for Communications Center (safe for client + server). */

export type CommunicationMetricsPayload = {
  emailsSentToday: number
  deliveryRatePercent: number | null
  deliveryRateSampleSize: number
  openRatePercent: number | null
  openRateIsEstimated: boolean
  failedDeliveries: number
  pendingFollowUps: number
  automatedRemindersWeek: number
  computedAtIso: string
}

export type CommunicationSuggestion = {
  id: string
  severity: "high" | "medium" | "low"
  title: string
  detail: string
  metric?: number
  href?: string
}

export type CommunicationAutomationRow = {
  key: string
  label: string
  trigger: string
  description: string
  eventTypes: string[]
  active: boolean
  lastRunAt: string | null
  nextScheduledLabel: string | null
  successCount30d: number
  failureCount30d: number
}
