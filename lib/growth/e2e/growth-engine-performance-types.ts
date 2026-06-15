/** Phase GE-HARDEN-2 — Growth Engine performance certification types (client-safe). */

export const GROWTH_ENGINE_PERFORMANCE_QA_MARKER = "growth-engine-performance-harden-2-v1" as const

export const GROWTH_ENGINE_PERFORMANCE_CONFIRM = "RUN_GROWTH_ENGINE_PERFORMANCE_CERTIFICATION" as const

export const APOLLO_SCALE_TIERS = [1000, 5000, 10000] as const
export type ApolloScaleTier = (typeof APOLLO_SCALE_TIERS)[number]

export type PerformanceLatencyMetric = {
  metric_id: string
  label: string
  duration_ms: number
  item_count: number
  pass: boolean
  threshold_ms: number
}

export type PerformanceThroughputMetric = {
  metric_id: string
  label: string
  items_per_second: number
  total_items: number
  duration_ms: number
  pass: boolean
  threshold_items_per_second: number
}

export type PerformanceMemoryMetric = {
  metric_id: string
  label: string
  heap_used_mb: number
  heap_delta_mb: number
  pass: boolean
  threshold_mb: number
}

export type ApolloScaleSimulationResult = {
  tier: ApolloScaleTier
  lead_count: number
  workspace_aggregation_ms: number
  readiness_generation_ms: number
  sequence_preview_ms: number
  agent_orchestration_ms: number
  event_volume: number
  memory_heap_mb: number
  pass: boolean
}

export type DatabasePerformanceFinding = {
  finding_id: string
  severity: "info" | "warning" | "critical"
  category: "slow_query" | "query_count" | "sequential_fetch" | "n_plus_one" | "missing_index"
  description: string
  hint: string
  duration_ms?: number
}

export type OptimizationRecommendation = {
  recommendation_id: string
  category: "query" | "cache" | "parallelization" | "realtime" | "ui_refresh" | "apollo_scale"
  priority: "low" | "medium" | "high"
  title: string
  description: string
  subsystem: string
  apply_automatically: false
}

export type SubsystemPerformanceResult = {
  subsystem_id: string
  phase: string
  engine_benchmark_ms: number | null
  production_fetch_ms: number | null
  pass: boolean
  safety_invariants_ok: boolean
}

export type GrowthEnginePerformanceReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_ENGINE_PERFORMANCE_QA_MARKER
  organization_id: string | null
  environment: "local" | "production"
  final_verdict: "PASS" | "FAIL"
  latency_metrics: PerformanceLatencyMetric[]
  throughput_metrics: PerformanceThroughputMetric[]
  memory_metrics: PerformanceMemoryMetric[]
  apollo_scale_simulations: ApolloScaleSimulationResult[]
  database_findings: DatabasePerformanceFinding[]
  optimization_recommendations: OptimizationRecommendation[]
  subsystem_matrix: SubsystemPerformanceResult[]
  bottleneck_report: string[]
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  blockers: string[]
}
