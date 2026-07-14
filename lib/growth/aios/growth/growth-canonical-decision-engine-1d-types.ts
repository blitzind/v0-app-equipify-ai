/**
 * GE-AIOS-DECISION-ENGINE-1D — Enforcement edge closure types (client-safe).
 */

export const GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER =
  "ge-aios-decision-engine-1d-v1" as const

export type CanonicalDecisionOperatorOverrideScope = "sequence" | "transport" | "growth5f"

export type CanonicalDecisionOperatorOverrideRecord = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER
  operatorId: string
  operatorEmail: string | null
  reason: string
  decisionFingerprint: string
  suppressionCode: string
  enforcementFingerprint: string
  scope: CanonicalDecisionOperatorOverrideScope
  recordedAt: string
}

export type CanonicalCopilotMaterializationConsistency = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER
  allowedForReview: boolean
  blocked: boolean
  refreshRequired: boolean
  reason: string
  outcome: "allowed" | "refresh_required" | "blocked"
}

export type Growth5fPackageBuildMode = "production" | "preview_only"

export type CanonicalSequenceEnforcementTrustedGate = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER
  jobId: string
  leadId: string
  decisionFingerprint: string
  enforcementFingerprint: string
  channelLabel: string | null
  issuedAt: string
}
