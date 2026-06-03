/** Shared enrollment step progression helpers (server + client safe). */

import { isCadenceEmailChannel } from "@/lib/growth/cadence/cadence-channel-engine"
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
  return !isCadenceEmailChannel(channel)
}

export function isManualStepAwaitingCompletion(step: GrowthSequenceEnrollmentStep): boolean {
  return isManualSequenceStepChannel(step.channel) && ["queued", "draft_created"].includes(step.status)
}
