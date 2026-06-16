/** Growth Engine S5-M — automation analytics helpers (client-safe). */

import { readStoredAutomationApprovals } from "@/lib/growth/automation/growth-automation-approval-utils"
import type { GrowthAutomationApprovalRecord } from "@/lib/growth/automation/growth-automation-approval-types"
import {
  GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
  GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS,
  type GrowthAutomationAnalyticsBottleneck,
  type GrowthAutomationAnalyticsCounts,
  type GrowthAutomationAnalyticsTimelineEntry,
  type GrowthAutomationApprovalAnalyticsStat,
  type GrowthAutomationBranchAnalyticsStat,
  type GrowthAutomationCompletionAnalyticsStat,
  type GrowthAutomationJobAnalyticsStat,
  type GrowthAutomationWaitAnalyticsStat,
} from "@/lib/growth/automation/growth-automation-analytics-types"
import type {
  GrowthAutomationRuntimeEnrollmentSnapshot,
  GrowthAutomationRuntimePendingJobSnapshot,
} from "@/lib/growth/automation/growth-automation-observability-types"
import {
  aggregateRuntimeCounts,
  buildEnrollmentSnapshot,
  calculateRuntimeHealth,
  detectStuckWaits,
  readRuntimeKillSwitch,
} from "@/lib/growth/automation/growth-automation-observability-utils"
import { readAutomationExecutionMetadata } from "@/lib/growth/automation/growth-automation-runtime-execution-utils"
import type { GrowthAutomationRuntimeMetadata } from "@/lib/growth/automation/growth-automation-runtime-publisher-types"
import type { SequenceBranchDecision } from "@/lib/growth/sequences/conditions/sequence-branch-types"

export { GROWTH_AUTOMATION_ANALYTICS_QA_MARKER, GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS }

export function automationAnalyticsSafetyPayload(): typeof GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS }
}

export function isDuplicateEnrollmentRow(row: Record<string, unknown>): boolean {
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  const entryReason = String(metadata.entry_reason ?? "")
  if (/duplicate/i.test(entryReason)) return true

  const warnings = metadata.warnings
  if (Array.isArray(warnings)) {
    for (const warning of warnings) {
      if (warning && typeof warning === "object" && (warning as { ruleCode?: string }).ruleCode === "duplicate_enrollment") {
        return true
      }
    }
  }

  return Boolean(metadata.duplicate_enrollment)
}

export function aggregateAnalyticsCounts(input: {
  enrollmentRows: Array<Record<string, unknown>>
  enrollments: GrowthAutomationRuntimeEnrollmentSnapshot[]
}): GrowthAutomationAnalyticsCounts {
  const base = aggregateRuntimeCounts({
    enrollments: input.enrollments,
    jobs: [],
    stuckWaits: [],
    failures: [],
  })

  return {
    totalEnrollments: base.totalEnrollments,
    activeEnrollments: base.activeEnrollments,
    waitingEnrollments: base.waitingEnrollments,
    approvalRequiredEnrollments: base.approvalRequiredEnrollments,
    completedEnrollments: base.completedEnrollments,
    failedEnrollments: base.failedEnrollments,
    cancelledEnrollments: base.cancelledEnrollments,
    duplicateEnrollments: input.enrollmentRows.filter(isDuplicateEnrollmentRow).length,
  }
}

function resolveBranchId(decision: SequenceBranchDecision): string {
  return decision.edgeId ?? decision.conditionId ?? decision.patternStepId ?? decision.id
}

export function aggregateBranchStats(decisions: SequenceBranchDecision[]): GrowthAutomationBranchAnalyticsStat[] {
  const grouped = new Map<
    string,
    { trueCount: number; falseCount: number; timeoutCount: number; decisionTimes: number[] }
  >()

  for (const decision of decisions) {
    const branchId = resolveBranchId(decision)
    const bucket = grouped.get(branchId) ?? {
      trueCount: 0,
      falseCount: 0,
      timeoutCount: 0,
      decisionTimes: [],
    }

    if (decision.decision === "true") bucket.trueCount += 1
    else if (decision.decision === "false") bucket.falseCount += 1
    else if (decision.decision === "timeout") bucket.timeoutCount += 1

    const createdAt = Date.parse(decision.createdAt)
    const evaluatedAt = Date.parse(decision.evaluatedAt)
    if (Number.isFinite(createdAt) && Number.isFinite(evaluatedAt) && evaluatedAt >= createdAt) {
      bucket.decisionTimes.push(evaluatedAt - createdAt)
    }

    grouped.set(branchId, bucket)
  }

  return [...grouped.entries()]
    .map(([branchId, bucket]) => ({
      branchId,
      trueCount: bucket.trueCount,
      falseCount: bucket.falseCount,
      timeoutCount: bucket.timeoutCount,
      averageDecisionTime:
        bucket.decisionTimes.length > 0
          ? bucket.decisionTimes.reduce((sum, value) => sum + value, 0) / bucket.decisionTimes.length
          : null,
    }))
    .sort((left, right) => right.trueCount + right.falseCount + right.timeoutCount - (left.trueCount + left.falseCount + left.timeoutCount))
}

