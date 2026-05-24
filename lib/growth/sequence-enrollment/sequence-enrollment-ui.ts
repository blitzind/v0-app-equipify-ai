/** Client-safe sequence enrollment UI helpers. */

import type {
  GrowthSequenceEnrollmentStatus,
  GrowthSequenceEnrollmentStep,
  GrowthSequenceEnrollmentStepStatus,
  GrowthSequenceEnrollmentWithSteps,
} from "@/lib/growth/sequence-enrollment-types"
import {
  GROWTH_SEQUENCE_CATALOG_KEYS,
  type GrowthSequenceFatigueRisk,
  type GrowthSequencePattern,
  type GrowthSequenceStepChannel,
} from "@/lib/growth/sequence-types"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_SEQUENCE_TEST_PATTERN_KEYS = GROWTH_SEQUENCE_CATALOG_KEYS

export type SequenceStartAvailability = {
  canStart: boolean
  code: string | null
  message: string | null
}

const ENROLLMENT_STATUS_LABELS: Record<GrowthSequenceEnrollmentStatus, string> = {
  draft: "Draft Enrollment",
  active: "Active Sequence",
  paused: "Paused Sequence",
  completed: "Completed Sequence",
  cancelled: "Cancelled Sequence",
}

const STEP_STATUS_LABELS: Record<GrowthSequenceEnrollmentStepStatus, string> = {
  pending: "Pending Approval",
  draft_created: "Pending Approval",
  queued: "Pending Queue",
  approved: "Queued",
  executed: "Executed",
  skipped: "Skipped",
  failed: "Failed",
  cancelled: "Cancelled",
}

const FATIGUE_LABELS: Record<GrowthSequenceFatigueRisk, string> = {
  none: "No fatigue",
  low: "Low fatigue",
  medium: "Medium fatigue",
  high: "High fatigue",
}

export function formatSequenceChannelLabel(channel: GrowthSequenceStepChannel): string {
  switch (channel) {
    case "email":
      return "Email"
    case "manual_call":
      return "Manual Call"
    case "manual_follow_up":
      return "Follow Up"
    default:
      return "Step"
  }
}

export function formatSequenceChannelShortLabel(channel: GrowthSequenceStepChannel): string {
  switch (channel) {
    case "email":
      return "Email"
    case "manual_call":
      return "Call"
    case "manual_follow_up":
      return "Follow Up"
    default:
      return "Step"
  }
}

export function formatSequencePatternTitle(
  steps: Array<{ stepOrder: number; channel: GrowthSequenceStepChannel }>,
): string {
  return [...steps]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step) => formatSequenceChannelShortLabel(step.channel))
    .join(" → ")
}

export function formatSequencePatternTitleFromPattern(pattern: GrowthSequencePattern | null | undefined): string {
  if (!pattern) return "Sequence"
  if (pattern.steps.length > 0) return formatSequencePatternTitle(pattern.steps)
  return pattern.label.replace(/\bthen\b/gi, "→").replace(/\s+/g, " ").trim()
}

export function formatEnrollmentStatusLabel(status: GrowthSequenceEnrollmentStatus): string {
  return ENROLLMENT_STATUS_LABELS[status]
}

export function enrollmentStatusTone(
  status: GrowthSequenceEnrollmentStatus,
): "healthy" | "attention" | "warning" | "neutral" {
  if (status === "active") return "healthy"
  if (status === "draft") return "attention"
  if (status === "paused" || status === "cancelled") return "warning"
  if (status === "completed") return "healthy"
  return "neutral"
}

export function formatStepStatusLabel(status: GrowthSequenceEnrollmentStepStatus): string {
  return STEP_STATUS_LABELS[status]
}

export function stepStatusTone(status: GrowthSequenceEnrollmentStepStatus): "healthy" | "attention" | "warning" | "neutral" {
  if (status === "executed" || status === "skipped") return "healthy"
  if (status === "failed") return "warning"
  if (status === "queued" || status === "draft_created" || status === "approved" || status === "pending") return "attention"
  return "neutral"
}

export function formatStepStatusDetail(step: GrowthSequenceEnrollmentStep): string {
  const label = formatStepStatusLabel(step.status)
  if (step.status === "skipped" || step.status === "failed" || step.status === "cancelled") {
    return label
  }
  return `${label} · Confidence ${step.stepExecutionConfidence}%`
}

export function formatSequenceFatigueLabel(risk: GrowthSequenceFatigueRisk | string | null | undefined): string {
  if (!risk) return "Unknown fatigue"
  if (risk in FATIGUE_LABELS) return FATIGUE_LABELS[risk as GrowthSequenceFatigueRisk]
  return "Unknown fatigue"
}

