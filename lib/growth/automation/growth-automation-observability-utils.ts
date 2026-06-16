/** Growth Engine S5-L — automation runtime observability helpers (client-safe). */

import { readAutomationExecutionMetadata } from "@/lib/growth/automation/growth-automation-runtime-execution-utils"
import type { GrowthAutomationRuntimeMetadata } from "@/lib/growth/automation/growth-automation-runtime-publisher-types"
import {
  GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
  GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS,
  type GrowthAutomationRuntimeActivityEntry,
  type GrowthAutomationRuntimeCounts,
  type GrowthAutomationRuntimeEnrollmentSnapshot,
  type GrowthAutomationRuntimeFailureSnapshot,
  type GrowthAutomationRuntimeHealthState,
  type GrowthAutomationRuntimeHealthSummary,
  type GrowthAutomationRuntimeKillSwitchState,
  type GrowthAutomationRuntimePendingJobSnapshot,
  type GrowthAutomationRuntimeStuckWaitSnapshot,
} from "@/lib/growth/automation/growth-automation-observability-types"

type RuntimeMetadataWithKillSwitch = GrowthAutomationRuntimeMetadata & {
  killSwitch?: GrowthAutomationRuntimeKillSwitchState | null
}

export function automationObservabilitySafetyPayload(): typeof GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS }
}

export function readRuntimeKillSwitch(
  metadata: GrowthAutomationRuntimeMetadata | null | undefined,
): GrowthAutomationRuntimeKillSwitchState {
  const killSwitch = (metadata as RuntimeMetadataWithKillSwitch | null)?.killSwitch
  return {
    enabled: Boolean(killSwitch?.enabled),
    reason: killSwitch?.reason ?? null,
    enabledAt: killSwitch?.enabledAt ?? null,
    enabledBy: killSwitch?.enabledBy ?? null,
  }
}

export function isRuntimeKillSwitchEnabled(
  metadata: GrowthAutomationRuntimeMetadata | null | undefined,
): boolean {
  return readRuntimeKillSwitch(metadata).enabled
}

export function mergeRuntimeKillSwitch(
  metadata: GrowthAutomationRuntimeMetadata,
  killSwitch: GrowthAutomationRuntimeKillSwitchState,
): RuntimeMetadataWithKillSwitch {
  return {
    ...metadata,
    killSwitch,
  }
}

export function classifyAutomationEnrollmentRuntimeStatus(input: {
  sequenceStatus: string
  enrollmentStalled: boolean
  executionMeta: Record<string, unknown>
}): string {
  const lastStatus = String(input.executionMeta.last_status ?? "")
  if (input.sequenceStatus === "completed") return "completed"
  if (input.sequenceStatus === "cancelled") return "cancelled"
  if (lastStatus === "approval_required" || lastStatus === "approved") return "approval_required"
  if (lastStatus === "waiting" || input.sequenceStatus === "paused") return "waiting"
  if (lastStatus === "failed" || lastStatus === "blocked") return "failed"
  if (input.sequenceStatus === "active") return input.enrollmentStalled ? "blocked" : "active"
  if (input.sequenceStatus === "draft") return "draft"
  return input.sequenceStatus
}

export function buildEnrollmentSnapshot(row: Record<string, unknown>): GrowthAutomationRuntimeEnrollmentSnapshot {
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  const executionMeta = readAutomationExecutionMetadata(metadata)
  const sequenceStatus = String(row.status ?? "draft")

  return {
    enrollmentId: String(row.id ?? ""),
    leadId: String(row.lead_id ?? ""),
    status: sequenceStatus,
    runtimeStatus: classifyAutomationEnrollmentRuntimeStatus({
      sequenceStatus,
      enrollmentStalled: Boolean(row.enrollment_stalled),
      executionMeta,
    }),
    currentStepOrder: Number(row.current_step_order ?? 0),
    enrollmentStalled: Boolean(row.enrollment_stalled),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  }
}

