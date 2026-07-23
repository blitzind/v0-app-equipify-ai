/**
 * AVA-GROWTH-OPERATOR-1B — Bind Work Manager items to canonical opportunity authority.
 * Work Manager schedules work; canonical authority owns ownership and escalation.
 */

import {
  resolveCanonicalAuthorityForLead,
  resolveCanonicalAuthorityRequiresOperator,
  type GrowthCanonicalOpportunityAuthorityMap,
} from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-1b"
import {
  evaluateCanonicalEscalation,
} from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-1c"
import type { NextBestAction } from "@/lib/growth/decision-engine/types"
import {
  parseLeadIdFromHref,
  parseLeadIdFromSourceId,
} from "@/lib/growth/relationship/parse-relationship-graph-refs"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export const GROWTH_WORK_MANAGER_CANONICAL_AUTHORITY_BRIDGE_1B_QA_MARKER =
  "ava-growth-operator-1b-work-manager-canonical-bridge-v1" as const

function resolveWorkItemLeadId(item: Pick<AvaWorkItem, "href" | "decision_source_id">): string | null {
  return parseLeadIdFromHref(item.href) ?? parseLeadIdFromSourceId(item.decision_source_id)
}

export function applyCanonicalAuthorityToNextBestAction(
  action: NextBestAction,
  authorityByLeadId: GrowthCanonicalOpportunityAuthorityMap | null | undefined,
): NextBestAction {
  const leadId = parseLeadIdFromHref(action.href) ?? parseLeadIdFromSourceId(action.source_id)
  const authority = resolveCanonicalAuthorityForLead(authorityByLeadId, leadId)
  if (!authority) return action

  const escalation = evaluateCanonicalEscalation({
    requestKind: action.kind === "review_approval" ? "outbound_send_ready" : "prepare_outreach",
    leadId,
    opportunityAuthority: authority,
    signals: {
      sendReady: action.kind === "review_approval",
      preparationComplete: action.kind === "prepare_outreach",
    },
  })

  const requiresOperator =
    escalation.interruptOperator &&
    (escalation.operatorApprovalRequired || action.kind === "review_approval")
  const preparationKinds = new Set(["prepare_outreach", "research_company", "continue_qualification"])
  const blocked =
    authority.executionState === "blocked" ||
    authority.executionState === "terminal" ||
    (authority.executionState === "deferred" && action.kind === "prepare_outreach")

  return {
    ...action,
    requires_operator: requiresOperator || action.kind === "review_approval",
    blocked_by: blocked
      ? [...action.blocked_by, "canonical_authority_deferred"]
      : action.blocked_by.filter((row) => row !== "operator_approval"),
    title: authority.nextActionTitle || action.title,
  }
}

export function applyCanonicalAuthorityToWorkItem(
  item: AvaWorkItem,
  authorityByLeadId: GrowthCanonicalOpportunityAuthorityMap | null | undefined,
): AvaWorkItem {
  const leadId = resolveWorkItemLeadId(item)
  const authority = resolveCanonicalAuthorityForLead(authorityByLeadId, leadId)
  if (!authority) return item

  const escalation = evaluateCanonicalEscalation({
    requestKind: item.type === "approval" ? "outbound_send_ready" : "prepare_outreach",
    leadId,
    opportunityAuthority: authority,
    signals: {
      sendReady: item.type === "approval",
      preparationComplete: item.type === "outreach" || item.type === "research",
    },
  })

  const requiresOperator =
    escalation.interruptOperator &&
    (escalation.operatorApprovalRequired || item.type === "approval")
  const blocked =
    authority.executionState === "blocked" ||
    authority.executionState === "terminal" ||
    (authority.executionState === "deferred" && item.type === "outreach")

  const canExecuteAutonomously =
    authority.autonomousEligible &&
    !requiresOperator &&
    !blocked &&
    item.type !== "approval" &&
    item.type !== "reply" &&
    item.type !== "wait"

  return {
    ...item,
    requires_operator: requiresOperator || item.type === "approval",
    can_execute_autonomously: canExecuteAutonomously,
    blocked_by: blocked
      ? [...item.blocked_by.filter((row) => row !== "operator_approval"), "canonical_authority_state"]
      : item.blocked_by.filter((row) => row !== "operator_approval"),
    next_action: authority.nextActionTitle || item.next_action,
    title: authority.nextActionTitle || item.title,
    canonical_decision_fingerprint: authority.decisionFingerprint,
    canonical_authority_owner: authority.owner,
    authority_bound: true,
  }
}

export function applyCanonicalAuthorityToWorkItems(
  items: AvaWorkItem[],
  authorityByLeadId: GrowthCanonicalOpportunityAuthorityMap | null | undefined,
): AvaWorkItem[] {
  return items.map((item) => applyCanonicalAuthorityToWorkItem(item, authorityByLeadId))
}

export function detectCanonicalAuthorityConflicts(
  items: AvaWorkItem[],
  authorityByLeadId: GrowthCanonicalOpportunityAuthorityMap | null | undefined,
): Array<{ leadId: string; workItemId: string; conflict: string }> {
  const conflicts: Array<{ leadId: string; workItemId: string; conflict: string }> = []
  for (const item of items) {
    const leadId = resolveWorkItemLeadId(item)
    const authority = resolveCanonicalAuthorityForLead(authorityByLeadId, leadId)
    if (!authority) continue

    if (item.requires_operator && authority.autonomousEligible && item.type === "outreach") {
      conflicts.push({
        leadId,
        workItemId: item.id,
        conflict: "work_manager_requires_operator_but_canonical_autonomous_eligible",
      })
    }
    if (item.can_execute_autonomously && resolveCanonicalAuthorityRequiresOperator(authority)) {
      conflicts.push({
        leadId,
        workItemId: item.id,
        conflict: "work_manager_autonomous_but_canonical_requires_operator",
      })
    }
  }
  return conflicts
}
