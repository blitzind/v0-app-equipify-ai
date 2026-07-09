/** GE-AIOS-19A — Decision Engine → first-person Operations Center explanations. */

import type { DecisionActionKind, DecisionEngineResult, NextBestAction } from "@/lib/growth/decision-engine/types"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { SalesOperationsCenterDecisionExplanation } from "@/lib/growth/operations-center/growth-sales-operations-center-types"

const REASON_NARRATIVE: Record<string, string> = {
  revenue_impact_high: "this path has the highest expected revenue impact right now",
  urgency_high: "timing matters — this is the most time-sensitive work available",
  qualification_complete: "qualification is complete, so outreach is the natural next step",
  ready_for_outreach: "the account is ready for outreach review",
  operator_approval_required: "I need your approval before I can continue",
  business_understanding_high: "your approved Growth Profile gives me enough context to proceed confidently",
  business_understanding_low: "I still need clearer business context before expanding outreach",
  company_expanding: "this company shows expansion signals worth prioritizing",
  no_blockers: "nothing is blocking this work right now",
  blocked_by_dependency: "another step must finish before this can proceed",
  default_priority: "this is the best available next step in today's plan",
}

function topNonWaitAction(decision: DecisionEngineResult): NextBestAction | null {
  return (
    decision.next_best_actions.find((row) => row.kind !== "wait") ??
    decision.top_action ??
    null
  )
}

function discoveryReason(snapshot: GrowthHomeMissionDiscoverySnapshot | null | undefined): string | null {
  if (!snapshot?.startupDiscoveryReady) return null
  const target = snapshot.audienceName?.trim() || snapshot.searchSummary?.trim()
  switch (snapshot.discoveryAction) {
    case "run_prospect_search":
      return target
        ? `Our pipeline is running low for ${target}, so I'm replenishing it before preparing additional outreach.`
        : "Our pipeline is running low, so I'm replenishing it before preparing additional outreach."
    case "refresh_audience":
      return target
        ? `Our ${target} audience is nearly exhausted, so I'm refreshing it to find more companies to research.`
        : "Our audience is nearly exhausted, so I'm refreshing it to find more companies to research."
    case "begin_research":
      return "We have newly discovered companies ready — I'm continuing research before preparing more outreach."
    case "monitoring":
      return "I'm monitoring our audience for new companies that match your Growth Profile."
    default:
      return null
  }
}

function actionKindHeadline(kind: DecisionActionKind, action: NextBestAction): string {
  if (/follow.?up|reply/i.test(action.title)) {
    return "I'm focusing on follow-up because existing conversations have a higher expected value than finding new prospects."
  }
  if (kind === "prepare_outreach" || kind === "review_approval") {
    return "I'm preparing outreach for your review because qualified opportunities are ready to move forward."
  }
  if (kind === "research_company" || kind === "continue_qualification") {
    return "I'm prioritizing research and qualification so we build a strong pipeline before expanding outreach."
  }
  if (kind === "continue_mission") {
    if (/discovery|prospect|audience|refresh/i.test(action.title)) {
      return discoveryReason(null) ?? "I'm continuing mission work to keep the pipeline healthy."
    }
    return "I'm continuing today's mission work because it keeps revenue momentum moving."
  }
  if (kind === "meeting_prep") {
    return "I'm preparing for upcoming meetings because scheduled conversations take priority over new discovery."
  }
  if (kind === "request_business_clarification" || kind === "refresh_bi") {
    return "I'm pausing expansion until we strengthen business understanding — that keeps outreach accurate."
  }
  return `I'm focusing on ${action.title.replace(/\.$/, "").toLowerCase()} because it is the highest-ranked next step.`
}

export function buildSalesOperationsCenterDecisionExplanation(input: {
  decisionResult: DecisionEngineResult
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
}): SalesOperationsCenterDecisionExplanation | null {
  const discovery = discoveryReason(input.missionDiscovery)
  const top = topNonWaitAction(input.decisionResult)

  if (discovery && (!top || top.id.startsWith("discovery:"))) {
    return {
      headline: discovery,
      supportingReasons: input.decisionResult.next_best_actions
        .filter((row) => row.id.startsWith("discovery:"))
        .flatMap((row) => row.reason.map((reason) => REASON_NARRATIVE[reason.code] ?? reason.label))
        .slice(0, 4),
      topActionTitle: top?.title ?? null,
    }
  }

  if (!top) return null

  const supportingReasons = top.reason
    .map((row) => REASON_NARRATIVE[row.code] ?? row.label)
    .filter(Boolean)
    .slice(0, 4)

  return {
    headline: actionKindHeadline(top.kind, top),
    supportingReasons,
    topActionTitle: top.title,
  }
}
