/** Shared enrollment step progression helpers (server + client safe). */

import { isCadenceEmailChannel, isSequenceTransportChannel } from "@/lib/growth/cadence/cadence-channel-engine"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import type { GrowthSequenceStepChannel } from "@/lib/growth/sequence-types"

const TERMINAL_STEP_STATUSES = new Set<GrowthSequenceEnrollmentStep["status"]>([
  "executed",
  "skipped",
  "cancelled",
])

export function pickInProgressEnrollmentStep(
  steps: GrowthSequenceEnrollmentStep[],
  currentStepOrder: number,
): GrowthSequenceEnrollmentStep | null {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder)
  const inProgress = sorted.find(
    (step) => !TERMINAL_STEP_STATUSES.has(step.status) && step.stepOrder >= currentStepOrder,
  )
  return inProgress ?? sorted.find((step) => step.stepOrder === currentStepOrder) ?? null
}

export function enrollmentHasPriorIncompleteSteps(
  steps: GrowthSequenceEnrollmentStep[],
  step: GrowthSequenceEnrollmentStep,
): boolean {
  return steps.some(
    (candidate) =>
      candidate.stepOrder < step.stepOrder && !TERMINAL_STEP_STATUSES.has(candidate.status),
  )
}

export function isManualSequenceStepChannel(channel: GrowthSequenceStepChannel): boolean {
  return !isSequenceTransportChannel(channel)
}

export function isManualStepAwaitingCompletion(step: GrowthSequenceEnrollmentStep): boolean {
  return isManualSequenceStepChannel(step.channel) && ["queued", "draft_created"].includes(step.status)
}

export function isDraftReadyTransportSchedulerStep(step: GrowthSequenceEnrollmentStep): boolean {
  if (step.channel === "sms") {
    return step.status === "draft_created" && Boolean(step.instructions?.trim())
  }
  return (
    step.status === "draft_created" &&
    isCadenceEmailChannel(step.channel) &&
    Boolean(step.generationId)
  )
}

/** Email step with AI draft materialized — ready for execution job planning. */
export function isDraftReadyEmailSchedulerStep(step: GrowthSequenceEnrollmentStep): boolean {
  return isDraftReadyTransportSchedulerStep(step) && step.channel === "email"
}

export function isSequenceStepDueForScheduler(
  step: GrowthSequenceEnrollmentStep,
  nowMs: number = Date.now(),
): boolean {
  if (step.outreachQueueId) return false
  if (!["pending", "draft_created"].includes(step.status)) return false
  if (isDraftReadyTransportSchedulerStep(step)) return true
  if (!step.scheduledFor) return false
  return Date.parse(step.scheduledFor) <= nowMs
}
