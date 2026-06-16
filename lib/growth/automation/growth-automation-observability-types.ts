/** Growth Engine S5-L — automation runtime observability types (client-safe). */

export const GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER = "growth-automation-observability-s5l-v1" as const

export const GROWTH_AUTOMATION_RUNTIME_HEALTH_STATES = [
  "healthy",
  "attention",
  "degraded",
  "blocked",
  "unknown",
] as const
export type GrowthAutomationRuntimeHealthState = (typeof GROWTH_AUTOMATION_RUNTIME_HEALTH_STATES)[number]

export const GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS = {
  observability_enabled: true,
  management_controls_enabled: true,
  message_send_execution_enabled: false,
  provider_execution_enabled: false,
  notifications_enabled: false,
  autonomous_execution_enabled: false,
  requires_human_review: true,
  no_message_sends: true,
  no_provider_execution: true,
  no_notifications: true,
  no_autonomous_execution: true,
  no_background_jobs: true,
} as const

export type GrowthAutomationObservabilitySafetyFlags = typeof GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS

export type GrowthAutomationRuntimeKillSwitchState = {
  enabled: boolean
  reason: string | null
  enabledAt: string | null
  enabledBy: string | null
}

export type GrowthAutomationRuntimeCounts = {
  totalEnrollments: number
  activeEnrollments: number
  waitingEnrollments: number
  approvalRequiredEnrollments: number
  completedEnrollments: number
  failedEnrollments: number
  cancelledEnrollments: number
  pendingApprovalJobs: number
  approvedButNotExecutedJobs: number
  rejectedJobs: number
  stuckWaits: number
}

export type GrowthAutomationRuntimeEnrollmentSnapshot = {
  enrollmentId: string
  leadId: string
  status: string
  runtimeStatus: string
  currentStepOrder: number
  enrollmentStalled: boolean
  updatedAt: string
}

export type GrowthAutomationRuntimePendingJobSnapshot = {
  jobId: string
  enrollmentId: string
  leadId: string
  channel: string
  status: string
  scheduledFor: string
  updatedAt: string
}

export type GrowthAutomationRuntimeActivityEntry = {
  activityId: string
  occurredAt: string
  category: "enrollment" | "execution" | "approval" | "wait" | "management"
  severity: "info" | "warning" | "error"
  summary: string
  enrollmentId: string | null
  leadId: string | null
}

export type GrowthAutomationRuntimeStuckWaitSnapshot = {
  waitId: string
  enrollmentId: string
  enrollmentStepId: string
  waitKind: string
  status: string
  timeoutAt: string | null
  startedAt: string | null
  detail: string
}

export type GrowthAutomationRuntimeFailureSnapshot = {
  failureId: string
  enrollmentId: string
  leadId: string
  category: string
  summary: string
  occurredAt: string
}

export type GrowthAutomationRuntimeHealthSummary = {
  state: GrowthAutomationRuntimeHealthState
  summary: string
  reasons: string[]
  killSwitchEnabled: boolean
  runtimeActive: boolean
}

export type GrowthAutomationRuntimeObservabilitySnapshot = {
  observabilityId: string
  flowId: string
  compiledPatternId: string | null
  generatedAt: string
  runtimeStatus: string
  health: GrowthAutomationRuntimeHealthSummary
  counts: GrowthAutomationRuntimeCounts
  killSwitch: GrowthAutomationRuntimeKillSwitchState
  activeEnrollments: GrowthAutomationRuntimeEnrollmentSnapshot[]
  waitingEnrollments: GrowthAutomationRuntimeEnrollmentSnapshot[]
  approvalRequiredEnrollments: GrowthAutomationRuntimeEnrollmentSnapshot[]
  pendingJobs: GrowthAutomationRuntimePendingJobSnapshot[]
  recentActivity: GrowthAutomationRuntimeActivityEntry[]
  stuckWaits: GrowthAutomationRuntimeStuckWaitSnapshot[]
  failures: GrowthAutomationRuntimeFailureSnapshot[]
  safety: GrowthAutomationObservabilitySafetyFlags
}

export type GrowthAutomationRuntimeManagementResult = {
  ok: boolean
  action: string
  runtimeStatus: string
  killSwitch: GrowthAutomationRuntimeKillSwitchState
  detail: string
}
