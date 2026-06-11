/** Approval simulation — NO auto-approve (Phase 13E). */

import type {
  ApolloOperatorApprovalSimulation,
  ApolloOperatorQueueItem,
} from "@/lib/growth/apollo/apollo-operator-scale-types"

const SIMULATION_THRESHOLDS = [90, 95, 98] as const
const AVG_REVIEW_MINUTES = 4

export function simulateApolloOperatorAutoApproval(input: {
  items: ApolloOperatorQueueItem[]
  threshold: number
  avg_review_minutes?: number
}): ApolloOperatorApprovalSimulation {
  const threshold = input.threshold
  const avgMinutes = input.avg_review_minutes ?? AVG_REVIEW_MINUTES

  const pendingHigh = input.items.filter(
    (item) =>
      item.outcome === "pending" &&
      item.confidence_score != null &&
      item.confidence_score >= threshold,
  )

  const resolved = input.items.filter(
    (item) => item.outcome !== "pending" && item.confidence_score != null,
  )
  const highResolved = resolved.filter((item) => (item.confidence_score ?? 0) >= threshold)
  const highRejected = highResolved.filter(
    (item) => item.outcome === "rejected" || item.outcome === "regenerated",
  )

  const estimated_error_rate_pct =
    highResolved.length > 0
      ? Math.round((highRejected.length / highResolved.length) * 1000) / 10
      : 0

  const approvalsAvoided = pendingHigh.length
  const operator_hours_saved = Math.round(((approvalsAvoided * avgMinutes) / 60) * 10) / 10

  return {
    threshold,
    approvals_avoided: approvalsAvoided,
    pending_high_confidence: pendingHigh.length,
    operator_hours_saved,
    estimated_error_rate_pct,
    simulation_only: true,
  }
}

export function buildApolloOperatorApprovalSimulationReport(
  items: ApolloOperatorQueueItem[],
): ApolloOperatorApprovalSimulation[] {
  return SIMULATION_THRESHOLDS.map((threshold) =>
    simulateApolloOperatorAutoApproval({ items, threshold }),
  )
}
