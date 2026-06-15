/** Phase GE-HARDEN-1 — Growth Engine E2E certification types (client-safe). */

export const GROWTH_ENGINE_E2E_QA_MARKER = "growth-engine-e2e-harden-1-v1" as const

export const GROWTH_ENGINE_E2E_CONFIRM = "RUN_GROWTH_ENGINE_E2E_CERTIFICATION" as const

export type GrowthEngineE2ESubsystemId =
  | "prospect_discovery"
  | "signal_feed"
  | "operator_inbox"
  | "campaign_readiness"
  | "conversational_playbooks"
  | "human_interventions"
  | "follow_up_policies"
  | "sequence_preview"
  | "campaign_builder"
  | "realtime_events"
  | "agent_orchestration"
  | "command_center_unification"

export type GrowthEngineE2ESubsystemResult = {
  subsystem_id: GrowthEngineE2ESubsystemId
  phase: string
  qa_marker: string
  readiness_route: string
  execute_route: string
  readiness_ok: boolean
  certification_ok: boolean
  pass_count: number
  check_count: number
  failed_checks: Array<{ id: string; hint: string }>
  safety_invariants_ok: boolean
}

export type GrowthEngineE2ESafetyAuditResult = {
  routes_scanned: number
  panels_scanned: number
  violations: Array<{ file: string; pattern: string; hint: string }>
  invariants_checked: number
  invariants_passed: number
}

export type GrowthEngineE2EAuditHealth = {
  schema_ready: boolean
  recent_event_count: number
  gs_marker_event_count: number
  verified: boolean
}

export type GrowthEngineE2ECertificationReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_ENGINE_E2E_QA_MARKER
  organization_id: string | null
  environment: "local" | "production"
  final_verdict: "PASS" | "FAIL"
  subsystem_matrix: GrowthEngineE2ESubsystemResult[]
  safety_audit: GrowthEngineE2ESafetyAuditResult
  audit_health: GrowthEngineE2EAuditHealth | null
  chain_order: GrowthEngineE2ESubsystemId[]
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  blockers: string[]
}
