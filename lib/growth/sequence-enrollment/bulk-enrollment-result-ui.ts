/** Client-safe bulk enrollment result + scheduler CTA helpers. */

import type { BulkSequenceEnrollmentResult } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
import type { PatternEnrollmentDetailView } from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import {
  growthSequenceExecutionHref,
} from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import type { GrowthSequenceSchedulerRunResult } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"

export const GROWTH_BULK_ENROLLMENT_RESULT_UI_QA_MARKER = "growth-bulk-enrollment-result-ui-v1" as const

export type BulkEnrollmentResultUiVariant = "success" | "warning" | "failure"

export type BulkEnrollmentResultUiState = {
  qaMarker: typeof GROWTH_BULK_ENROLLMENT_RESULT_UI_QA_MARKER
  variant: BulkEnrollmentResultUiVariant
  title: string
  description: string
  hasValidEnrollments: boolean
  showSchedulerCta: boolean
  showViewEnrollment: boolean
}

export function pickBulkEnrollmentPrimaryEnrollmentId(result: BulkSequenceEnrollmentResult): string | null {
  return (
    result.enrolled.find((entry) => entry.enrollmentId)?.enrollmentId ??
    result.skippedAlreadyEnrolled.find((entry) => entry.enrollmentId)?.enrollmentId ??
    null
  )
}

export function pickBulkEnrollmentPrimaryLeadId(
  result: BulkSequenceEnrollmentResult,
  fallbackLeadIds: string[],
): string | null {
  return (
    result.enrolled[0]?.leadId ??
    result.skippedAlreadyEnrolled[0]?.leadId ??
    fallbackLeadIds[0] ??
    null
  )
}

export function classifyBulkEnrollmentResult(result: BulkSequenceEnrollmentResult): BulkEnrollmentResultUiState {
  const enrolledCount = result.enrolled.length
  const alreadyEnrolledCount = result.skippedAlreadyEnrolled.length
  const failedCount = result.failed.length
  const blockedCount = result.skippedBlocked.length
  const hasValidEnrollments = enrolledCount + alreadyEnrolledCount > 0
  const primaryEnrollmentId = pickBulkEnrollmentPrimaryEnrollmentId(result)

  if (!hasValidEnrollments && failedCount > 0) {
    return {
      qaMarker: GROWTH_BULK_ENROLLMENT_RESULT_UI_QA_MARKER,
      variant: "failure",
      title: "No leads enrolled",
      description: "Every selected lead failed to enroll. Review the failure reasons below.",
      hasValidEnrollments: false,
      showSchedulerCta: false,
      showViewEnrollment: false,
    }
  }

  if (!hasValidEnrollments && blockedCount > 0 && failedCount === 0) {
    return {
      qaMarker: GROWTH_BULK_ENROLLMENT_RESULT_UI_QA_MARKER,
      variant: "failure",
      title: "No leads enrolled",
      description: "No leads could be enrolled because they were blocked by preflight or an existing sequence.",
      hasValidEnrollments: false,
      showSchedulerCta: false,
      showViewEnrollment: false,
    }
  }

  if (failedCount > 0 || blockedCount > 0) {
    return {
      qaMarker: GROWTH_BULK_ENROLLMENT_RESULT_UI_QA_MARKER,
      variant: "warning",
      title: "Enrollment processed with issues",
      description:
        "Some leads enrolled or were already enrolled, but others were blocked or failed. Review the details below.",
      hasValidEnrollments,
      showSchedulerCta: hasValidEnrollments,
      showViewEnrollment: Boolean(primaryEnrollmentId),
    }
  }

  return {
    qaMarker: GROWTH_BULK_ENROLLMENT_RESULT_UI_QA_MARKER,
    variant: "success",
    title: "Enrollment complete",
    description:
      "Pattern enrollment succeeded. Review results below and continue in the enrollment detail or execution console.",
    hasValidEnrollments,
    showSchedulerCta: hasValidEnrollments,
    showViewEnrollment: Boolean(primaryEnrollmentId),
  }
}

export function formatBulkEnrollmentOutcomeLeadLabel(
  entry: { leadId: string; leadLabel?: string },
): string {
  return entry.leadLabel?.trim() || entry.leadId.slice(0, 8)
}

