/** Client-safe QA acceleration types for pattern enrollments. */

export const GROWTH_QA_ACCELERATION_QA_MARKER = "growth-qa-acceleration-v1" as const

export const GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES = [
  "qa_schedule_step_now",
  "qa_force_due_now",
  "qa_scheduler_run",
] as const

export type GrowthQaAccelerationTimelineEventType =
  (typeof GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES)[number]

export type GrowthQaAccelerationSchedulerBlockReason =
  | "transport_not_configured"
  | "step_not_eligible"
  | "already_queued"
  | "blocked_by_suppression"
  | "inactive_enrollment"
  | "outside_business_hours"

export type GrowthQaAccelerationStepActionResult = {
  qaMarker: typeof GROWTH_QA_ACCELERATION_QA_MARKER
  enrollmentId: string
  stepId: string
  stepOrder: number
  scheduledFor: string
  bypassBusinessHours: boolean
}

export type GrowthQaAccelerationSchedulerRunResult = {
  qaMarker: typeof GROWTH_QA_ACCELERATION_QA_MARKER
  enrollmentId: string
  schedulerResult: import("@/lib/growth/sequence-enrollment/sequence-scheduler-types").GrowthSequenceSchedulerRunResult
  jobCreated: boolean
  createdJobId: string | null
  blockReason: GrowthQaAccelerationSchedulerBlockReason | null
  blockReasonLabel: string | null
  executionHref: string | null
}

export type PatternEnrollmentHistoryEventView = {
  id: string
  eventType: string
  title: string
  summary: string | null
  actorEmail: string | null
  occurredAt: string
}

export function formatQaAccelerationBlockReason(
  reason: GrowthQaAccelerationSchedulerBlockReason,
): string {
  switch (reason) {
    case "transport_not_configured":
      return "Outbound transport is not configured."
    case "step_not_eligible":
      return "The current step is not eligible for scheduling."
    case "already_queued":
      return "This step already has a queued execution job."
    case "blocked_by_suppression":
      return "The step is blocked by suppression or preflight rules."
    case "inactive_enrollment":
      return "Enrollment is not active."
    case "outside_business_hours":
      return "The step is not due yet — use Make Step Due Now to bypass business hours."
    default:
      return "Scheduler could not create an execution job."
  }
}
