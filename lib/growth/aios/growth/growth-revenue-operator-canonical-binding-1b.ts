/**
 * AVA-GROWTH-OPERATOR-1B — Bind Revenue Operator orchestration to canonical authority.
 * Revenue Operator supervises agent handoffs; canonical 1A owns per-opportunity decisions.
 */

import type { GrowthCanonicalOpportunityAuthority } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import type {
  RevenueOperatorOrchestrationEngineResult,
  RevenueOperatorOrchestrationRecord,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"

export const GROWTH_REVENUE_OPERATOR_CANONICAL_BINDING_1B_QA_MARKER =
  "ava-growth-operator-1b-revenue-operator-canonical-binding-v1" as const

export const GROWTH_REVENUE_OPERATOR_CANONICAL_DEFERRAL_RULE =
  "Revenue Operator orchestrates agent handoffs and monitors gates — per-opportunity next action, ownership, and escalation defer to Canonical Decision Engine 1A when bound." as const

export function bindRevenueOperatorOrchestrationToCanonicalAuthority(input: {
  result: RevenueOperatorOrchestrationEngineResult
  canonicalAuthority?: GrowthCanonicalOpportunityAuthority | null
}): RevenueOperatorOrchestrationEngineResult {
  const authority = input.canonicalAuthority
  if (!authority) return input.result

  const record: RevenueOperatorOrchestrationRecord = {
    ...input.result.record,
    recommendedNextAction: authority.nextActionTitle,
    canonicalAuthorityBinding: {
      decisionFingerprint: authority.decisionFingerprint,
      owner: authority.owner,
      nextAction: authority.nextAction,
      escalationStatus: authority.escalationStatus,
      executionState: authority.executionState,
      authoritative: true,
    },
    reasoning: `${input.result.record.reasoning} Canonical authority (${authority.decisionFingerprint}) defers next action to ${authority.nextActionTitle}.`,
  }

  return {
    record,
    planContext: {
      ...input.result.planContext,
      orchestrationReasoning: record.reasoning,
      handoffSummary: authority.autonomousEligible
        ? `Supervising ${record.owningAgent.replace(/_agent$/, "")} — Ava owns execution until escalation.`
        : input.result.planContext.handoffSummary,
    },
  }
}
