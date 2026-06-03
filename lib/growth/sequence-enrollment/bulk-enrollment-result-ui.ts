/** Client-safe bulk enrollment result + scheduler CTA helpers. */

import type {
  BulkSequenceEnrollmentLeadOutcome,
  BulkSequenceEnrollmentResult,
} from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment-types"
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

export function resolveBulkEnrollmentViewId(entry: BulkSequenceEnrollmentLeadOutcome): string | null {
  return entry.enrollmentId ?? entry.conflictingEnrollmentId ?? null
}

export function listBulkEnrollmentContinuableOutcomes(
  result: BulkSequenceEnrollmentResult,
): BulkSequenceEnrollmentLeadOutcome[] {
  return [...result.enrolled, ...result.skippedAlreadyEnrolled, ...result.skippedBlocked].filter(
    (entry) => resolveBulkEnrollmentViewId(entry) !== null,
  )
}

export function bulkEnrollmentHasContinuableEnrollment(result: BulkSequenceEnrollmentResult): boolean {
  return listBulkEnrollmentContinuableOutcomes(result).length > 0
}

export function bulkEnrollmentHasSchedulerEligible(result: BulkSequenceEnrollmentResult): boolean {
  return [...result.enrolled, ...result.skippedAlreadyEnrolled].some((entry) => entry.schedulerEligible === true)
}

export function pickBulkEnrollmentPrimaryEnrollmentId(result: BulkSequenceEnrollmentResult): string | null {
  for (const entry of [...result.enrolled, ...result.skippedAlreadyEnrolled, ...result.skippedBlocked]) {
    const viewId = resolveBulkEnrollmentViewId(entry)
    if (viewId) return viewId
  }
  return null
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
  const hasContinuableEnrollment = bulkEnrollmentHasContinuableEnrollment(result)
  const hasValidEnrollments = enrolledCount + alreadyEnrolledCount > 0 || hasContinuableEnrollment
  const primaryEnrollmentId = pickBulkEnrollmentPrimaryEnrollmentId(result)
  const showSchedulerCta = bulkEnrollmentHasSchedulerEligible(result)

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

  if (failedCount > 0 || (blockedCount > 0 && !hasContinuableEnrollment)) {
    return {
      qaMarker: GROWTH_BULK_ENROLLMENT_RESULT_UI_QA_MARKER,
      variant: "warning",
      title: "Enrollment processed with issues",
      description:
        "Some leads enrolled or were already enrolled, but others were blocked or failed. Review the details below.",
      hasValidEnrollments,
      showSchedulerCta,
      showViewEnrollment: Boolean(primaryEnrollmentId),
    }
  }

  if (alreadyEnrolledCount > 0 && enrolledCount === 0 && failedCount === 0 && blockedCount === 0) {
    return {
      qaMarker: GROWTH_BULK_ENROLLMENT_RESULT_UI_QA_MARKER,
      variant: "success",
      title: "Already enrolled",
      description: "These leads are already enrolled in this sequence. Continue from the existing enrollment.",
      hasValidEnrollments,
      showSchedulerCta,
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
    showSchedulerCta,
    showViewEnrollment: Boolean(primaryEnrollmentId),
  }
}

export function formatBulkEnrollmentOutcomeLeadLabel(
  entry: { leadId: string; leadLabel?: string },
): string {
  return entry.leadLabel?.trim() || entry.leadId.slice(0, 8)
}

export function summarizeEnrollmentStepContext(
  enrollment: { status: string; currentStepOrder: number; pauseReason?: string | null } | null,
  steps: Array<{ stepOrder: number; status: string }>,
): string | undefined {
  if (!enrollment) return undefined
  if (enrollment.status === "draft") return "Draft enrollment — confirm or cancel before scheduling."
  if (enrollment.status === "paused") {
    return enrollment.pauseReason
      ? `Paused · ${enrollment.pauseReason}`
      : `Paused at step ${enrollment.currentStepOrder}`
  }

  const nextStep =
    steps.find((step) => step.stepOrder === enrollment.currentStepOrder + 1) ??
    steps.find((step) => step.status === "pending" || step.status === "draft_created")

  if (!nextStep) {
    return enrollment.status === "active"
      ? `Active · step ${enrollment.currentStepOrder} complete`
      : `Status ${enrollment.status.replace(/_/g, " ")}`
  }

  return `Step ${nextStep.stepOrder} · ${nextStep.status.replace(/_/g, " ")}`
}

export function suggestBulkEnrollmentAction(
  status: string | undefined,
): "view_enrollment" | "resume_enrollment" | "cancel_draft" {
  if (status === "paused") return "resume_enrollment"
  if (status === "draft") return "cancel_draft"
  return "view_enrollment"
}

export function isBulkEnrollmentSchedulerEligible(status: string | undefined): boolean {
  return status === "active"
}

export function formatBulkEnrollmentOutcomeDetail(entry: {
  code?: string
  reason?: string
  enrollmentStatus?: string
  currentStepSummary?: string
}): string {
  if (entry.currentStepSummary?.trim()) return entry.currentStepSummary.trim()
  if (entry.reason?.trim()) return entry.reason.trim()
  if (entry.enrollmentStatus) return `Status ${entry.enrollmentStatus.replace(/_/g, " ")}`
  return entry.code?.replace(/_/g, " ") || "Unknown issue"
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
  highlightJobId?: string | null
}): string | null {
  if (!schedulerPlannedExecutionJobs(input.schedulerResult)) return null
  const enrollmentId = input.enrollmentId ?? input.enrollmentDetail?.enrollment.id ?? null
  if (!enrollmentId) return null

  const hrefInput = {
    enrollmentId,
    leadId: input.leadId ?? input.enrollmentDetail?.leadId ?? undefined,
    sequencePatternId: input.sequencePatternId ?? input.enrollmentDetail?.enrollment.sequencePatternId ?? undefined,
    highlightJobId: input.highlightJobId ?? pickPendingExecutionHighlightJobId(input.enrollmentDetail),
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
    lines.push("Outbound transport is blocked — check Provider Setup transport readiness for the exact blocker.")
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
