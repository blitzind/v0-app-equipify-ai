/** Growth Engine S5-M — automation analytics + audit types (client-safe). */

import type { GrowthAutomationRuntimeHealthSummary } from "@/lib/growth/automation/growth-automation-observability-types"

export const GROWTH_AUTOMATION_ANALYTICS_QA_MARKER = "growth-automation-analytics-s5m-v1" as const

export const GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS = {
  analytics_enabled: true,
  audit_enabled: true,
  read_only: true,
  message_send_execution_enabled: false,
  provider_execution_enabled: false,
  notifications_enabled: false,
  autonomous_execution_enabled: false,
  requires_human_review: true,
} as const

export type GrowthAutomationAnalyticsSafetyFlags = typeof GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS

export type GrowthAutomationAnalyticsCounts = {
  totalEnrollments: number
  activeEnrollments: number
  waitingEnrollments: number
  approvalRequiredEnrollments: number
  completedEnrollments: number
  failedEnrollments: number
  cancelledEnrollments: number
  duplicateEnrollments: number
}

export type GrowthAutomationBranchAnalyticsStat = {
  branchId: string
  trueCount: number
  falseCount: number
  timeoutCount: number
  averageDecisionTime: number | null
}

export type GrowthAutomationWaitAnalyticsStat = {
  waitId: string
  activeCount: number
  resolvedCount: number
  timeoutCount: number
  averageWaitDuration: number | null
  stuckCount: number
}

export type GrowthAutomationApprovalAnalyticsStat = {
  approvalCount: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  cancelledCount: number
  averageApprovalTime: number | null
}

export type GrowthAutomationJobAnalyticsStat = {
  pendingApprovalCount: number
  approvedNotExecutedCount: number
  rejectedCount: number
  actionTypeBreakdown: Array<{ actionType: string; count: number }>
}

export type GrowthAutomationCompletionAnalyticsStat = {
  completionRate: number
  completedCount: number
  enrolledCount: number
  averageCompletionTime: number | null
  medianCompletionTime: number | null
}

export const GROWTH_AUTOMATION_AUDIT_EVENT_TYPES = [
  "runtime_published",
  "runtime_activated",
  "runtime_paused",
  "runtime_resumed",
  "kill_switch_enabled",
  "kill_switch_disabled",
  "lead_enrolled",
  "lead_unenrolled",
  "step_advanced",
  "wait_started",
  "wait_resolved",
  "wait_timed_out",
  "approval_created",
  "approval_approved",
  "approval_rejected",
  "approval_cancelled",
  "job_created",
  "runtime_cancelled",
  "runtime_completed",
] as const

export type GrowthAutomationAuditEventType = (typeof GROWTH_AUTOMATION_AUDIT_EVENT_TYPES)[number]

export type GrowthAutomationAnalyticsBottleneck = {
  kind:
    | "long_wait"
    | "rejected_approval"
    | "pending_jobs"
    | "stuck_enrollment_group"
    | "paused_runtime"
    | "kill_switched_runtime"
  label: string
  count: number
  severity: "info" | "warning" | "critical"
  detail: string
  enrollmentId?: string | null
  waitId?: string | null
}

export type GrowthAutomationAnalyticsTimelineEntry = {
  timelineId: string
  occurredAt: string
  category: "runtime" | "enrollment" | "wait" | "approval" | "job" | "branch"
  summary: string
  enrollmentId: string | null
}

export type GrowthAutomationAuditTimelineEntry = {
  timestamp: string
  eventType: GrowthAutomationAuditEventType
  flowId: string
  enrollmentId: string | null
  stepId: string | null
  actorId: string | null
  summary: string
  metadata: Record<string, unknown>
}

export type GrowthAutomationAnalyticsSnapshot = {
  analyticsId: string
  flowId: string
  compiledPatternId: string | null
  generatedAt: string
  counts: GrowthAutomationAnalyticsCounts
  branchStats: GrowthAutomationBranchAnalyticsStat[]
  waitStats: GrowthAutomationWaitAnalyticsStat[]
  approvalStats: GrowthAutomationApprovalAnalyticsStat
  jobStats: GrowthAutomationJobAnalyticsStat
  completionStats: GrowthAutomationCompletionAnalyticsStat
  runtimeHealth: GrowthAutomationRuntimeHealthSummary
  topBottlenecks: GrowthAutomationAnalyticsBottleneck[]
  timeline: GrowthAutomationAnalyticsTimelineEntry[]
  safety: GrowthAutomationAnalyticsSafetyFlags
}

export type GrowthAutomationAuditTimelineSnapshot = {
  auditId: string
  flowId: string
  generatedAt: string
  entries: GrowthAutomationAuditTimelineEntry[]
  safety: GrowthAutomationAnalyticsSafetyFlags
}
