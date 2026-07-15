/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — Autonomous DataMoon discovery types (client-safe). */

export const GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER =
  "ge-aios-datamoon-autonomous-discovery-cutover-1a-v1" as const

export const AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX =
  "ge-aios-autonomous-prospect-search" as const

export const AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY =
  "autonomous_prospect_search_1a" as const

export const DATAMOON_AUTONOMOUS_SINGLE_FLIGHT_ACTIVE_RUN_ERROR =
  "single_flight_active_run" as const

export const DATAMOON_AUTONOMOUS_DISCOVERY_STOP_REASONS = [
  "datamoon_not_configured",
  "datamoon_disabled",
  "datamoon_dry_run_only",
  "datamoon_budget_exhausted",
  "datamoon_request_active",
  "datamoon_job_failed",
  "datamoon_zero_results",
  "datamoon_provider_error",
  "business_profile_missing",
  "fixture_fallback_forbidden",
] as const

export type DatamoonAutonomousDiscoveryStopReason =
  (typeof DATAMOON_AUTONOMOUS_DISCOVERY_STOP_REASONS)[number]

export const DATAMOON_AUTONOMOUS_DISCOVERY_STATUS_LABELS = [
  "idle",
  "queued",
  "searching",
  "processing_results",
  "completed_with_results",
  "completed_zero_results",
  "needs_configuration",
  "provider_budget_paused",
  "failed",
] as const

export type DatamoonAutonomousDiscoveryStatusLabel =
  (typeof DATAMOON_AUTONOMOUS_DISCOVERY_STATUS_LABELS)[number]

export type ProspectSearchDiscoveryAuthority =
  | "autonomous_portfolio"
  | "portfolio_manual"
  | "workspace"

export type AutonomousProspectSearchDatamoonRunMetadata = {
  qa_marker: typeof GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER
  organization_id: string
  business_profile_fingerprint: string
  batch_size: number
  purpose: "prospect_search_intake"
  read_only_proof: boolean
  authority: ProspectSearchDiscoveryAuthority
}

export type AutonomousProspectDiscoveryProviderPolicy = {
  qaMarker: typeof GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER
  usesDatamoonAutonomousPath: boolean
  preferredProvider: "datamoon" | null
  fixtureFallbackBlockedInProduction: boolean
  otherAutonomousProvidersDisabled: boolean
  eligible: boolean
  stopReason: DatamoonAutonomousDiscoveryStopReason | null
  datamoonConfigured: boolean
  datamoonEnabled: boolean
  datamoonBudgetAvailable: boolean
}

export type DatamoonAutonomousDiscoveryHealthSnapshot = {
  ok: boolean
  qaMarker: typeof GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER
  organizationResolved: boolean
  approvedBusinessProfilePresent: boolean
  datamoonImplemented: boolean
  datamoonConfigured: boolean
  datamoonEnabled: boolean
  datamoonBudgetAvailable: boolean
  datamoonEligibleForAutonomousDiscovery: boolean
  prospectSearchRoutesToDatamoon: boolean
  fixtureFallbackBlockedInProduction: boolean
  otherAutonomousProvidersDisabled: boolean
}

export type DatamoonAutonomousDiscoveryOperatorState = {
  qaMarker: typeof GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER
  statusLabel: DatamoonAutonomousDiscoveryStatusLabel
  statusDisplay: string
  nextBatchSize: number | null
  jobActive: boolean
  showEstimatedHealthy: boolean
  lastCompletedCount: number | null
}
