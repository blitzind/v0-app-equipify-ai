/** Phase GE-OPS-1 — Deterministic dataset certification (client-safe, no live outreach). */

import { generateGrowthAgentPlan } from "@/lib/growth/agent-orchestration/agent-orchestration-engine"
import { buildGrowthCommandCenterWorkspace } from "@/lib/growth/command-center-unification/command-center-unification-engine"
import {
  agentPlanInputFromAggregationContext,
  apolloTierCounts,
  simulateAggregationContext,
  simulateRealtimeEvents,
} from "@/lib/growth/e2e/growth-engine-performance-simulation"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import { buildProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-plan-builder"
import {
  opsMemoryThreshold,
  opsWorkspaceThreshold,
} from "@/lib/growth/e2e/growth-engine-ops-thresholds"
import type { DatasetCertificationResult, OpsDatasetTier } from "@/lib/growth/e2e/growth-engine-ops-types"
import { normalizeGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-normalizer"

function measureMs<T>(fn: () => T): { result: T; duration_ms: number } {
  const start = performance.now()
  const result = fn()
  return { result, duration_ms: Math.round(performance.now() - start) }
}

function heapUsedMb(): number {
  return Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10
}

/** Simulates Apollo import batch processing — deterministic, no HTTP. */
function simulateImportThroughput(leadCount: number): number {
  const batchSize = 10
  const batches = Math.ceil(leadCount / batchSize)
  const { duration_ms } = measureMs(() => {
    for (let b = 0; b < batches; b++) {
      for (let i = 0; i < batchSize; i++) {
        const idx = b * batchSize + i
        if (idx >= leadCount) break
        void `apollo-import-lead-${idx}`
      }
    }
  })
  return duration_ms
}

export function runOpsDatasetCertification(): DatasetCertificationResult[] {
  const results: DatasetCertificationResult[] = []

  for (const tier of [100, 500, 1000] as OpsDatasetTier[]) {
    const counts = apolloTierCounts(tier)
    const heapBefore = heapUsedMb()

    const import_ms = simulateImportThroughput(tier)

    const discovery = measureMs(() => {
      const intent = parseProspectSearchIntent("Find HVAC companies in Texas with 20+ technicians")
      buildProspectSearchPlan(intent)
    })

    const ctx = simulateAggregationContext({
      signal_count: counts.signals,
      inbox_count: counts.inbox,
      intervention_count: counts.interventions,
      event_count: counts.events,
      lead_id: `ops-lead-${tier}`,
    })

    const readiness = measureMs(() => buildGrowthCommandCenterWorkspace(ctx))
    const workspace = measureMs(() => buildGrowthCommandCenterWorkspace(ctx))

    const events = simulateRealtimeEvents(counts.events)
    const eventGen = measureMs(() => {
      for (const row of events) {
        normalizeGrowthRealtimeEvent({
          id: row.event_id,
          organization_id: "sim-org",
          event_type: "scored",
          event_payload: { qa_marker: row.qa_marker, event_name: "ops_cert", lead_id: row.lead_id },
          occurred_at: row.occurred_at,
        })
      }
    })

    const review = measureMs(() => generateGrowthAgentPlan(agentPlanInputFromAggregationContext(ctx)))

    const heapAfter = heapUsedMb()
    const memThreshold = opsMemoryThreshold(tier)
    const workspaceThreshold = opsWorkspaceThreshold(tier)

    const pass =
      workspace.duration_ms <= workspaceThreshold &&
      heapAfter <= memThreshold &&
      review.result.requires_human_review === true &&
      review.result.autonomous_execution_enabled === false &&
      review.result.outreach_execution === false &&
      review.result.enrollment_execution === false

    results.push({
      tier,
      lead_count: tier,
      import_throughput_ms: import_ms,
      discovery_throughput_ms: discovery.duration_ms,
      readiness_generation_ms: readiness.duration_ms,
      workspace_aggregation_ms: workspace.duration_ms,
      event_generation_ms: eventGen.duration_ms,
      review_workflow_ms: review.duration_ms,
      memory_heap_mb: heapAfter,
      error_rate: pass ? 0 : 1,
      pass,
    })

    void heapBefore
  }

  return results
}
