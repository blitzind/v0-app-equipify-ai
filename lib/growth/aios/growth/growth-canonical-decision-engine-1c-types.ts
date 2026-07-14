/**
 * GE-AIOS-DECISION-ENGINE-1C — Runtime decision enforcement types (client-safe).
 */

export const GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER =
  "ge-aios-decision-engine-1c-v1" as const

export const GROWTH_CANONICAL_PACKAGE_PREPARATION_OUTCOMES = [
  "decision_allowed",
  "decision_blocked_competing_package",
  "decision_blocked_waiting_on_operator",
  "decision_blocked_waiting_on_prospect",
  "decision_blocked_relationship_protection",
  "decision_blocked_lead_lifecycle",
  "decision_refresh_required",
] as const

export type GrowthCanonicalPackagePreparationOutcome =
  (typeof GROWTH_CANONICAL_PACKAGE_PREPARATION_OUTCOMES)[number]

export const GROWTH_CANONICAL_SEQUENCE_SUPPRESSION_OUTCOMES = [
  "canonical_decision_suppressed",
  "canonical_decision_wait_until",
  "canonical_decision_pending_approval",
  "canonical_decision_relationship_protection",
  "canonical_decision_lifecycle_blocked",
] as const

export type GrowthCanonicalSequenceSuppressionOutcome =
  (typeof GROWTH_CANONICAL_SEQUENCE_SUPPRESSION_OUTCOMES)[number]

export const GROWTH_CANONICAL_TRANSPORT_BOUNDARY_OUTCOMES = [
  "transport_allowed",
  "transport_blocked_stale_package",
  "transport_blocked_strategy_changed",
  "transport_blocked_waiting_on_prospect",
  "transport_blocked_waiting_on_operator",
  "transport_blocked_lifecycle",
  "transport_blocked_canonical_suppression",
] as const

export type GrowthCanonicalTransportBoundaryOutcome =
  (typeof GROWTH_CANONICAL_TRANSPORT_BOUNDARY_OUTCOMES)[number]

export const GROWTH_CANONICAL_HAC_ENFORCEMENT_STATUSES = [
  "allowed_to_proceed",
  "waiting_on_operator",
  "waiting_on_prospect",
  "strategy_changed",
  "competing_action_suppressed",
  "package_refresh_required",
  "lead_no_longer_eligible",
] as const

export type GrowthCanonicalHacEnforcementStatus =
  (typeof GROWTH_CANONICAL_HAC_ENFORCEMENT_STATUSES)[number]

export type GrowthCanonicalPackagePreparationContext = {
  proposedPurpose?: string | null
  wakeCondition?: string | null
  isOperatorRebuild?: boolean
  isMaterialRefresh?: boolean
}

export type GrowthCanonicalPackagePreparationEnforcement = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER
  allowed: boolean
  outcome: GrowthCanonicalPackagePreparationOutcome
  reason: string
  waitUntil: string | null
  enforcementFingerprint: string
  nextEligibleWakeAt: string | null
}

export type GrowthCanonicalSequenceStepEnforcement = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER
  allowed: boolean
  outcome: GrowthCanonicalSequenceSuppressionOutcome
  reason: string
  waitUntil: string | null
  enforcementFingerprint: string
  isColdOutreachStep?: boolean
}

export type GrowthCanonicalTransportBoundaryEnforcement = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER
  allowed: boolean
  outcome: GrowthCanonicalTransportBoundaryOutcome
  reason: string
  requiresPackageRefresh: boolean
  enforcementFingerprint: string
}

export type GrowthCanonicalDraftFactoryDecisionGate = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER
  allowGeneration: boolean
  outcome: GrowthCanonicalPackagePreparationOutcome
  reason: string
  waitUntil: string | null
  nextEligibleWakeAt: string | null
  enforcementFingerprint: string
}

export type GrowthCanonicalHacEnforcementProjection = {
  status: GrowthCanonicalHacEnforcementStatus
  label: string
  summary: string
  recommendation: string
  essentials: string[]
}
