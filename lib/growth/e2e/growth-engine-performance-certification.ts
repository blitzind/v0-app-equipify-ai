/** Phase GE-HARDEN-2 — Growth Engine performance certification runner (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthAgentOrchestration } from "@/lib/growth/agent-orchestration/agent-orchestration-service"
import { fetchGrowthCommandCenterUnification } from "@/lib/growth/command-center-unification/command-center-unification-service"
import { bootstrapGrowthEngineE2EProductionEnv } from "@/lib/growth/e2e/growth-engine-e2e-production-env"
import {
  assertCertificationSafetyInvariants,
  runGrowthEngineSafetyAudit,
} from "@/lib/growth/e2e/growth-engine-e2e-safety-audit"
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
import { auditDatabasePerformance } from "@/lib/growth/e2e/growth-engine-performance-db-audit"
import {
  buildBottleneckReport,
  generateOptimizationRecommendations,
} from "@/lib/growth/e2e/growth-engine-performance-recommendations"
import {
  GROWTH_ENGINE_PERFORMANCE_QA_MARKER,
  type GrowthEnginePerformanceReport,
  type PerformanceLatencyMetric,
  type SubsystemPerformanceResult,
} from "@/lib/growth/e2e/growth-engine-performance-types"
import { PERFORMANCE_THRESHOLDS } from "@/lib/growth/e2e/growth-engine-performance-thresholds"
import { fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import { REVENUE_PATH_HENRY_LEAD_ID } from "@/lib/growth/qa/revenue-path-validation-types"
import { loadGrowthSignalFeed } from "@/lib/growth/signal-intelligence/signal-feed-repository"

export { GROWTH_ENGINE_PERFORMANCE_QA_MARKER }

async function timedFetch<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; duration_ms: number }> {
  const start = performance.now()
  const result = await fn()
  return { result, duration_ms: Math.round(performance.now() - start) }
}

function productionFetchMetric(
  metric_id: string,
  label: string,
  duration_ms: number,
  threshold_ms: number,
  item_count: number,
): PerformanceLatencyMetric {
  return {
    metric_id,
    label,
    duration_ms,
    item_count,
    pass: duration_ms <= threshold_ms,
    threshold_ms,
  }
}

function buildProductionSubsystemMatrix(input: {
  engineById: Map<string, number>
  productionById: Map<string, number>
  safetyOk: boolean
}): SubsystemPerformanceResult[] {
  const config: Record<string, { engine?: string; production?: string }> = {
    prospect_discovery: { engine: "prospect_discovery" },
    signal_feed: { engine: "realtime_normalize_batch", production: "production_signal_feed" },
    operator_inbox: { engine: "large_dataset_workspace", production: "production_inbox" },
    campaign_readiness: { engine: "metrics_generation" },
    conversational_playbooks: {},
    human_interventions: { engine: "large_dataset_timeline" },
    follow_up_policies: {},
    sequence_preview: { engine: "sequence_preview" },
    campaign_builder: { engine: "campaign_builder" },
    realtime_events: { engine: "realtime_route_batch" },
    agent_orchestration: { engine: "agent_orchestration", production: "production_agent_orchestration" },
    command_center_unification: {
      engine: "command_center_workspace",
      production: "production_command_center",
    },
  }

  return GROWTH_ENGINE_E2E_CHAIN.map((subsystem_id) => {
    const cfg = config[subsystem_id] ?? {}
    const engineMs = cfg.engine ? (input.engineById.get(cfg.engine) ?? null) : null
    const productionMs = cfg.production ? (input.productionById.get(cfg.production) ?? null) : null
    const enginePass = engineMs === null || engineMs <= 10_000
    const productionPass = productionMs === null || productionMs <= 25_000
    return {
      subsystem_id,
      phase: subsystem_id,
      engine_benchmark_ms: engineMs,
      production_fetch_ms: productionMs,
      pass: input.safetyOk && enginePass && productionPass,
      safety_invariants_ok: input.safetyOk,
    }
  })
}

export async function executeGrowthEnginePerformanceCertification(
  admin: SupabaseClient,
  input?: { production?: boolean },
): Promise<GrowthEnginePerformanceReport> {
  if (input?.production) {
    bootstrapGrowthEngineE2EProductionEnv()
  }

  const execution_id = randomUUID()
  const organization_id = getGrowthEngineAiOrgId()
  const blockers: string[] = []
  const henryLeadId = REVENUE_PATH_HENRY_LEAD_ID

  const dashboard = runDashboardAggregationBenchmarks()
  const realtime = runRealtimeEventBenchmarks()
  const subsystem = runSubsystemEngineBenchmarks()
  const large = runLargeDatasetBenchmarks()
  const polling = runPollingFallbackBenchmark()
  const apollo = runApolloScaleSimulations()

  const production_metrics: PerformanceLatencyMetric[] = []
  let productionFetchSlow = false

  const commandCenter = await timedFetch("command_center", () =>
    fetchGrowthCommandCenterUnification(admin, {
      lead_id: henryLeadId,
      limit: 10,
      persist_audit: false,
    }),
  )
  production_metrics.push(
    productionFetchMetric(
      "production_command_center",
      "Production Command Center unification fetch",
      commandCenter.duration_ms,
      PERFORMANCE_THRESHOLDS.production_command_center_fetch_ms,
      commandCenter.result.views.reduce((n, v) => n + v.items.length, 0),
    ),
  )

  const agent = await timedFetch("agent", () =>
    fetchGrowthAgentOrchestration(admin, {
      lead_id: henryLeadId,
      limit: 5,
      persist_audit: false,
    }),
  )
  production_metrics.push(
    productionFetchMetric(
      "production_agent_orchestration",
      "Production agent orchestration fetch",
      agent.duration_ms,
      PERFORMANCE_THRESHOLDS.production_agent_orchestration_fetch_ms,
      agent.result.plans[0]?.tasks.length ?? 0,
    ),
  )

  const inbox = await timedFetch("inbox", () => fetchOperatorInboxQueue(admin, { limit: 20 }))
  production_metrics.push(
    productionFetchMetric(
      "production_inbox",
      "Production operator inbox fetch",
      inbox.duration_ms,
      PERFORMANCE_THRESHOLDS.production_inbox_fetch_ms,
      inbox.result.items.length,
    ),
  )

  const signalFeed = await timedFetch("signal_feed", () =>
    loadGrowthSignalFeed(admin, { lead_id: henryLeadId, limit: 50 }),
  )
  production_metrics.push(
    productionFetchMetric(
      "production_signal_feed",
      "Production signal feed fetch",
      signalFeed.duration_ms,
      PERFORMANCE_THRESHOLDS.production_signal_feed_fetch_ms,
      signalFeed.result.items.length,
    ),
  )

  for (const response of [commandCenter.result, agent.result]) {
    const safety = assertCertificationSafetyInvariants(response as unknown as Record<string, unknown>)
    if (!safety.ok) {
      blockers.push(`production_response_safety_invariant_failed:${safety.failures.join(",")}`)
    }
  }

  const inboxSafety = assertCertificationSafetyInvariants(inbox.result as unknown as Record<string, unknown>)
  if (!inboxSafety.ok) {
    blockers.push(`production_inbox_safety_failed:${inboxSafety.failures.join(",")}`)
  }
  if (inbox.result.requires_human_review !== true || inbox.result.autonomous_execution_enabled !== false) {
    blockers.push("production_inbox_safety_failed:response_flags")
  }
  for (const item of inbox.result.items) {
    if (item.requires_human_review !== true || item.autonomous_execution_enabled !== false) {
      blockers.push("production_inbox_safety_failed:item_flags")
      break
    }
  }

  const feedSafety = assertCertificationSafetyInvariants(signalFeed.result as unknown as Record<string, unknown>)
  if (!feedSafety.ok) {
    blockers.push(`production_signal_feed_safety_failed:${feedSafety.failures.join(",")}`)
  }
  for (const item of signalFeed.result.items) {
    if (item.requires_human_approval !== true) {
      blockers.push("production_signal_feed_safety_failed:item_requires_human_approval")
      break
    }
  }

  const dbAudit = await auditDatabasePerformance(admin)

  const latency_metrics = [
    ...dashboard,
    ...realtime.latency,
    ...subsystem,
    ...large,
    polling,
    ...production_metrics,
  ]

  const engineById = new Map(
    [...dashboard, ...realtime.latency, ...subsystem, ...large, polling].map((m) => [
      m.metric_id,
      m.duration_ms,
    ]),
  )
  const productionById = new Map(production_metrics.map((m) => [m.metric_id, m.duration_ms]))

  const safetyOk = verifyEngineSafetyInvariants()
  if (!safetyOk) blockers.push("engine_safety_invariants_failed")

  const safety_audit = runGrowthEngineSafetyAudit()
  if (safety_audit.violations.length > 0) {
    blockers.push(`safety_audit_violations:${safety_audit.violations.length}`)
  }

  for (const metric of latency_metrics.filter((m) => !m.pass)) {
    blockers.push(`latency_fail:${metric.metric_id}`)
    if (metric.metric_id.startsWith("production_")) productionFetchSlow = true
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
  for (const finding of dbAudit.findings.filter((f) => f.severity === "critical")) {
    blockers.push(`db_critical:${finding.finding_id}`)
  }

  const optimization_recommendations = generateOptimizationRecommendations({
    latency_metrics,
    apollo_simulations: apollo.simulations,
    database_findings: dbAudit.findings,
    production_fetch_slow: productionFetchSlow,
  })

  const bottleneck_report = buildBottleneckReport({
    latency_metrics,
    apollo_simulations: apollo.simulations,
    database_findings: dbAudit.findings,
  })

  if (Object.keys(dbAudit.query_timings_ms).length > 0) {
    bottleneck_report.push(
      `DB query timings: ${JSON.stringify(dbAudit.query_timings_ms)}`,
    )
  }

  const allPass = blockers.length === 0 && safetyOk && safety_audit.violations.length === 0

  return {
    ok: allPass,
    execution_id,
    qa_marker: GROWTH_ENGINE_PERFORMANCE_QA_MARKER,
    organization_id,
    environment: input?.production ? "production" : "local",
    final_verdict: allPass ? "PASS" : "FAIL",
    latency_metrics,
    throughput_metrics: realtime.throughput,
    memory_metrics: apollo.memory,
    apollo_scale_simulations: apollo.simulations,
    database_findings: dbAudit.findings,
    optimization_recommendations,
    subsystem_matrix: buildProductionSubsystemMatrix({ engineById, productionById, safetyOk }),
    bottleneck_report,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    blockers: [...new Set(blockers)],
  }
}
