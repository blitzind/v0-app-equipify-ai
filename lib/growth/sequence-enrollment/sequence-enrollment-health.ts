import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStep,
  GrowthSequenceDriftSignal,
} from "@/lib/growth/sequence-enrollment-types"
import type { GrowthSequencePatternStep } from "@/lib/growth/sequence-types"
import type { GrowthLead } from "@/lib/growth/types"

const STALL_DAYS = 7

export function computeStepExecutionConfidence(input: {
  lead: GrowthLead
  channel: GrowthSequenceEnrollmentStep["channel"]
}): number {
  let score = 50
  score += Math.min(20, (input.lead.recommendedSequenceConfidence ?? 0) * 0.2)
  score += Math.min(15, (input.lead.engagementScore ?? 0) * 0.15)
  if (input.lead.operationalCapacityTier === "healthy") score += 10
  if (input.lead.operationalCapacityTier === "critical") score -= 25
  if (input.lead.sequenceFatigueRisk === "high") score -= 20
  else if (input.lead.sequenceFatigueRisk === "medium") score -= 10
  if (input.channel === "email" && !input.lead.contactEmail) score -= 30
  if (input.channel !== "email" && !input.lead.contactPhone) score -= 15
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function computeEnrollmentHealthScore(input: {
  enrollment: GrowthSequenceEnrollment
  steps: GrowthSequenceEnrollmentStep[]
  totalSteps: number
}): { healthScore: number; stalled: boolean } {
  const executed = input.steps.filter((step) => step.status === "executed" || step.status === "skipped").length
  const failed = input.steps.filter((step) => step.status === "failed").length
  const progressRatio = input.totalSteps > 0 ? executed / input.totalSteps : 0

  let health = Math.round(40 + progressRatio * 45)
  health -= failed * 12
  if (input.enrollment.status === "paused") health -= 8

  const now = Date.now()
  const current = input.steps.find((step) => step.stepOrder === input.enrollment.currentStepOrder + 1)
  let stalled = false
  if (current && input.enrollment.status === "active") {
    const waitingStatuses = new Set(["pending", "draft_created", "queued", "approved"])
    if (waitingStatuses.has(current.status) && current.scheduledFor) {
      const overdueMs = now - Date.parse(current.scheduledFor)
      if (overdueMs > STALL_DAYS * 24 * 60 * 60 * 1000) {
        stalled = true
        health -= 25
      }
    }
  }

  return {
    healthScore: Math.max(0, Math.min(100, health)),
    stalled,
  }
}

export function detectSequenceDrift(input: {
  enrollmentId: string
  leadId: string
  companyName: string
  patternKey: string | null
  steps: GrowthSequenceEnrollmentStep[]
  patternSteps: GrowthSequencePatternStep[]
}): GrowthSequenceDriftSignal[] {
  const signals: GrowthSequenceDriftSignal[] = []
  const now = Date.now()

  for (const step of input.steps) {
    const expected = input.patternSteps.find((entry) => entry.stepOrder === step.stepOrder)
    if (expected && expected.channel !== step.channel) {
      signals.push({
        enrollmentId: input.enrollmentId,
        leadId: input.leadId,
        companyName: input.companyName,
        patternKey: input.patternKey,
        driftKind: "channel_mismatch",
        summary: `Step ${step.stepOrder} channel drift (${step.channel} vs ${expected.channel})`,
      })
    }

    if (
      step.scheduledFor &&
      ["pending", "queued", "draft_created"].includes(step.status) &&
      now - Date.parse(step.scheduledFor) > 3 * 24 * 60 * 60 * 1000
    ) {
      signals.push({
        enrollmentId: input.enrollmentId,
        leadId: input.leadId,
        companyName: input.companyName,
        patternKey: input.patternKey,
        driftKind: "late_step",
        summary: `Step ${step.stepOrder} overdue since ${step.scheduledFor}`,
      })
    }

    if (step.status === "failed") {
      signals.push({
        enrollmentId: input.enrollmentId,
        leadId: input.leadId,
        companyName: input.companyName,
        patternKey: input.patternKey,
        driftKind: "queue_failed",
        summary: step.failureReason ?? `Step ${step.stepOrder} failed`,
      })
    }
  }

  const skipped = input.steps.filter((step) => step.status === "skipped").length
  if (skipped > 0) {
    signals.push({
      enrollmentId: input.enrollmentId,
      leadId: input.leadId,
      companyName: input.companyName,
      patternKey: input.patternKey,
      driftKind: "skipped_gap",
      summary: `${skipped} skipped step(s) in enrollment`,
    })
  }

  return signals
}
