/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — Operator-facing DataMoon discovery state (client-safe). */

import type { DatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
  type DatamoonAutonomousDiscoveryOperatorState,
  type DatamoonAutonomousDiscoveryStatusLabel,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import {
  autonomousDiscoveryStopReasonMessage,
  type AutonomousProspectDiscoveryProviderPolicy,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-policy-1a"

const STATUS_DISPLAY: Record<DatamoonAutonomousDiscoveryStatusLabel, string> = {
  idle: "Idle",
  queued: "Queued",
  searching: "Searching",
  processing_results: "Processing results",
  completed_with_results: "Completed",
  completed_zero_results: "No matching companies found",
  needs_configuration: "DataMoon needs configuration",
  provider_budget_paused: "Provider budget paused",
  failed: "Discovery failed",
}

export function buildDatamoonAutonomousDiscoveryOperatorState(input: {
  policy: AutonomousProspectDiscoveryProviderPolicy
  activeRun?: DatamoonAudienceImportRun | null
  latestRun?: DatamoonAudienceImportRun | null
  nextBatchSize?: number | null
  lastCompletedCount?: number | null
  recentZeroResult?: boolean
}): DatamoonAutonomousDiscoveryOperatorState {
  const nextBatchSize =
    input.nextBatchSize != null && input.nextBatchSize > 0 ? input.nextBatchSize : null

  if (input.policy.stopReason === "datamoon_not_configured" || input.policy.stopReason === "datamoon_disabled" || input.policy.stopReason === "datamoon_dry_run_only") {
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      statusLabel: "needs_configuration",
      statusDisplay: autonomousDiscoveryStopReasonMessage(input.policy.stopReason),
      nextBatchSize,
      jobActive: false,
      showEstimatedHealthy: false,
      lastCompletedCount: input.lastCompletedCount ?? null,
    }
  }

  if (input.policy.stopReason === "datamoon_budget_exhausted") {
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      statusLabel: "provider_budget_paused",
      statusDisplay: STATUS_DISPLAY.provider_budget_paused,
      nextBatchSize,
      jobActive: false,
      showEstimatedHealthy: false,
      lastCompletedCount: input.lastCompletedCount ?? null,
    }
  }

  const activeRun = input.activeRun ?? null
  if (activeRun) {
    const statusLabel: DatamoonAutonomousDiscoveryStatusLabel =
      activeRun.status === "pending_build"
        ? "queued"
        : activeRun.status === "building"
          ? "searching"
          : "processing_results"

    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      statusLabel,
      statusDisplay: STATUS_DISPLAY[statusLabel],
      nextBatchSize,
      jobActive: true,
      showEstimatedHealthy: false,
      lastCompletedCount: input.lastCompletedCount ?? null,
    }
  }

  const latestRun = input.latestRun ?? null
  if (latestRun?.status === "failed") {
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      statusLabel: "failed",
      statusDisplay: STATUS_DISPLAY.failed,
      nextBatchSize,
      jobActive: false,
      showEstimatedHealthy: false,
      lastCompletedCount: input.lastCompletedCount ?? null,
    }
  }

  if (input.recentZeroResult || (latestRun?.status === "completed" && latestRun.previewCount === 0)) {
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      statusLabel: "completed_zero_results",
      statusDisplay: STATUS_DISPLAY.completed_zero_results,
      nextBatchSize,
      jobActive: false,
      showEstimatedHealthy: false,
      lastCompletedCount: 0,
    }
  }

  if ((input.lastCompletedCount ?? 0) > 0) {
    return {
      qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
      statusLabel: "completed_with_results",
      statusDisplay: `Completed: ${input.lastCompletedCount} companies found`,
      nextBatchSize,
      jobActive: false,
      showEstimatedHealthy: true,
      lastCompletedCount: input.lastCompletedCount ?? null,
    }
  }

  return {
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
    statusLabel: "idle",
    statusDisplay: nextBatchSize ? `Next batch: ${nextBatchSize}` : STATUS_DISPLAY.idle,
    nextBatchSize,
    jobActive: false,
    showEstimatedHealthy: false,
    lastCompletedCount: input.lastCompletedCount ?? null,
  }
}
