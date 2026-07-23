/**
 * AVA-GROWTH-OPERATOR-1B — Build canonical opportunity authority from Decision Engine 1A.
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import {
  GROWTH_AIOS_GROWTH_OPERATOR_1B_QA_MARKER,
  type GrowthCanonicalEscalationStatus,
  type GrowthCanonicalExecutionState,
  type GrowthCanonicalOpportunityAuthority,
  type GrowthCanonicalOpportunityAuthorityMap,
  type GrowthCanonicalOpportunityStage,
} from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"

export {
  GROWTH_AIOS_GROWTH_OPERATOR_1B_QA_MARKER,
  GROWTH_CANONICAL_OPPORTUNITY_AUTHORITY_RULE,
} from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
export type {
  GrowthCanonicalAuthorityBinding,
  GrowthCanonicalEscalationStatus,
  GrowthCanonicalExecutionState,
  GrowthCanonicalOpportunityAuthority,
  GrowthCanonicalOpportunityAuthorityMap,
  GrowthCanonicalOpportunityStage,
} from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"

function resolveOpportunityStage(decision: GrowthCanonicalNextBestDecision): GrowthCanonicalOpportunityStage {
  switch (decision.primaryAction) {
    case "research":
      return "research"
    case "contact":
    case "send_promised_information":
      return decision.operatorReviewRequired || decision.transportBlocked ? "approval" : "preparation"
    case "reply":
      return "conversation"
    case "schedule_meeting":
    case "prepare_meeting":
      return "meeting"
    case "prepare_pricing":
    case "prepare_proposal":
    case "request_introduction":
    case "multi_thread":
      return "planning"
    case "wait":
    case "pause":
      return "monitoring"
    case "disqualify":
    case "no_action":
      return "closed"
    default:
      return decision.blockedBy.some((row) => row.severity === "hard") ? "blocked" : "execution"
  }
}

function resolveEscalationStatus(decision: GrowthCanonicalNextBestDecision): GrowthCanonicalEscalationStatus {
  if (decision.blockedBy.some((row) => row.severity === "hard")) return "blocked"
  if (decision.operatorReviewRequired || decision.recommendedActor === "operator") {
    return "operator_required"
  }
  if (decision.recommendedActor === "sales_specialist") return "advisory"
  return "none"
}

function resolveExecutionState(
  decision: GrowthCanonicalNextBestDecision,
  escalationStatus: GrowthCanonicalEscalationStatus,
): GrowthCanonicalExecutionState {
  if (decision.primaryAction === "disqualify" || decision.primaryAction === "no_action") {
    return "terminal"
  }
  if (escalationStatus === "blocked") return "blocked"
  if (escalationStatus === "operator_required") return "operator_required"
  if (decision.primaryAction === "wait" || decision.primaryAction === "pause") return "deferred"
  if (decision.recommendedActor === "ava" || decision.recommendedActor === "system") {
    if (decision.operatorReviewRequired) return "operator_required"
    return "autonomous_eligible"
  }
  return "deferred"
}

function resolveAutonomousEligible(
  decision: GrowthCanonicalNextBestDecision,
  executionState: GrowthCanonicalExecutionState,
): boolean {
  if (executionState !== "autonomous_eligible") return false
  if (decision.recommendedActor !== "ava" && decision.recommendedActor !== "system") return false
  if (decision.primaryAction === "disqualify" || decision.primaryAction === "no_action") return false
  return true
}

export function buildCanonicalOpportunityAuthorityFromResolution(
  resolution: GrowthCanonicalDecisionResolution,
): GrowthCanonicalOpportunityAuthority {
  const { decision } = resolution
  const escalationStatus = resolveEscalationStatus(decision)
  const executionState = resolveExecutionState(decision, escalationStatus)

  return {
    qaMarker: GROWTH_AIOS_GROWTH_OPERATOR_1B_QA_MARKER,
    organizationId: resolution.organizationId,
    leadId: resolution.leadId,
    companyName: resolution.companyName,
    decisionFingerprint: decision.decisionFingerprint,
    generatedAt: resolution.generatedAt,
    owner: decision.recommendedActor,
    currentStage: resolveOpportunityStage(decision),
    nextAction: decision.primaryAction,
    nextActionTitle: decision.title,
    autonomousEligible: resolveAutonomousEligible(decision, executionState),
    escalationStatus,
    executionState,
    operatorReviewRequired: decision.operatorReviewRequired,
    transportBlocked: decision.transportBlocked,
    authoritySource: "canonical_decision_engine_1a",
  }
}

export function buildCanonicalOpportunityAuthorityMap(
  resolutions: Array<GrowthCanonicalDecisionResolution | null | undefined>,
): GrowthCanonicalOpportunityAuthorityMap {
  const map: GrowthCanonicalOpportunityAuthorityMap = {}
  for (const resolution of resolutions) {
    if (!resolution?.leadId) continue
    map[resolution.leadId] = buildCanonicalOpportunityAuthorityFromResolution(resolution)
  }
  return map
}

export function resolveCanonicalAuthorityRequiresOperator(
  authority: GrowthCanonicalOpportunityAuthority,
): boolean {
  return (
    authority.escalationStatus === "operator_required" ||
    authority.owner === "operator" ||
    authority.executionState === "operator_required"
  )
}

export function resolveCanonicalAuthorityForLead(
  authorityByLeadId: GrowthCanonicalOpportunityAuthorityMap | null | undefined,
  leadId: string | null | undefined,
): GrowthCanonicalOpportunityAuthority | null {
  if (!authorityByLeadId || !leadId) return null
  return authorityByLeadId[leadId] ?? null
}
