export const GROWTH_AIOS_LIVE_RUNTIME_CONFIG_PROOF_1A_QA_MARKER =
  "ge-aios-live-runtime-config-proof-1a-v1" as const

export type GrowthAiosRuntimeConfigHealthSnapshot = {
  ok: boolean
  qaMarker: typeof GROWTH_AIOS_LIVE_RUNTIME_CONFIG_PROOF_1A_QA_MARKER
  organizationConfigured: boolean
  organizationValidUuid: boolean
  organizationMatchesApprovedBusinessProfile: boolean
  nativeDecisionEngineEnabled: boolean
  dailyRevenueWorkQueueEnabled: boolean
  communicationStrategyEnabled: boolean
  outboundEnabled: boolean
  schedulerMigrationReady: boolean
  activeObjectiveCount: number | null
  dueRunningObjectiveCount: number | null
}

export type GrowthAiosRuntimeConfigProofClassification =
  | "verified_true"
  | "verified_false"
  | "unverified_sensitive_value"
  | "not_configured"