export function formatSequenceFatigueTone(
  risk: GrowthSequenceFatigueRisk | string | null | undefined,
): "healthy" | "attention" | "warning" | "neutral" {
  if (risk === "high") return "warning"
  if (risk === "medium") return "attention"
  return "neutral"
}

export function getEnrollmentCurrentStep(
  enrollment: GrowthSequenceEnrollmentWithSteps,
): GrowthSequenceEnrollmentStep | null {
  if (enrollment.status === "completed" || enrollment.status === "cancelled") return null
  return enrollment.steps.find((step) => step.stepOrder === enrollment.currentStepOrder + 1) ?? null
}

export function formatEnrollmentCurrentStepLabel(enrollment: GrowthSequenceEnrollmentWithSteps): string {
  if (enrollment.status === "completed") return "Complete"
  if (enrollment.status === "cancelled") return "Cancelled"
  if (enrollment.status === "draft" || enrollment.currentStepOrder <= 0) return "Planning"

  const current = getEnrollmentCurrentStep(enrollment)
  if (!current) {
    const allDone = enrollment.steps.every((step) => step.status === "executed" || step.status === "skipped")
    return allDone ? "Complete" : "Planning"
  }

  return formatSequenceChannelLabel(current.channel)
}

export function formatEnrollmentNextAction(
  enrollment: GrowthSequenceEnrollmentWithSteps,
  currentStep: GrowthSequenceEnrollmentStep | null,
): string | null {
  if (enrollment.status === "draft") return "Confirm Enrollment"
  if (enrollment.status === "paused") return "Resume Sequence"
  if (enrollment.status === "completed") return null
  if (enrollment.status === "cancelled") return null

  if (currentStep?.status === "failed") return "Review Failed Step"
  if (currentStep?.status === "draft_created" && currentStep.channel === "email") return "Queue Email Step"
  if (currentStep?.status === "draft_created") return "Approve Draft"
  if (currentStep?.status === "queued" || currentStep?.status === "approved") return "Approve Outreach"
  if (currentStep?.status === "pending") return "Prepare Step"
  if (currentStep && currentStep.channel !== "email") return "Mark Complete or Skip"

  return null
}

export function growthSequenceEnrollmentActionRequired(
  enrollment: GrowthSequenceEnrollmentWithSteps | null | undefined,
): boolean {
  if (!enrollment) return false
  if (enrollment.status === "draft") return true
  if (enrollment.steps.some((step) => step.status === "failed")) return true

  const current = getEnrollmentCurrentStep(enrollment)
  if (!current) return false

  return ["pending", "draft_created", "queued", "approved"].includes(current.status)
}

export function formatEnrollmentCollapsedSummary(enrollment: GrowthSequenceEnrollmentWithSteps): string {
  const title = enrollment.steps.length
    ? formatSequencePatternTitle(enrollment.steps)
    : (enrollment.patternLabel ?? "Sequence")
  return `${title} · Health ${enrollment.enrollmentHealthScore}`
}

export function describeSequenceStartUnavailable(
  lead: GrowthLead,
  input: {
    hasEnrollment: boolean
    preflightCode?: string | null
    preflightReason?: string | null
  },
): SequenceStartAvailability {
  if (input.hasEnrollment) {
    return {
      canStart: false,
      code: "active_enrollment",
      message: "Existing sequence active",
    }
  }

  if (!lead.recommendedSequencePatternId) {
    return {
      canStart: false,
      code: "no_recommendation",
      message: "No recommended sequence yet",
    }
  }

  if (lead.sequenceFatigueRisk === "high") {
    return {
      canStart: false,
      code: "fatigue_blocked",
      message: "High fatigue risk",
    }
  }

  if (input.preflightCode) {
    return {
      canStart: false,
      code: input.preflightCode,
      message: mapPreflightCodeToMessage(input.preflightCode, input.preflightReason),
    }
  }

  if ((lead.recommendedSequenceConfidence ?? 0) < 40) {
    return {
      canStart: false,
      code: "low_confidence",
      message: "Need more outreach activity",
    }
  }

  return { canStart: true, code: null, message: null }
}

export function mapPreflightCodeToMessage(code: string, reason?: string | null): string {
  switch (code) {
    case "no_recommendation":
      return "No recommended sequence yet"
    case "low_confidence":
      return "Need more outreach activity"
    case "fatigue_blocked":
      return "High fatigue risk"
    case "active_enrollment":
      return "Existing sequence active"
    case "lead_blocked":
      return reason ?? "Lead is not eligible for sequence enrollment."
    case "suppressed":
      return reason ?? "Contact is suppressed."
    default:
      return reason ?? "Sequence enrollment unavailable."
  }
}

export function formatRecommendedNextStepLabel(channel: GrowthSequenceStepChannel): string {
  return formatSequenceChannelLabel(channel)
}

export function formatHumanPhrase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
