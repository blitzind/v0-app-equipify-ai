/** Client-safe QA acceleration types for pattern enrollments. */

import type { GrowthOutboundTransportBlockReason } from "@/lib/growth/runtime/outbound-transport-readiness-types"
import { formatGrowthOutboundTransportBlockMessage } from "@/lib/growth/runtime/outbound-transport-readiness-types"
import {
  formatGrowthSchedulerStepFailureMessage,
  GROWTH_SCHEDULER_AI_GENERATION_FAILURE_CODES,
  type GrowthSchedulerAiGenerationFailureCode,
} from "@/lib/growth/sequence-enrollment/scheduler-step-failure-types"

export const GROWTH_QA_ACCELERATION_QA_MARKER = "growth-qa-acceleration-v1" as const

export const GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES = [
  "qa_schedule_step_now",
  "qa_force_due_now",
  "qa_scheduler_run",
] as const

export type GrowthQaAccelerationTimelineEventType =
  (typeof GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES)[number]

export type GrowthQaAccelerationSchedulerBlockReason =
  | GrowthOutboundTransportBlockReason
  | GrowthSchedulerAiGenerationFailureCode
  | "step_not_eligible"
  | "already_queued"
  | "blocked_by_suppression"
  | "inactive_enrollment"
  | "outside_business_hours"
  | "reputation_blocked"
  | "capacity_blocked"
  | "preflight_blocked"
  | "rule_blocked"
  | "copilot_disabled"
  | "missing_lead_context"
  | "lead_not_found"
  | string

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
  blockReasonDetail: string | null
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
  options?: { detailMessage?: string | null },
): string {
  if (
    reason === "no_enabled_delivery_route" ||
    reason === "sender_pending" ||
    reason === "sender_disabled" ||
    reason === "mailbox_not_linked" ||
    reason === "provider_disconnected"
  ) {
    return formatGrowthOutboundTransportBlockMessage(reason)
  }

  if ((GROWTH_SCHEDULER_AI_GENERATION_FAILURE_CODES as readonly string[]).includes(reason)) {
    return formatGrowthSchedulerStepFailureMessage({
      code: reason,
      message: options?.detailMessage ?? null,
    })
  }

  switch (reason) {
    case "reputation_blocked":
      return formatGrowthSchedulerStepFailureMessage({
        code: "reputation_blocked",
        message: options?.detailMessage ?? null,
      })
    case "capacity_blocked":
      return formatGrowthSchedulerStepFailureMessage({
        code: "capacity_blocked",
        message: options?.detailMessage ?? null,
      })
    case "preflight_blocked":
      return formatGrowthSchedulerStepFailureMessage({
        code: "preflight_blocked",
        message: options?.detailMessage ?? null,
      })
    case "rule_blocked":
      return formatGrowthSchedulerStepFailureMessage({
        code: "rule_blocked",
        message: options?.detailMessage ?? null,
      })
    case "copilot_disabled":
      return formatGrowthSchedulerStepFailureMessage({
        code: "copilot_disabled",
        message: options?.detailMessage ?? null,
      })
    case "missing_lead_context":
    case "lead_not_found":
      return formatGrowthSchedulerStepFailureMessage({
        code: "missing_lead_context",
        message: options?.detailMessage ?? null,
      })
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
      if (options?.detailMessage?.trim()) return options.detailMessage.trim()
      return "Scheduler could not create an execution job."
  }
}
