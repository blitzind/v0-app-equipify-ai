/** Sequence enrollment planning helpers. Client-safe. */

import type { GrowthSequenceTemplateStep } from "@/lib/growth/sequences/sequence-types"
export { formatLeadLabel } from "@/lib/growth/lead-label"

export function computeNextStepDueAt(from: Date, delayDays: number): string {
  const due = new Date(from.getTime())
  due.setUTCDate(due.getUTCDate() + Math.max(0, delayDays))
  return due.toISOString()
}

export function getTemplateStepByNumber(
  steps: GrowthSequenceTemplateStep[],
  stepNumber: number,
): GrowthSequenceTemplateStep | null {
  return steps.find((step) => step.step_number === stepNumber) ?? null
}

export function computeEnrollmentNextDueAt(
  steps: GrowthSequenceTemplateStep[],
  currentStep: number,
  startedAt: string | null,
): string | null {
  const step = getTemplateStepByNumber(steps, currentStep)
  if (!step) return null
  const base = startedAt ? new Date(startedAt) : new Date()
  if (Number.isNaN(base.getTime())) return computeNextStepDueAt(new Date(), step.delay_days)
  return computeNextStepDueAt(base, step.delay_days)
}

export function isEnrollmentComplete(currentStep: number, totalSteps: number): boolean {
  return totalSteps > 0 && currentStep > totalSteps
}
