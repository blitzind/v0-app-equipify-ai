/** Phase GE-OPS-1 — Growth Engine operations certification types (client-safe). */

export const GROWTH_ENGINE_OPS_QA_MARKER = "growth-engine-ops-ge-ops-1-v1" as const

export const GROWTH_ENGINE_OPS_CONFIRM = "RUN_GROWTH_ENGINE_OPS_CERTIFICATION" as const

export const OPS_DATASET_TIERS = [100, 500, 1000] as const
export type OpsDatasetTier = (typeof OPS_DATASET_TIERS)[number]

export type OpsFindingSeverity = "info" | "warning" | "critical"

export type OpsFinding = {
  finding_id: string
  severity: OpsFindingSeverity
  category: "apollo" | "dataset" | "workflow" | "operator" | "safety" | "throughput"
  description: string
  remediation: string
}

export type ApolloReadinessReport = {
  ready_for_live_search: boolean
  ready_for_live_benchmark: boolean
  ready_for_enrichment: boolean
  mock_mode: boolean
  api_key_present: boolean
  api_key_source: string | null
  credit_limits: {
    max_companies_per_run: number
    max_api_calls_per_run: number
    max_enrichment_batches_per_run: number
    max_contacts_per_company: number
  }
  integration_points_verified: number
  integration_points_total: number
  issues: Array<{ code: string; severity: string; message: string }>
  recommendations: string[]
}

export type DatasetCertificationResult = {
  tier: OpsDatasetTier
  lead_count: number
  import_throughput_ms: number
  discovery_throughput_ms: number
  readiness_generation_ms: number
  workspace_aggregation_ms: number
  event_generation_ms: number
  review_workflow_ms: number
  memory_heap_mb: number
  error_rate: number
  pass: boolean
}

export type HumanWorkflowStepResult = {
  step_id: string
  label: string
  safety_invariants_ok: boolean
  pass: boolean
}

export type ReviewWorkflowMetrics = {
  command_center_fetch_ms: number | null
  agent_orchestration_fetch_ms: number | null
  operator_inbox_fetch_ms: number | null
  signal_feed_fetch_ms: number | null
  human_review_required: true
  approval_queue_items: number
}

export type GrowthEngineOpsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_ENGINE_OPS_QA_MARKER
  organization_id: string | null
  environment: "local" | "production"
  final_verdict: "PASS" | "FAIL"
  apollo_readiness: ApolloReadinessReport
  dataset_certification_matrix: DatasetCertificationResult[]
  throughput_metrics: Record<string, number>
  error_metrics: { total: number; critical: number; warning: number }
  review_workflow_metrics: ReviewWorkflowMetrics
  safety_findings: OpsFinding[]
  workflow_findings: OpsFinding[]
  operator_findings: OpsFinding[]
  operational_recommendations: string[]
  persisted_audit_event_id: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  blockers: string[]
}
