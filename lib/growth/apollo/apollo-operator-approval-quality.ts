/** Approval quality analytics per stage (Phase 13A). */

import { APOLLO_OPERATOR_QUEUE_STAGE_LABELS } from "@/lib/growth/apollo/apollo-operator-queue-mapper"
import type {
  ApolloOperatorApprovalQuality,
  ApolloOperatorQueueItem,
  ApolloOperatorQueueStage,
} from "@/lib/growth/apollo/apollo-operator-scale-types"
import { operatorThroughputPct } from "@/lib/growth/apollo/apollo-operator-throughput-calculator"

export function buildApolloOperatorApprovalQuality(
  items: ApolloOperatorQueueItem[],
  stage: ApolloOperatorQueueStage,
): ApolloOperatorApprovalQuality {
  const stageItems = items.filter((item) => item.stage === stage)
  const resolved = stageItems.filter((item) => item.outcome !== "pending")
  const approved = resolved.filter((item) => item.outcome === "approved").length
  const rejected = resolved.filter((item) => item.outcome === "rejected").length
  const regenerated = stageItems.filter((item) => item.outcome === "regenerated").length
  const total = resolved.length + regenerated

  return {
    stage,
    label: APOLLO_OPERATOR_QUEUE_STAGE_LABELS[stage],
    approve_pct: operatorThroughputPct(approved, total),
    reject_pct: operatorThroughputPct(rejected, total),
    regenerate_pct: operatorThroughputPct(regenerated, total),
    total_resolved: total,
  }
}

export function buildApolloOperatorApprovalQualityReport(
  items: ApolloOperatorQueueItem[],
): ApolloOperatorApprovalQuality[] {
  const stages: ApolloOperatorQueueStage[] = [
    "enrollment",
    "account_playbook",
    "voice_drop",
    "multichannel",
    "sequence_execution",
    "safe_execution",
  ]
  return stages.map((stage) => buildApolloOperatorApprovalQuality(items, stage))
}
