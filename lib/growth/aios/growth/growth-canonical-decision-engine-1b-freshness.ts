/**
 * GE-AIOS-DECISION-ENGINE-1B — Decision freshness comparison (client-safe).
 */

import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type {
  GrowthCanonicalDecisionFreshness,
  GrowthCanonicalDecisionFreshnessState,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

function freshnessLabel(state: GrowthCanonicalDecisionFreshnessState): string {
  switch (state) {
    case "current":
      return "Current"
    case "strategy_changed":
      return "Strategy changed"
    case "package_needs_refresh":
      return "Package needs refresh"
    case "waiting_on_operator":
      return "Waiting on operator"
    case "waiting_on_prospect":
      return "Waiting on prospect"
    case "blocked_by_prerequisite":
      return "Blocked by prerequisite"
  }
}

export function computeGrowthCanonicalDecisionFreshness(input: {
  decision: GrowthCanonicalNextBestDecision
  packageSnapshot?: GrowthAutonomousOutreachApprovalPackage | null
  materialEventAt?: string | null
  strategyChangedSincePackage?: boolean
}): GrowthCanonicalDecisionFreshness {
  const pkg = input.packageSnapshot
  const packageGeneratedAt = pkg?.preparedAt ?? pkg?.salesStrategyBrief?.preparedAt ?? null
  const approvalAt =
    pkg?.packageApprovalDecision === "approved" ? pkg?.preparedAt ?? null : null
  const materialEventAt = input.materialEventAt ?? null
  const packageFingerprint = pkg?.packageId ?? null

  const strategyChangedSincePackage = Boolean(input.strategyChangedSincePackage)
  const stalePackageRelativeToDecision =
    strategyChangedSincePackage ||
    (Boolean(materialEventAt && packageGeneratedAt) &&
      Date.parse(materialEventAt!) > Date.parse(packageGeneratedAt!))

  let state: GrowthCanonicalDecisionFreshnessState = "current"
  if (input.decision.prerequisites.some((row) => row.blocksPrimary && row.status !== "complete")) {
    state = "blocked_by_prerequisite"
  } else if (input.decision.primaryAction === "wait") {
    state = "waiting_on_prospect"
  } else if (input.decision.operatorReviewRequired) {
    state = "waiting_on_operator"
  } else if (stalePackageRelativeToDecision) {
    state = strategyChangedSincePackage ? "strategy_changed" : "package_needs_refresh"
  }

  if (
    input.decision.operatorReviewRequired &&
    stalePackageRelativeToDecision &&
    state === "current"
  ) {
    state = "package_needs_refresh"
  }

  return {
    state,
    label: freshnessLabel(state),
    packageGeneratedAt,
    approvalAt,
    materialEventAt,
    decisionFingerprint: input.decision.decisionFingerprint,
    packageFingerprint,
    strategyChangedSincePackage,
    stalePackageRelativeToDecision,
  }
}

export function buildCanonicalDecisionSuppressionHints(
  decision: GrowthCanonicalNextBestDecision,
): import("@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types").GrowthCanonicalDecisionSuppressionHints {
  const suppressedActions = new Set(decision.suppressedActions.map((row) => row.action))
  const reasons = decision.suppressedActions.map((row) => row.reason).slice(0, 6)

  return {
    suppressColdOutreach:
      suppressedActions.has("contact") ||
      decision.primaryAction === "wait" ||
      decision.primaryAction === "pause" ||
      decision.primaryAction === "no_action" ||
      decision.primaryAction === "disqualify",
    suppressSequenceSends:
      decision.suppressedActions.some((row) => /sequence/i.test(row.title)) ||
      decision.primaryAction === "wait" ||
      decision.transportBlocked,
    suppressDuplicatePackage:
      decision.operatorReviewRequired ||
      Boolean(decision.sourceSummary.approvalStatus) ||
      decision.blockedBy.some((row) => row.source === "human_approval_center"),
    suppressTransport: decision.transportBlocked,
    reasons,
  }
}
