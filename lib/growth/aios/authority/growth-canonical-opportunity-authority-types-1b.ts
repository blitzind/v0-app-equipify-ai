/**
 * AVA-GROWTH-OPERATOR-1B — Canonical opportunity authority types (client-safe).
 * One opportunity → one authoritative decision contract.
 */

import type {
  GrowthCanonicalDecisionActor,
  GrowthCanonicalPrimaryAction,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

export const GROWTH_AIOS_GROWTH_OPERATOR_1B_QA_MARKER =
  "ava-growth-operator-1b-canonical-opportunity-authority-v1" as const

export const GROWTH_CANONICAL_OPPORTUNITY_AUTHORITY_RULE =
  "Canonical Decision Engine 1A is the sole per-opportunity execution authority — all subsystems consume this decision for ownership, escalation, and autonomous eligibility." as const

export const GROWTH_CANONICAL_OPPORTUNITY_STAGES = [
  "discovery",
  "research",
  "qualification",
  "planning",
  "preparation",
  "approval",
  "execution",
  "conversation",
  "meeting",
  "monitoring",
  "closed",
  "blocked",
] as const

export type GrowthCanonicalOpportunityStage = (typeof GROWTH_CANONICAL_OPPORTUNITY_STAGES)[number]

export const GROWTH_CANONICAL_ESCALATION_STATUSES = [
  "none",
  "advisory",
  "operator_required",
  "blocked",
] as const

export type GrowthCanonicalEscalationStatus = (typeof GROWTH_CANONICAL_ESCALATION_STATUSES)[number]

export const GROWTH_CANONICAL_EXECUTION_STATES = [
  "autonomous_eligible",
  "operator_required",
  "deferred",
  "blocked",
  "terminal",
] as const

export type GrowthCanonicalExecutionState = (typeof GROWTH_CANONICAL_EXECUTION_STATES)[number]

export type GrowthCanonicalOpportunityAuthority = {
  qaMarker: typeof GROWTH_AIOS_GROWTH_OPERATOR_1B_QA_MARKER
  organizationId: string
  leadId: string
  companyName: string | null
  decisionFingerprint: string
  generatedAt: string
  owner: GrowthCanonicalDecisionActor
  currentStage: GrowthCanonicalOpportunityStage
  nextAction: GrowthCanonicalPrimaryAction
  nextActionTitle: string
  autonomousEligible: boolean
  escalationStatus: GrowthCanonicalEscalationStatus
  executionState: GrowthCanonicalExecutionState
  operatorReviewRequired: boolean
  transportBlocked: boolean
  authoritySource: "canonical_decision_engine_1a"
}

export type GrowthCanonicalOpportunityAuthorityMap = Record<string, GrowthCanonicalOpportunityAuthority>

export type GrowthCanonicalAuthorityBinding = {
  decisionFingerprint: string
  owner: GrowthCanonicalDecisionActor
  nextAction: GrowthCanonicalPrimaryAction
  escalationStatus: GrowthCanonicalEscalationStatus
  executionState: GrowthCanonicalExecutionState
  authoritative: true
}
