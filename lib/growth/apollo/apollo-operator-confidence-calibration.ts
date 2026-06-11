/** Confidence vs operator decision calibration (Phase 13B). */

import {
  APOLLO_OPERATOR_HIGH_CONFIDENCE_THRESHOLD,
  APOLLO_OPERATOR_QUEUE_STAGE_LABELS,
} from "@/lib/growth/apollo/apollo-operator-queue-mapper"
import type {
  ApolloOperatorConfidenceCalibration,
  ApolloOperatorQueueItem,
  ApolloOperatorQueueStage,
} from "@/lib/growth/apollo/apollo-operator-scale-types"

export function buildApolloOperatorConfidenceCalibration(
  items: ApolloOperatorQueueItem[],
  stage: ApolloOperatorQueueStage,
  highThreshold = APOLLO_OPERATOR_HIGH_CONFIDENCE_THRESHOLD,
): ApolloOperatorConfidenceCalibration {
  const resolved = items.filter(
    (item) => item.stage === stage && item.outcome !== "pending" && item.confidence_score != null,
  )

  let highApproved = 0
  let highRejected = 0
  let lowApproved = 0
  let lowRejected = 0

  for (const item of resolved) {
    const score = item.confidence_score ?? 0
    const isHigh = score >= highThreshold
    if (item.outcome === "approved") {
      if (isHigh) highApproved += 1
      else lowApproved += 1
    } else if (item.outcome === "rejected" || item.outcome === "regenerated") {
      if (isHigh) highRejected += 1
      else lowRejected += 1
    }
  }

  const aligned = highApproved + lowRejected
  const total = resolved.length
  const automation_accuracy_score = total > 0 ? Math.round((aligned / total) * 100) : 0

  return {
    stage,
    label: APOLLO_OPERATOR_QUEUE_STAGE_LABELS[stage],
    automation_accuracy_score,
    high_confidence_approved: highApproved,
    high_confidence_rejected: highRejected,
    low_confidence_approved: lowApproved,
    low_confidence_rejected: lowRejected,
    high_confidence_threshold: highThreshold,
  }
}

export function buildApolloOperatorConfidenceCalibrationReport(
  items: ApolloOperatorQueueItem[],
): ApolloOperatorConfidenceCalibration[] {
  const stages: ApolloOperatorQueueStage[] = [
    "enrollment",
    "account_playbook",
    "voice_drop",
    "multichannel",
    "sequence_execution",
    "safe_execution",
  ]
  return stages.map((stage) => buildApolloOperatorConfidenceCalibration(items, stage))
}
