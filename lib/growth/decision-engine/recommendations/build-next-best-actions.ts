/** GE-AIOS-10B — Structured explainability for every recommendation. */

import type {
  DecisionCandidate,
  DecisionContext,
  DecisionExplainReason,
  DecisionScoreBreakdown,
  NextBestAction,
} from "@/lib/growth/decision-engine/types"

export function buildNextBestActionReasons(
  candidate: DecisionCandidate,
  context: DecisionContext,
  breakdown: DecisionScoreBreakdown,
): DecisionExplainReason[] {
  const reasons: DecisionExplainReason[] = []

  if (candidate.qualificationComplete) {
    reasons.push({ code: "qualification_complete", label: "Qualification complete" })
  }
  if (context.businessUnderstanding.hasApprovedProfile) {
    reasons.push({ code: "business_understanding_high", label: "Business understanding high" })
  } else if (context.businessUnderstanding.profileIncomplete) {
    reasons.push({ code: "business_understanding_low", label: "Business understanding incomplete" })
  }
  if (candidate.hotCompany) {
    reasons.push({ code: "company_expanding", label: "Company expanding" })
  }
  if ((candidate.blockedBy?.length ?? 0) === 0 && !candidate.blocked) {
    reasons.push({ code: "no_blockers", label: "No blockers" })
  }
  if (breakdown.revenue_impact >= 80) {
    reasons.push({ code: "revenue_impact_high", label: "Revenue impact high" })
  }
  if (candidate.requiresHumanApproval || candidate.kind === "review_approval") {
    reasons.push({ code: "operator_approval_required", label: "Operator approval required" })
  }
  if (candidate.readyForOutreach) {
    reasons.push({ code: "ready_for_outreach", label: "Ready for outreach" })
  }
  if (breakdown.urgency >= 80) {
    reasons.push({ code: "urgency_high", label: "Urgency high" })
  }
  if ((candidate.blockedBy?.length ?? 0) > 0) {
    reasons.push({ code: "blocked_by_dependency", label: "Blocked by dependency" })
  }

  if (reasons.length === 0) {
    reasons.push({ code: "default_priority", label: "Best available next step" })
  }

  return reasons.slice(0, 6)
}

export function buildNextBestActions(
  candidates: DecisionCandidate[],
  context: DecisionContext,
  ranked: NextBestAction[],
): NextBestAction[] {
  return ranked.slice(0, 12)
}

export function selectTopOperatorAction(actions: NextBestAction[]): NextBestAction | null {
  const operatorActions = actions.filter((action) => action.requires_operator && action.kind !== "wait")
  return operatorActions[0] ?? actions.find((action) => action.kind !== "wait") ?? null
}
