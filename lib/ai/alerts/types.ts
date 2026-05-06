export const AI_ALERT_TYPES = [
  "monthly_budget_near_limit",
  "monthly_budget_exceeded",
  "plan_limit_blocked",
  "repeated_task_failures",
  "provider_failure_spike",
  "cache_error_spike",
  "job_stuck_processing",
  "high_cost_single_request",
] as const

export type AiAlertType = (typeof AI_ALERT_TYPES)[number]

export const AI_ALERT_SEVERITIES = ["info", "warning", "critical"] as const
export type AiAlertSeverity = (typeof AI_ALERT_SEVERITIES)[number]

export const AI_ALERT_STATUSES = ["open", "acknowledged", "resolved"] as const
export type AiAlertStatus = (typeof AI_ALERT_STATUSES)[number]

export type CreateAiAlertInput = {
  organizationId?: string | null
  alertType: AiAlertType
  severity: AiAlertSeverity
  title: string
  message: string
  metadata?: Record<string, unknown> | null
  dedupeWindowMinutes?: number
}

