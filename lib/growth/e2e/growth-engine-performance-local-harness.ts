/** Phase GE-HARDEN-2 — Local performance harness (client-safe, no Supabase). */

import { randomUUID } from "node:crypto"
import { runGrowthEngineSafetyAudit } from "@/lib/growth/e2e/growth-engine-e2e-safety-audit"
import { GROWTH_ENGINE_E2E_CHAIN } from "@/lib/growth/e2e/growth-engine-e2e-subsystems"
import {
  runApolloScaleSimulations,
  runDashboardAggregationBenchmarks,
  runLargeDatasetBenchmarks,
  runPollingFallbackBenchmark,
  runRealtimeEventBenchmarks,
  runSubsystemEngineBenchmarks,
  verifyEngineSafetyInvariants,
} from "@/lib/growth/e2e/growth-engine-performance-benchmarks"
import {
  buildBottleneckReport,
  generateOptimizationRecommendations,
} from "@/lib/growth/e2e/growth-engine-performance-recommendations"
import {
  GROWTH_ENGINE_PERFORMANCE_QA_MARKER,
  type GrowthEnginePerformanceReport,
  type SubsystemPerformanceResult,
} from "@/lib/growth/e2e/growth-engine-performance-types"

function buildSubsystemMatrix(input: {
  latencyById: Map<string, number>
  safetyOk: boolean
}): SubsystemPerformanceResult[] {
  const engineMap: Record<string, string | null> = {
    prospect_discovery: "prospect_discovery",
    signal_feed: "realtime_normalize_batch",
    operator_inbox: "large_dataset_workspace",
    campaign_readiness: "metrics_generation",
    conversational_playbooks: null,
    human_interventions: "large_dataset_timeline",
    follow_up_policies: null,
    sequence_preview: "sequence_preview",
    campaign_builder: "campaign_builder",
    realtime_events: "realtime_route_batch",
    agent_orchestration: "agent_orchestration",
    command_center_unification: "command_center_workspace",
  }

  return GROWTH_ENGINE_E2E_CHAIN.map((subsystem_id) => {
    const metricId = engineMap[subsystem_id]
    const engineMs = metricId ? (input.latencyById.get(metricId) ?? null) : null
    return {
      subsystem_id,
      phase: subsystem_id,
      engine_benchmark_ms: engineMs,
      production_fetch_ms: null,
      pass: input.safetyOk && (engineMs === null || engineMs <= 10_000),
      safety_invariants_ok: input.safetyOk,
    }
  })
}

export function runGrowthEnginePerformanceLocalHarness(): GrowthEnginePerformanceReport {
  const blockers: string[] = []

  const dashboard = runDashboardAggregationBenchmarks()
  const realtime = runRealtimeEventBenchmarks()
  const subsystem = runSubsystemEngineBenchmarks()
  const large = runLargeDatasetBenchmarks()
  const polling = runPollingFallbackBenchmark()
  const apollo = runApolloScaleSimulations()

  const latency_metrics = [
    ...dashboard,
    ...realtime.latency,
    ...subsystem,
    ...large,
    polling,
  ]

  const latencyById = new Map(latency_metrics.map((m) => [m.metric_id, m.duration_ms]))

  const safetyOk = verifyEngineSafetyInvariants()
  if (!safetyOk) blockers.push("engine_safety_invariants_failed")

  const safety_audit = runGrowthEngineSafetyAudit()
  if (safety_audit.violations.length > 0) {
    blockers.push(`safety_audit_violations:${safety_audit.violations.length}`)
  }

  for (const metric of latency_metrics.filter((m) => !m.pass)) {
    blockers.push(`latency_fail:${metric.metric_id}`)
  }
  for (const sim of apollo.simulations.filter((s) => !s.pass)) {
    blockers.push(`apollo_fail:${sim.tier}`)
  }
  for (const mem of apollo.memory.filter((m) => !m.pass)) {
    blockers.push(`memory_fail:${mem.metric_id}`)
  }
  for (const metric of realtime.throughput.filter((m) => !m.pass)) {
    blockers.push(`throughput_fail:${metric.metric_id}`)
  }

  const database_findings = [
    {
      finding_id: "local_static_audit",
      severity: "info" as const,
      category: "query_count" as const,
      description: "Local harness — database audit deferred to production certification",
      hint: "Run pnpm test:growth-engine-performance:production for live query timings",
    },
  ]

  const optimization_recommendations = generateOptimizationRecommendations({
    latency_metrics,
    apollo_simulations: apollo.simulations,
    database_findings,
  })

  const bottleneck_report = buildBottleneckReport({
    latency_metrics,
    apollo_simulations: apollo.simulations,
    database_findings,
  })

  const allPass =
    blockers.length === 0 &&
    safetyOk &&
    safety_audit.violations.length === 0

  return {
    ok: allPass,
    execution_id: randomUUID(),
    qa_marker: GROWTH_ENGINE_PERFORMANCE_QA_MARKER,
    organization_id: null,
    environment: "local",
    final_verdict: allPass ? "PASS" : "FAIL",
    latency_metrics,
    throughput_metrics: realtime.throughput,
    memory_metrics: apollo.memory,
    apollo_scale_simulations: apollo.simulations,
    database_findings,
    optimization_recommendations,
    subsystem_matrix: buildSubsystemMatrix({ latencyById, safetyOk }),
    bottleneck_report,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    blockers: [...new Set(blockers)],
  }
}
