/**
 * GE-AIOS-DECISION-ENGINE-1B — Canonical decision convergence types (client-safe).
 */

import type { GrowthCanonicalDecisionOperatorCard } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-operator-card"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

export const GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER =
  "ge-aios-decision-engine-1b-v1" as const

export const GROWTH_CANONICAL_DECISION_FRESHNESS_STATES = [
  "current",
  "strategy_changed",
  "package_needs_refresh",
  "waiting_on_operator",
  "waiting_on_prospect",
  "blocked_by_prerequisite",
] as const

export type GrowthCanonicalDecisionFreshnessState =
  (typeof GROWTH_CANONICAL_DECISION_FRESHNESS_STATES)[number]

export type GrowthCanonicalDecisionFreshness = {
  state: GrowthCanonicalDecisionFreshnessState
  label: string
  packageGeneratedAt: string | null
  approvalAt: string | null
  materialEventAt: string | null
  decisionFingerprint: string
  packageFingerprint: string | null
  strategyChangedSincePackage: boolean
  stalePackageRelativeToDecision: boolean
}

export type GrowthCanonicalDecisionSuppressionHints = {
  suppressColdOutreach: boolean
  suppressSequenceSends: boolean
  suppressDuplicatePackage: boolean
  suppressTransport: boolean
  reasons: string[]
}

export type GrowthCanonicalDecisionResolution = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER
  organizationId: string
  leadId: string
  generatedAt: string
  companyName: string | null
  decision: GrowthCanonicalNextBestDecision
  operatorCard: GrowthCanonicalDecisionOperatorCard
  freshness: GrowthCanonicalDecisionFreshness
  suppressionHints: GrowthCanonicalDecisionSuppressionHints
  inputDegraded: string[]
}
