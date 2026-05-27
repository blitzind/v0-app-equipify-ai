/** Deterministic sequence enrollment health scoring. Client-safe. */

import type { GrowthSequenceEnrollmentStatus, GrowthSequenceHealthTier } from "@/lib/growth/sequences/sequence-types"

export type SequenceHealthInput = {
  status: GrowthSequenceEnrollmentStatus
  overdue_step?: boolean
  has_failed_event?: boolean
  has_critical_event?: boolean
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeSequenceHealthScore(input: SequenceHealthInput): number {
  let score = 100

  if (input.overdue_step) score -= 20
  if (input.has_failed_event) score -= 25
  if (input.status === "paused") score -= 10
  if (input.has_critical_event) score -= 20

  return clampScore(score)
}

export function sequenceHealthScoreToTier(score: number): GrowthSequenceHealthTier {
  if (score >= 90) return "healthy"
  if (score >= 70) return "warning"
  if (score >= 40) return "degraded"
  return "critical"
}

export function evaluateSequenceHealth(input: SequenceHealthInput): {
  health_score: number
  health_tier: GrowthSequenceHealthTier
} {
  const health_score = computeSequenceHealthScore(input)
  return {
    health_score,
    health_tier: sequenceHealthScoreToTier(health_score),
  }
}

export function isSequenceStepOverdue(nextStepDueAt: string | null, status: GrowthSequenceEnrollmentStatus, now = new Date()): boolean {
  if (status !== "active") return false
  if (!nextStepDueAt) return false
  const due = new Date(nextStepDueAt)
  if (Number.isNaN(due.getTime())) return false
  return due.getTime() < now.getTime()
}

export function sequenceHealthTierLabel(tier: GrowthSequenceHealthTier): string {
  switch (tier) {
    case "healthy":
      return "Healthy"
    case "warning":
      return "Warning"
    case "degraded":
      return "Degraded"
    case "critical":
      return "Critical"
  }
}
