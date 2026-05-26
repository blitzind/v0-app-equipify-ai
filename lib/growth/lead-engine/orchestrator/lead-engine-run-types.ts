/** Lead Engine orchestrator run types (Prompt 11). Client-safe. */

import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"

export const GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER = "lead-engine-workspace-v1" as const

export const GROWTH_LEAD_ENGINE_PIPELINE_STATUSES = [
  "running",
  "completed",
  "failed",
  "stopped_fatal",
] as const

export type GrowthLeadEnginePipelineStatus =
  (typeof GROWTH_LEAD_ENGINE_PIPELINE_STATUSES)[number]

export const GROWTH_LEAD_ENGINE_STAGE_COMPLETION_STATUSES = [
  "pending",
  "completed",
  "failed",
  "skipped",
] as const

export type GrowthLeadEngineStageCompletionStatus =
  (typeof GROWTH_LEAD_ENGINE_STAGE_COMPLETION_STATUSES)[number]

export type GrowthLeadEnginePipelineAttributionEntry = {
  stage_id: GrowthLeadEnginePipelineStageId
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthLeadEnginePipelineEvidenceEntry = {
  stage_id: GrowthLeadEnginePipelineStageId
  summary: string
  items: Array<{ claim: string; evidence: string; source: string }>
}

/** Provider adapter public view — raw_payload retained server-side only (Prompt 14). */
export type GrowthLeadEngineStageProviderPublicResult = {
  provider_name: string
  provider_type: string
  request_id: string
  status: string
  confidence: number
  source_attribution_count: number
  raw_payload_retained: true
  warnings: string[]
  errors: string[]
}

export type GrowthLeadEngineOrchestratorStageResult = {
  stage_id: GrowthLeadEnginePipelineStageId
  label: string
  short_label: string
  qa_marker: string
  status: GrowthLeadEngineStageCompletionStatus
  duration_ms: number
  raw_json: string
  parsed: unknown | null
  parse_ok: boolean
  parse_message: string | null
  confidence: number | null
  human_review_required: boolean | null
  attribution: GrowthLeadEnginePipelineAttributionEntry[]
  evidence: GrowthLeadEnginePipelineEvidenceEntry | null
  diagnostics: string[]
  fatal: boolean
  warnings: string[]
  /** Present when pipeline runs with provider adapter enabled. */
  provider_results?: GrowthLeadEngineStageProviderPublicResult[]
}

export type GrowthLeadEnginePipelineRun = {
  run_id: string
  qa_marker: typeof GROWTH_LEAD_ENGINE_ORCHESTRATOR_QA_MARKER
  mode: "fixture_dry_run"
  /** null when provider adapter not invoked (default workspace dry-run). */
  provider_mode: "fixture" | "internal" | "future_external" | null
  provider_adapter_qa_marker: "lead-engine-provider-adapter-v1" | null
  pipeline_status: GrowthLeadEnginePipelineStatus
  current_stage: GrowthLeadEnginePipelineStageId | null
  completed_stages: GrowthLeadEnginePipelineStageId[]
  failed_stage: GrowthLeadEnginePipelineStageId | null
  execution_duration_ms: number
  pipeline_confidence: number
  human_review_required: boolean
  stage_results: GrowthLeadEngineOrchestratorStageResult[]
  pipeline_diagnostics: string[]
  pipeline_evidence_chain: GrowthLeadEnginePipelineEvidenceEntry[]
  pipeline_attribution_chain: GrowthLeadEnginePipelineAttributionEntry[]
  fatal_errors: string[]
  warning_messages: string[]
  execution_summary: string
  input: {
    companyName: string
    domain: string
    industry: string
    location: string
    notes: string
  }
}