export function aggregateRuntimeCounts(input: {
  enrollments: GrowthAutomationRuntimeEnrollmentSnapshot[]
  jobs: GrowthAutomationRuntimePendingJobSnapshot[]
  stuckWaits: GrowthAutomationRuntimeStuckWaitSnapshot[]
  failures: GrowthAutomationRuntimeFailureSnapshot[]
}): GrowthAutomationRuntimeCounts {
  return {
    totalEnrollments: input.enrollments.length,
    activeEnrollments: input.enrollments.filter((entry) => entry.runtimeStatus === "active").length,
    waitingEnrollments: input.enrollments.filter((entry) => entry.runtimeStatus === "waiting").length,
    approvalRequiredEnrollments: input.enrollments.filter(
      (entry) => entry.runtimeStatus === "approval_required" || entry.runtimeStatus === "blocked",
    ).length,
    completedEnrollments: input.enrollments.filter((entry) => entry.runtimeStatus === "completed").length,
    failedEnrollments: input.enrollments.filter((entry) => entry.runtimeStatus === "failed").length,
    cancelledEnrollments: input.enrollments.filter((entry) => entry.runtimeStatus === "cancelled").length,
    pendingApprovalJobs: input.jobs.filter((job) => job.status === "pending_approval").length,
    approvedButNotExecutedJobs: input.jobs.filter((job) => job.status === "approved").length,
    rejectedJobs: input.jobs.filter((job) => job.status === "blocked" || job.status === "skipped").length,
    stuckWaits: input.stuckWaits.length,
  }
}

export function calculateRuntimeHealth(input: {
  counts: GrowthAutomationRuntimeCounts
  runtimeStatus: string
  activationStatus: string | null
  killSwitch: GrowthAutomationRuntimeKillSwitchState
}): GrowthAutomationRuntimeHealthSummary {
  const reasons: string[] = []
  let state: GrowthAutomationRuntimeHealthState = "unknown"

  if (input.killSwitch.enabled) {
    state = "blocked"
    reasons.push("Runtime kill switch is enabled.")
  } else if (input.activationStatus === "failed" || input.activationStatus === "archived") {
    state = "blocked"
    reasons.push(`Runtime activation status is ${input.activationStatus}.`)
  } else if (input.counts.stuckWaits > 0) {
    state = "degraded"
    reasons.push(`${input.counts.stuckWaits} stuck wait(s) detected.`)
  } else if (input.runtimeStatus === "runtime_paused" && input.counts.activeEnrollments > 0) {
    state = "degraded"
    reasons.push("Runtime paused with active enrollments still in flight.")
  } else if (
    input.counts.approvalRequiredEnrollments > 0 ||
    input.counts.pendingApprovalJobs > 0
  ) {
    state = "attention"
    reasons.push("Operator review required for pending approvals.")
  } else if (input.counts.failedEnrollments > 0) {
    state = "attention"
    reasons.push(`${input.counts.failedEnrollments} failed enrollment(s) need review.`)
  } else if (input.activationStatus === "active" && input.runtimeStatus === "runtime_active") {
    state = "healthy"
    reasons.push("Runtime active with no blocking signals.")
  } else if (!input.activationStatus) {
    state = "unknown"
    reasons.push("Runtime metadata unavailable.")
  } else {
    state = "attention"
    reasons.push(`Runtime status is ${input.runtimeStatus}.`)
  }

  return {
    state,
    summary: reasons[0] ?? "Runtime health evaluated.",
    reasons,
    killSwitchEnabled: input.killSwitch.enabled,
    runtimeActive: input.runtimeStatus === "runtime_active" && input.activationStatus === "active",
  }
}

