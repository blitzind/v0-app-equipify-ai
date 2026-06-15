/** Phase GE-HARDEN-3 — Growth Engine operational hardening types (client-safe). */

export const GROWTH_ENGINE_HARDENING_QA_MARKER = "growth-engine-hardening-harden-3-v1" as const

export const GROWTH_ENGINE_HARDENING_CONFIRM = "RUN_GROWTH_ENGINE_HARDENING_CERTIFICATION" as const

export type GrowthEngineEmptyStateKind =
  | "no_leads"
  | "no_signals"
  | "no_interventions"
  | "no_recommendations"
  | "no_events"
  | "no_inbox_items"
  | "no_sequence_previews"
  | "no_campaign_builders"
  | "no_agent_plans"
  | "no_campaign_readiness"
  | "no_follow_up_policies"
  | "no_playbooks"
  | "no_command_center_items"

export type HardeningFindingSeverity = "info" | "warning" | "critical"

export type HardeningFindingCategory =
  | "error_handling"
  | "empty_state"
  | "loading_retry"
  | "observability"
  | "kill_switch"
  | "ux_review"
  | "safety"

export type HardeningFinding = {
  finding_id: string
  severity: HardeningFindingSeverity
  category: HardeningFindingCategory
  subsystem_id: string | null
  description: string
  remediation: string
  file_path?: string
}

export type KillSwitchValidation = {
  switch_id: string
  env_var: string
  expected_when_active: string
  verified: boolean
  detail: string
}

export type SubsystemHardeningResult = {
  subsystem_id: string
  phase: string
  error_handling_ok: boolean
  empty_state_ok: boolean
  loading_retry_ok: boolean
  observability_ok: boolean
  kill_switch_ok: boolean
  ux_ok: boolean
  safety_ok: boolean
  pass: boolean
  findings: string[]
}

export type GrowthEngineDiagnosticsSummary = {
  command_center_fetch_ms: number | null
  agent_orchestration_fetch_ms: number | null
  operator_inbox_fetch_ms: number | null
  signal_feed_fetch_ms: number | null
  event_routing_ms: number | null
  realtime_subscription_mode: "realtime" | "polling" | "unavailable" | null
  polling_fallback_active: boolean
  error_rate: number
  retry_rate: number
  stale_data_detected: boolean
  persisted_audit_event_id: string | null
}

export type GrowthEngineHardeningReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_ENGINE_HARDENING_QA_MARKER
  organization_id: string | null
  environment: "local" | "production"
  final_verdict: "PASS" | "FAIL"
  subsystem_matrix: SubsystemHardeningResult[]
  diagnostics_summary: GrowthEngineDiagnosticsSummary
  error_metrics: { total_findings: number; critical: number; warning: number }
  retry_metrics: { panels_with_retry: number; panels_missing_retry: number }
  stale_data_findings: HardeningFinding[]
  ux_findings: HardeningFinding[]
  safety_findings: HardeningFinding[]
  all_findings: HardeningFinding[]
  kill_switch_validations: KillSwitchValidation[]
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  blockers: string[]
}
