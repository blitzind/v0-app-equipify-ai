/** Operational readiness scoring (Phase 13F). */

import type { ApolloOperatorBottleneckReport } from "@/lib/growth/apollo/apollo-operator-scale-types"
import type {
  ApolloOperationalReadinessLevel,
  ApolloOperationalReadinessScore,
  ApolloOperatorApprovalQuality,
  ApolloOperatorQueueThroughput,
} from "@/lib/growth/apollo/apollo-operator-scale-types"

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function levelFromScore(score: number): ApolloOperationalReadinessLevel {
  if (score >= 80) return "scale_ready"
  if (score >= 60) return "production_ready"
  if (score >= 40) return "pilot_ready"
  return "experimental"
}

export function buildApolloOperationalReadinessScore(input: {
  throughput: ApolloOperatorQueueThroughput[]
  approval_quality: ApolloOperatorApprovalQuality[]
  bottlenecks: ApolloOperatorBottleneckReport
  meeting_conversion_pct?: number | null
}): ApolloOperationalReadinessScore {
  const pendingTotal = input.throughput.reduce((sum, row) => sum + row.pending_count, 0)
  const maxAge = Math.max(
    0,
    ...input.throughput.map((row) => row.max_queue_age_hours ?? 0),
    ...input.bottlenecks.hotspots.map((h) => h.max_age_hours),
  )

  const avgApprove =
    input.approval_quality.length > 0
      ? input.approval_quality.reduce((sum, row) => sum + row.approve_pct, 0) /
        input.approval_quality.length
      : 0
  const avgRegenerate =
    input.approval_quality.length > 0
      ? input.approval_quality.reduce((sum, row) => sum + row.regenerate_pct, 0) /
        input.approval_quality.length
      : 0

  const throughputPerDay = input.throughput.reduce(
    (sum, row) => sum + row.items_created_per_day,
    0,
  )

  const queue_aging_score = clampScore(100 - Math.min(maxAge, 72) * 1.2)
  const approval_stability_score = clampScore(avgApprove)
  const regeneration_score = clampScore(100 - avgRegenerate * 2)
  const bottleneck_score = clampScore(100 - pendingTotal * 2 - input.bottlenecks.stalled_candidates.length * 5)
  const throughput_score = clampScore(Math.min(throughputPerDay * 8, 100))
  const meeting_score = clampScore(input.meeting_conversion_pct ?? 50)

  const score = clampScore(
    queue_aging_score * 0.25 +
      approval_stability_score * 0.2 +
      regeneration_score * 0.2 +
      bottleneck_score * 0.2 +
      throughput_score * 0.1 +
      meeting_score * 0.05,
  )

  return {
    score,
    level: levelFromScore(score),
    factors: {
      queue_aging: queue_aging_score,
      approval_stability: approval_stability_score,
      regeneration_control: regeneration_score,
      bottleneck_health: bottleneck_score,
      throughput: throughput_score,
      meeting_conversion: meeting_score,
    },
  }
}