export function formatRecentActivityEntries(input: {
  enrollments: GrowthAutomationRuntimeEnrollmentSnapshot[]
  jobs: GrowthAutomationRuntimePendingJobSnapshot[]
  stuckWaits: GrowthAutomationRuntimeStuckWaitSnapshot[]
  failures: GrowthAutomationRuntimeFailureSnapshot[]
  limit?: number
}): GrowthAutomationRuntimeActivityEntry[] {
  const entries: GrowthAutomationRuntimeActivityEntry[] = []

  for (const enrollment of input.enrollments) {
    entries.push({
      activityId: `enrollment:${enrollment.enrollmentId}:${enrollment.updatedAt}`,
      occurredAt: enrollment.updatedAt,
      category: "enrollment",
      severity:
        enrollment.runtimeStatus === "failed"
          ? "error"
          : enrollment.runtimeStatus === "approval_required"
            ? "warning"
            : "info",
      summary: `Enrollment ${enrollment.runtimeStatus} · step ${enrollment.currentStepOrder}`,
      enrollmentId: enrollment.enrollmentId,
      leadId: enrollment.leadId,
    })
  }

  for (const job of input.jobs) {
    entries.push({
      activityId: `job:${job.jobId}:${job.updatedAt}`,
      occurredAt: job.updatedAt,
      category: "approval",
      severity: job.status === "pending_approval" ? "warning" : "info",
      summary: `${job.channel} job ${job.status}`,
      enrollmentId: job.enrollmentId,
      leadId: job.leadId,
    })
  }

  for (const wait of input.stuckWaits) {
    entries.push({
      activityId: `wait:${wait.waitId}`,
      occurredAt: wait.startedAt ?? new Date().toISOString(),
      category: "wait",
      severity: "warning",
      summary: wait.detail,
      enrollmentId: wait.enrollmentId,
      leadId: null,
    })
  }

  for (const failure of input.failures) {
    entries.push({
      activityId: failure.failureId,
      occurredAt: failure.occurredAt,
      category: "execution",
      severity: "error",
      summary: failure.summary,
      enrollmentId: failure.enrollmentId,
      leadId: failure.leadId,
    })
  }

  return entries
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, input.limit ?? 20)
}

export function detectStuckWaits(
  rows: Array<Record<string, unknown>>,
  now = new Date(),
): GrowthAutomationRuntimeStuckWaitSnapshot[] {
  const stuck: GrowthAutomationRuntimeStuckWaitSnapshot[] = []

  for (const row of rows) {
    if (String(row.status ?? "") !== "waiting") continue
    const timeoutAt = typeof row.timeout_at === "string" ? row.timeout_at : null
    const startedAt = typeof row.started_at === "string" ? row.started_at : null
    const timedOut = timeoutAt ? Date.parse(timeoutAt) <= now.getTime() : false
    const stale =
      startedAt != null && now.getTime() - Date.parse(startedAt) > 7 * 24 * 60 * 60 * 1000

    if (!timedOut && !stale) continue

    stuck.push({
      waitId: String(row.id ?? ""),
      enrollmentId: String(row.enrollment_id ?? ""),
      enrollmentStepId: String(row.enrollment_step_id ?? ""),
      waitKind: String(row.wait_kind ?? "unknown"),
      status: String(row.status ?? "waiting"),
      timeoutAt,
      startedAt,
      detail: timedOut
        ? "Wait timeout elapsed — enrollment may be stalled."
        : "Wait active beyond review window — operator attention recommended.",
    })
  }

  return stuck
}

export function buildFailureSnapshots(
  enrollments: GrowthAutomationRuntimeEnrollmentSnapshot[],
): GrowthAutomationRuntimeFailureSnapshot[] {
  return enrollments
    .filter((entry) => entry.runtimeStatus === "failed")
    .map((entry) => ({
      failureId: `failure:${entry.enrollmentId}`,
      enrollmentId: entry.enrollmentId,
      leadId: entry.leadId,
      category: "enrollment",
      summary: `Enrollment blocked or failed at step ${entry.currentStepOrder}.`,
      occurredAt: entry.updatedAt,
    }))
}

export { GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER }
