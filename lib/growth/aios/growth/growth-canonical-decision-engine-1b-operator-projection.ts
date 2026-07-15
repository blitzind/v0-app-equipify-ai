/**
 * GE-AIOS-DECISION-ENGINE-1B — Shared operator decision projection (client-safe).
 */

import { projectCanonicalDecisionOperatorCard } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-operator-card"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import type { GrowthCanonicalDecisionFreshness } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  humanizeOperatorBadgeLabel,
  humanizeOperatorDecisionTitle,
  humanizeOperatorFacingLine,
  stripInternalEngineTerms,
} from "@/lib/growth/aios/operator-experience/growth-operator-language-1a"

export const GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_OPERATOR_PROJECTION_QA_MARKER =
  "ge-aios-decision-engine-1b-operator-projection-v1" as const

function sanitizeOperatorCopy(value: string): string {
  return stripInternalEngineTerms(value.replace(/\u2014/g, "-").replace(/\s+/g, " ").trim())
}

export type GrowthCanonicalOperatorDecisionProjection = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_OPERATOR_PROJECTION_QA_MARKER
  headline: string
  primaryAction: string
  whatToDo: string
  why: string[]
  whenLabel: string
  whoActs: string
  whoInvolved: string | null
  prerequisites: string[]
  thenActions: string[]
  doNotActions: string[]
  confidenceLabel: string
  freshnessLabel: string | null
  operatorReviewRequired: boolean
  transportBlocked: boolean
  decisionFingerprint: string
}

export function projectGrowthCanonicalOperatorDecision(input: {
  decision: GrowthCanonicalNextBestDecision
  freshness?: GrowthCanonicalDecisionFreshness | null
}): GrowthCanonicalOperatorDecisionProjection {
  const card = projectCanonicalDecisionOperatorCard(input.decision)

  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_OPERATOR_PROJECTION_QA_MARKER,
    headline: "What I need from you",
    primaryAction: input.decision.primaryAction,
    whatToDo: sanitizeOperatorCopy(
      humanizeOperatorDecisionTitle(card.whatToDo, input.decision.primaryAction),
    ),
    why: card.why.map((line) => sanitizeOperatorCopy(humanizeOperatorFacingLine(line))),
    whenLabel: sanitizeOperatorCopy(card.whenLabel),
    whoActs: sanitizeOperatorCopy(card.whoActs),
    whoInvolved: card.whoInvolved ? sanitizeOperatorCopy(card.whoInvolved) : null,
    prerequisites: card.prerequisites.map(sanitizeOperatorCopy),
    thenActions: card.thenActions.map(sanitizeOperatorCopy),
    doNotActions: card.doNotActions.map(sanitizeOperatorCopy),
    confidenceLabel: sanitizeOperatorCopy(card.confidenceLabel),
    freshnessLabel: input.freshness?.label
      ? sanitizeOperatorCopy(humanizeOperatorBadgeLabel(input.freshness.label))
      : null,
    operatorReviewRequired: card.operatorReviewRequired,
    transportBlocked: card.transportBlocked,
    decisionFingerprint: input.decision.decisionFingerprint,
  }
}

export function projectCanonicalDecisionEssentials(input: {
  decision: GrowthCanonicalNextBestDecision
  freshness?: GrowthCanonicalDecisionFreshness | null
  packagePurpose?: string | null
  isSupportingPackage?: boolean
}): string[] {
  const projection = projectGrowthCanonicalOperatorDecision({
    decision: input.decision,
    freshness: input.freshness,
  })
  const lines = [
    projection.whatToDo,
    projection.why[0] ?? null,
    input.packagePurpose
      ? `Package purpose: ${sanitizeOperatorCopy(input.packagePurpose)}`
      : null,
    input.isSupportingPackage
      ? "Supporting action for the current decision"
      : "Primary action from canonical decision",
    projection.freshnessLabel ? `Freshness: ${projection.freshnessLabel}` : null,
    projection.prerequisites[0] ? `Prerequisite: ${projection.prerequisites[0]}` : null,
    projection.doNotActions[0] ? `Do not: ${projection.doNotActions[0]}` : null,
    projection.transportBlocked ? "Waiting for your approval before outreach" : null,
  ].filter(Boolean) as string[]

  return lines.slice(0, 8)
}

export function projectCanonicalDecisionToHomePrimary(
  input: {
    decision: GrowthCanonicalNextBestDecision
    freshness?: GrowthCanonicalDecisionFreshness | null
    href?: string | null
  },
): {
  id: string
  label: string
  detail: string | null
  href: string | null
  projection: GrowthCanonicalOperatorDecisionProjection
} {
  const projection = projectGrowthCanonicalOperatorDecision(input)
  const detailParts = [
    projection.why[0] ?? null,
    projection.whenLabel ? `When: ${projection.whenLabel}` : null,
    projection.whoActs ? `Actor: ${projection.whoActs}` : null,
    projection.whoInvolved ? `Involves: ${projection.whoInvolved}` : null,
    projection.prerequisites[0] ? `First: ${projection.prerequisites[0]}` : null,
    projection.doNotActions[0] ? `Do not: ${projection.doNotActions[0]}` : null,
    projection.confidenceLabel,
  ].filter(Boolean)

  return {
    id: input.decision.decisionId,
    label: projection.whatToDo,
    detail: detailParts.join(" · ") || null,
    href: input.href ?? null,
    projection,
  }
}