function resolveWaitGroupId(row: Record<string, unknown>): string {
  const patternStepId = typeof row.pattern_step_id === "string" ? row.pattern_step_id : null
  const waitKind = typeof row.wait_kind === "string" ? row.wait_kind : "unknown"
  return patternStepId ?? `${waitKind}:${String(row.enrollment_step_id ?? "unknown")}`
}

export function aggregateWaitStats(
  waitRows: Array<Record<string, unknown>>,
  now = new Date(),
): GrowthAutomationWaitAnalyticsStat[] {
  const grouped = new Map<
    string,
    {
      activeCount: number
      resolvedCount: number
      timeoutCount: number
      durations: number[]
      stuckCount: number
    }
  >()

  for (const row of waitRows) {
    const waitId = resolveWaitGroupId(row)
    const bucket = grouped.get(waitId) ?? {
      activeCount: 0,
      resolvedCount: 0,
      timeoutCount: 0,
      durations: [],
      stuckCount: 0,
    }
    const status = String(row.status ?? "")

    if (status === "pending" || status === "active") bucket.activeCount += 1
    if (status === "resolved") bucket.resolvedCount += 1
    if (status === "timed_out") bucket.timeoutCount += 1

    const startedAt = typeof row.started_at === "string" ? Date.parse(row.started_at) : NaN
    const resolvedAt = typeof row.resolved_at === "string" ? Date.parse(row.resolved_at) : NaN
    if (Number.isFinite(startedAt) && Number.isFinite(resolvedAt) && resolvedAt >= startedAt) {
      bucket.durations.push(resolvedAt - startedAt)
    }

    const timeoutAt = typeof row.timeout_at === "string" ? row.timeout_at : null
    const timedOut = timeoutAt ? Date.parse(timeoutAt) <= now.getTime() : false
    const stale =
      Number.isFinite(startedAt) && now.getTime() - startedAt > 7 * 24 * 60 * 60 * 1000
    if ((status === "pending" || status === "active") && (timedOut || stale)) {
      bucket.stuckCount += 1
    }

    grouped.set(waitId, bucket)
  }

  return [...grouped.entries()]
    .map(([waitId, bucket]) => ({
      waitId,
      activeCount: bucket.activeCount,
      resolvedCount: bucket.resolvedCount,
      timeoutCount: bucket.timeoutCount,
      averageWaitDuration:
        bucket.durations.length > 0
          ? bucket.durations.reduce((sum, value) => sum + value, 0) / bucket.durations.length
          : null,
      stuckCount: bucket.stuckCount,
    }))
    .sort((left, right) => right.activeCount + right.stuckCount - (left.activeCount + left.stuckCount))
}

export function collectApprovalRecords(
  enrollmentRows: Array<Record<string, unknown>>,
): GrowthAutomationApprovalRecord[] {
  const approvals: GrowthAutomationApprovalRecord[] = []

  for (const row of enrollmentRows) {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
    approvals.push(...readStoredAutomationApprovals(metadata))
  }

  return approvals
}

export function aggregateApprovalStats(approvals: GrowthAutomationApprovalRecord[]): GrowthAutomationApprovalAnalyticsStat {
  const durations: number[] = []

  for (const approval of approvals) {
    if (!approval.reviewedAt) continue
    const createdAt = Date.parse(approval.createdAt)
    const reviewedAt = Date.parse(approval.reviewedAt)
    if (Number.isFinite(createdAt) && Number.isFinite(reviewedAt) && reviewedAt >= createdAt) {
      durations.push(reviewedAt - createdAt)
    }
  }

  return {
    approvalCount: approvals.length,
    pendingCount: approvals.filter((entry) => entry.status === "pending").length,
    approvedCount: approvals.filter((entry) => entry.status === "approved").length,
    rejectedCount: approvals.filter((entry) => entry.status === "rejected").length,
    cancelledCount: approvals.filter((entry) => entry.status === "cancelled").length,
    averageApprovalTime:
      durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null,
  }
}

