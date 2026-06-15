/** Phase GE-HARDEN-2 — Optimization recommendations generator (client-safe). */

import type {
  ApolloScaleSimulationResult,
  DatabasePerformanceFinding,
  OptimizationRecommendation,
  PerformanceLatencyMetric,
} from "@/lib/growth/e2e/growth-engine-performance-types"

export function generateOptimizationRecommendations(input: {
  latency_metrics: PerformanceLatencyMetric[]
  apollo_simulations: ApolloScaleSimulationResult[]
  database_findings: DatabasePerformanceFinding[]
  production_fetch_slow?: boolean
}): OptimizationRecommendation[] {
  const recs: OptimizationRecommendation[] = []
  let id = 0
  const add = (
    category: OptimizationRecommendation["category"],
    priority: OptimizationRecommendation["priority"],
    title: string,
    description: string,
    subsystem: string,
  ) => {
    recs.push({
      recommendation_id: `opt-${++id}`,
      category,
      priority,
      title,
      description,
      subsystem,
      apply_automatically: false,
    })
  }

  for (const metric of input.latency_metrics.filter((m) => !m.pass)) {
    if (metric.metric_id.includes("workspace") || metric.metric_id.includes("timeline")) {
      add(
        "parallelization",
        "high",
        `Optimize ${metric.label}`,
        `${metric.label} exceeded ${metric.threshold_ms}ms (${metric.duration_ms}ms). Consider parallelizing subsystem fetches in the aggregation service layer.`,
        "command_center_unification",
      )
    }
    if (metric.metric_id.includes("realtime")) {
      add(
        "realtime",
        "medium",
        `Optimize ${metric.label}`,
        `${metric.label} exceeded threshold. Batch normalization and pre-index routes by qa_marker to reduce per-event overhead.`,
        "realtime_events",
      )
    }
  }

  for (const sim of input.apollo_simulations.filter((s) => !s.pass)) {
    add(
      "apollo_scale",
      "high",
      `Apollo ${sim.tier} scale readiness`,
      `Workspace aggregation at ${sim.tier} leads took ${sim.workspace_aggregation_ms}ms. Recommend pagination, lazy section loading, and capped inbox/signal fetch limits at scale.`,
      "command_center_unification",
    )
  }

  for (const finding of input.database_findings) {
    if (finding.category === "missing_index") {
      add("query", "high", finding.description, finding.hint, "database")
    }
    if (finding.category === "sequential_fetch" || finding.category === "n_plus_one") {
      add("parallelization", "medium", finding.description, finding.hint, finding.finding_id)
    }
    if (finding.category === "slow_query") {
      add("query", "high", finding.description, finding.hint, "database")
    }
  }

  if (input.production_fetch_slow) {
    add(
      "cache",
      "medium",
      "Cache unified workspace snapshots",
      "Production fetch latency exceeded threshold. Consider short-TTL in-memory cache keyed by organization_id + lead_id with realtime invalidation only (no execution side effects).",
      "command_center_unification",
    )
    add(
      "ui_refresh",
      "low",
      "Debounce Command Center refresh",
      "Use existing useGrowthRealtimeRefresh with 45s polling fallback; avoid full workspace refetch on every event route match.",
      "command_center",
    )
  }

  if (recs.length === 0) {
    add(
      "apollo_scale",
      "low",
      "Maintain current performance baselines",
      "All benchmarks within thresholds. Continue monitoring Apollo-scale simulations on each release via pnpm test:growth-engine-performance:production.",
      "growth_engine",
    )
  }

  return recs
}

export function buildBottleneckReport(input: {
  latency_metrics: PerformanceLatencyMetric[]
  apollo_simulations: ApolloScaleSimulationResult[]
  database_findings: DatabasePerformanceFinding[]
}): string[] {
  const bottlenecks: string[] = []

  for (const m of input.latency_metrics.filter((x) => !x.pass)) {
    bottlenecks.push(`${m.label}: ${m.duration_ms}ms (threshold ${m.threshold_ms}ms)`)
  }
  for (const s of input.apollo_simulations.filter((x) => !x.pass)) {
    bottlenecks.push(`Apollo ${s.tier}: workspace ${s.workspace_aggregation_ms}ms, heap ${s.memory_heap_mb}MB`)
  }
  for (const f of input.database_findings.filter((x) => x.severity === "critical" || x.severity === "warning")) {
    bottlenecks.push(`[${f.category}] ${f.description}`)
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push("No bottlenecks detected — all benchmarks within thresholds")
  }

  return bottlenecks
}