export function formatBulkEnrollmentOutcomeDetail(entry: {
  code?: string
  reason?: string
}): string {
  return entry.reason?.trim() || entry.code?.replace(/_/g, " ") || "Unknown issue"
}

export function countSchedulerPlannedJobs(result: GrowthSequenceSchedulerRunResult): number {
  return Math.max(result.executionJobsPlanned ?? 0, result.outreachQueueItemsQueued ?? 0, result.queued ?? 0)
}

export function schedulerPlannedExecutionJobs(result: GrowthSequenceSchedulerRunResult): boolean {
  return countSchedulerPlannedJobs(result) > 0
}

export function pickPendingExecutionHighlightJobId(
  detail: PatternEnrollmentDetailView | null | undefined,
): string | undefined {
  return detail?.executionJobs.find((job) => ["draft", "pending_approval", "approved"].includes(job.status))?.id
}

export function buildBulkEnrollmentSchedulerExecutionHref(input: {
  schedulerResult: GrowthSequenceSchedulerRunResult
  enrollmentDetail?: PatternEnrollmentDetailView | null
  enrollmentId?: string | null
  leadId?: string | null
  sequencePatternId?: string | null
}): string | null {
  if (!schedulerPlannedExecutionJobs(input.schedulerResult)) return null
  const enrollmentId = input.enrollmentId ?? input.enrollmentDetail?.enrollment.id ?? null
  if (!enrollmentId) return null

  const hrefInput = {
    enrollmentId,
    leadId: input.leadId ?? input.enrollmentDetail?.leadId ?? undefined,
    sequencePatternId: input.sequencePatternId ?? input.enrollmentDetail?.enrollment.sequencePatternId ?? undefined,
    highlightJobId: pickPendingExecutionHighlightJobId(input.enrollmentDetail),
  }
  return growthSequenceExecutionHref(hrefInput)
}

export function explainSchedulerNoJobsPlanned(input: {
  schedulerResult: GrowthSequenceSchedulerRunResult
  enrollmentDetail?: PatternEnrollmentDetailView | null
  bulkResult?: BulkSequenceEnrollmentResult | null
}): string[] {
  const lines: string[] = []
  const { schedulerResult, enrollmentDetail, bulkResult } = input

  if (bulkResult && !classifyBulkEnrollmentResult(bulkResult).hasValidEnrollments) {
    lines.push("Enrollment failed for every selected lead — fix enrollment issues before running the scheduler.")
    return lines
  }

  const enrollmentStatus = enrollmentDetail?.enrollment.status
  if (enrollmentStatus === "draft") {
    lines.push("Enrollment is still a draft and is not active yet — activate it before steps can be scheduled.")
  } else if (enrollmentStatus === "paused") {
    lines.push("Enrollment is paused — resume it before the scheduler can plan jobs.")
  }

  if (schedulerResult.transportConfigured === false || (schedulerResult.skippedTransportNotConfigured ?? 0) > 0) {
    lines.push("Outbound transport is not configured — connect a sender before execution jobs can be planned.")
  }

  if ((schedulerResult.skippedNoSender ?? 0) > 0) {
    lines.push("No sender route is available for one or more due steps.")
  }

  if ((schedulerResult.skippedSuppressed ?? 0) > 0) {
    lines.push("One or more due steps were blocked by suppression or preflight rules.")
  }

  if ((schedulerResult.skippedAlreadyQueued ?? 0) > 0) {
    lines.push("Due steps already have queued jobs or outreach items — open the Execution Console to review them.")
  }

  if ((schedulerResult.skippedMissingDraft ?? 0) > 0) {
    lines.push("One or more due steps are missing draft content required for scheduling.")
  }

  if (schedulerResult.scanned === 0 || schedulerResult.due === 0) {
    lines.push("The scheduler found 0 due steps right now — the next step may not be scheduled yet or is outside business hours.")
  }

  if ((schedulerResult.failed ?? 0) > 0) {
    lines.push("The scheduler hit errors while processing due steps.")
  }

  if (lines.length === 0) {
    lines.push("The scheduler completed but did not plan any execution jobs.")
  }

  return lines
}
