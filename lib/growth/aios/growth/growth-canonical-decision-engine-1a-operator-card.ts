/**
 * GE-AIOS-DECISION-ENGINE-1A — Operator decision card projection (client-safe).
 */

import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

export const GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_OPERATOR_LAYOUT_QA_MARKER =
  "ge-aios-decision-engine-1a-operator-card-layout-v1" as const

export type GrowthCanonicalDecisionOperatorCard = {
  qaMarker: typeof GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_OPERATOR_LAYOUT_QA_MARKER
  headline: string
  whatToDo: string
  why: string[]
  whenLabel: string
  whoActs: string
  whoInvolved: string | null
  prerequisites: string[]
  thenActions: string[]
  doNotActions: string[]
  confidenceLabel: string
  operatorReviewRequired: boolean
  transportBlocked: boolean
}

function urgencyLabel(urgency: GrowthCanonicalNextBestDecision["urgency"]): string {
  switch (urgency) {
    case "immediate":
      return "Immediately"
    case "today":
      return "Today"
    case "this_week":
      return "This week"
    case "scheduled":
      return "On schedule"
    default:
      return "When appropriate"
  }
}

function actorLabel(actor: GrowthCanonicalNextBestDecision["recommendedActor"]): string {
  switch (actor) {
    case "ava":
      return "Ava"
    case "operator":
      return "You"
    case "sales_specialist":
      return "Sales specialist"
    default:
      return "System"
  }
}

export function projectCanonicalDecisionOperatorCard(
  decision: GrowthCanonicalNextBestDecision,
): GrowthCanonicalDecisionOperatorCard {
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_OPERATOR_LAYOUT_QA_MARKER,
    headline: "Ava's recommendation",
    whatToDo: decision.title,
    why: decision.rationale,
    whenLabel: decision.waitUntil
      ? `After ${decision.waitUntil}`
      : urgencyLabel(decision.urgency),
    whoActs: actorLabel(decision.recommendedActor),
    whoInvolved: decision.targetRole ?? null,
    prerequisites: decision.prerequisites
      .filter((row) => row.status !== "complete")
      .map((row) => row.label),
    thenActions: decision.supportingActions.map((row) => row.title),
    doNotActions: decision.suppressedActions.map((row) => row.title),
    confidenceLabel: `${decision.confidence}% confidence`,
    operatorReviewRequired: decision.operatorReviewRequired,
    transportBlocked: decision.transportBlocked,
  }
}

export function projectCanonicalDecisionToHomePrimary(decision: GrowthCanonicalNextBestDecision): {
  id: string
  label: string
  detail: string | null
  href: string | null
} {
  return {
    id: decision.decisionId,
    label: decision.title,
    detail: decision.rationale.join(" · ") || null,
    href: null,
  }
}
