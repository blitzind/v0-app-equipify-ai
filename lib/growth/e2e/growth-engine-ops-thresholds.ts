/** Phase GE-OPS-1 — Dataset certification thresholds (client-safe). */

import type { OpsDatasetTier } from "@/lib/growth/e2e/growth-engine-ops-types"

export const OPS_DATASET_THRESHOLDS = {
  workspace_aggregation_ms: {
    100: 300,
    500: 1500,
    1000: 3000,
  } satisfies Record<OpsDatasetTier, number>,
  memory_heap_mb: {
    100: 64,
    500: 128,
    1000: 256,
  } satisfies Record<OpsDatasetTier, number>,
  review_workflow_ms: {
    100: 500,
    500: 2000,
    1000: 4000,
  } satisfies Record<OpsDatasetTier, number>,
  production_command_center_fetch_ms: 25_000,
  production_agent_fetch_ms: 25_000,
  production_inbox_fetch_ms: 20_000,
  production_signal_feed_fetch_ms: 20_000,
} as const

export function opsWorkspaceThreshold(tier: OpsDatasetTier): number {
  return OPS_DATASET_THRESHOLDS.workspace_aggregation_ms[tier]
}

export function opsMemoryThreshold(tier: OpsDatasetTier): number {
  return OPS_DATASET_THRESHOLDS.memory_heap_mb[tier]
}