export function aggregateJobStats(input: {
  jobs: GrowthAutomationRuntimePendingJobSnapshot[]
  enrollmentRows: Array<Record<string, unknown>>
}): GrowthAutomationJobAnalyticsStat {
  const actionTypeBreakdown = new Map<string, number>()

  for (const row of input.enrollmentRows) {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
    const executionMeta = readAutomationExecutionMetadata(metadata)
    const pendingJobs = executionMeta.pending_jobs
    if (!Array.isArray(pendingJobs)) continue

    for (const job of pendingJobs) {
      if (!job || typeof job !== "object") continue
      const actionType = String((job as { actionType?: string }).actionType ?? "unknown_action")
      actionTypeBreakdown.set(actionType, (actionTypeBreakdown.get(actionType) ?? 0) + 1)
    }
  }

  return {
    pendingApprovalCount: input.jobs.filter((job) => job.status === "pending_approval").length,
    approvedNotExecutedCount: input.jobs.filter((job) => job.status === "approved").length,
    rejectedCount: input.jobs.filter((job) => job.status === "blocked" || job.status === "skipped").length,
    actionTypeBreakdown: [...actionTypeBreakdown.entries()]
      .map(([actionType, count]) => ({ actionType, count }))
      .sort((left, right) => right.count - left.count),
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

export function aggregateCompletionStats(input: {
  enrollmentRows: Array<Record<string, unknown>>
  enrollments: GrowthAutomationRuntimeEnrollmentSnapshot[]
}): GrowthAutomationCompletionAnalyticsStat {
  const completed = input.enrollments.filter((entry) => entry.runtimeStatus === "completed")
  const enrolledCount = input.enrollments.length
  const completionDurations: number[] = []

  for (const enrollment of completed) {
    const row = input.enrollmentRows.find((entry) => String(entry.id ?? "") === enrollment.enrollmentId)
    if (!row) continue
    const createdAt = Date.parse(String(row.created_at ?? ""))
    const updatedAt = Date.parse(enrollment.updatedAt)
    if (Number.isFinite(createdAt) && Number.isFinite(updatedAt) && updatedAt >= createdAt) {
      completionDurations.push(updatedAt - createdAt)
    }
  }

  return {
    completionRate: enrolledCount > 0 ? completed.length / enrolledCount : 0,
    completedCount: completed.length,
    enrolledCount,
    averageCompletionTime:
      completionDurations.length > 0
        ? completionDurations.reduce((sum, value) => sum + value, 0) / completionDurations.length
        : null,
    medianCompletionTime: median(completionDurations),
  }
}

export function detectTopBottlenecks(input: {
  waitRows: Array<Record<string, unknown>>
  approvals: GrowthAutomationApprovalRecord[]
  jobs: GrowthAutomationRuntimePendingJobSnapshot[]
  enrollmentRows: Array<Record<string, unknown>>
  runtimeStatus: string
  metadata: GrowthAutomationRuntimeMetadata | null
  limit?: number
}): GrowthAutomationAnalyticsBottleneck[] {
  const bottlenecks: GrowthAutomationAnalyticsBottleneck[] = []
  const killSwitch = readRuntimeKillSwitch(input.metadata)

  if (killSwitch.enabled) {
    bottlenecks.push({
      kind: "kill_switched_runtime",
      label: "Kill switch enabled",
      count: 1,
      severity: "critical",
      detail: killSwitch.reason ?? "Runtime kill switch blocks new enrollments.",
    })
  }

  if (input.runtimeStatus === "runtime_paused") {
    bottlenecks.push({
      kind: "paused_runtime",
      label: "Runtime paused",
      count: 1,
      severity: "warning",
      detail: "Runtime pattern is paused while enrollments may still be in flight.",
    })
  }

  const stuckWaits = detectStuckWaits(input.waitRows)
  for (const wait of stuckWaits.slice(0, 5)) {
    bottlenecks.push({
      kind: "long_wait",
      label: "Long wait",
      count: 1,
      severity: "warning",
      detail: wait.detail,
      enrollmentId: wait.enrollmentId,
      waitId: wait.waitId,
    })
  }

  const rejectedApprovals = input.approvals.filter((entry) => entry.status === "rejected")
  if (rejectedApprovals.length > 0) {
    bottlenecks.push({
      kind: "rejected_approval",
      label: "Rejected approvals",
      count: rejectedApprovals.length,
      severity: "warning",
      detail: `${rejectedApprovals.length} approval(s) rejected — enrollments may remain blocked.`,
    })
  }

  const pendingJobs = input.jobs.filter((job) => job.status === "pending_approval")
  if (pendingJobs.length > 0) {
    bottlenecks.push({
      kind: "pending_jobs",
      label: "Pending approval jobs",
      count: pendingJobs.length,
      severity: "warning",
      detail: `${pendingJobs.length} execution job(s) awaiting operator review.`,
    })
  }

  const leadCounts = new Map<string, number>()
  for (const row of input.enrollmentRows) {
    const leadId = String(row.lead_id ?? "")
    if (!leadId) continue
    leadCounts.set(leadId, (leadCounts.get(leadId) ?? 0) + 1)
  }
  const duplicateLeadGroups = [...leadCounts.values()].filter((count) => count > 1).length
  if (duplicateLeadGroups > 0) {
    bottlenecks.push({
      kind: "stuck_enrollment_group",
      label: "Duplicate lead enrollments",
      count: duplicateLeadGroups,
      severity: "info",
      detail: `${duplicateLeadGroups} lead(s) have multiple enrollment rows for this flow.`,
    })
  }

  return bottlenecks.slice(0, input.limit ?? 10)
}

export function buildAnalyticsTimeline(input: {
  enrollmentRows: Array<Record<string, unknown>>
  jobs: GrowthAutomationRuntimePendingJobSnapshot[]
  waitRows: Array<Record<string, unknown>>
  approvals: GrowthAutomationApprovalRecord[]
  limit?: number
}): GrowthAutomationAnalyticsTimelineEntry[] {
  const entries: GrowthAutomationAnalyticsTimelineEntry[] = []

  for (const row of input.enrollmentRows) {
    const enrollmentId = String(row.id ?? "")
    entries.push({
      timelineId: `enrollment:${enrollmentId}`,
      occurredAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
      category: "enrollment",
      summary: `Enrollment ${String(row.status ?? "unknown")}`,
      enrollmentId,
    })
  }

  for (const job of input.jobs) {
    entries.push({
      timelineId: `job:${job.jobId}`,
      occurredAt: job.updatedAt,
      category: "job",
      summary: `${job.channel} job ${job.status}`,
      enrollmentId: job.enrollmentId,
    })
  }

  for (const row of input.waitRows) {
    entries.push({
      timelineId: `wait:${String(row.id ?? "")}`,
      occurredAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
      category: "wait",
      summary: `Wait ${String(row.wait_kind ?? "unknown")} · ${String(row.status ?? "unknown")}`,
      enrollmentId: String(row.enrollment_id ?? ""),
    })
  }

  for (const approval of input.approvals) {
    entries.push({
      timelineId: `approval:${approval.approvalId}`,
      occurredAt: approval.reviewedAt ?? approval.updatedAt ?? approval.createdAt,
      category: "approval",
      summary: `Approval ${approval.status} · ${approval.actionType}`,
      enrollmentId: approval.enrollmentId,
    })
  }

  return entries
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, input.limit ?? 25)
}

export function buildAnalyticsRuntimeHealth(input: {
  counts: GrowthAutomationAnalyticsCounts
  jobs: GrowthAutomationRuntimePendingJobSnapshot[]
  waitRows: Array<Record<string, unknown>>
  runtimeStatus: string
  metadata: GrowthAutomationRuntimeMetadata | null
}) {
  const stuckWaits = detectStuckWaits(input.waitRows)
  const observabilityCounts = aggregateRuntimeCounts({
    enrollments: [],
    jobs: input.jobs,
    stuckWaits,
    failures: [],
  })

  return calculateRuntimeHealth({
    counts: {
      ...observabilityCounts,
      totalEnrollments: input.counts.totalEnrollments,
      activeEnrollments: input.counts.activeEnrollments,
      waitingEnrollments: input.counts.waitingEnrollments,
      approvalRequiredEnrollments: input.counts.approvalRequiredEnrollments,
      completedEnrollments: input.counts.completedEnrollments,
      failedEnrollments: input.counts.failedEnrollments,
      cancelledEnrollments: input.counts.cancelledEnrollments,
    },
    runtimeStatus: input.runtimeStatus,
    activationStatus: input.metadata?.activationStatus ?? null,
    killSwitch: readRuntimeKillSwitch(input.metadata),
  })
}

export function mapEnrollmentRowsToSnapshots(
  enrollmentRows: Array<Record<string, unknown>>,
): GrowthAutomationRuntimeEnrollmentSnapshot[] {
  return enrollmentRows.map((row) => buildEnrollmentSnapshot(row))
}
