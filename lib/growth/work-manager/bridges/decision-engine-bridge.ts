/** GE-AIOS-11A — Convert Decision Engine output to canonical work items (no re-scoring). */

import type { GrowthCanonicalOpportunityAuthorityMap } from "@/lib/growth/aios/authority/growth-canonical-opportunity-authority-types-1b"
import {
  applyCanonicalAuthorityToNextBestAction,
  applyCanonicalAuthorityToWorkItem,
} from "@/lib/growth/work-manager/bridges/canonical-authority-work-manager-bridge-1b"
import type { DecisionActionKind, NextBestAction } from "@/lib/growth/decision-engine/types"
import type { AvaWorkItem, AvaWorkItemType } from "@/lib/growth/work-manager/types"

const KIND_TO_TYPE: Record<DecisionActionKind, AvaWorkItemType> = {
  research_company: "research",
  continue_qualification: "qualification",
  prepare_outreach: "outreach",
  review_approval: "approval",
  review_reply: "reply",
  meeting_prep: "meeting",
  continue_mission: "mission",
  request_business_clarification: "business_understanding",
  refresh_bi: "business_understanding",
  wait: "wait",
}

export function mapDecisionKindToWorkItemType(kind: DecisionActionKind): AvaWorkItemType {
  return KIND_TO_TYPE[kind] ?? "mission"
}

export function nextBestActionToWorkItem(
  action: NextBestAction,
  timestamp: string,
  authorityByLeadId?: GrowthCanonicalOpportunityAuthorityMap | null,
): AvaWorkItem {
  const boundAction = applyCanonicalAuthorityToNextBestAction(action, authorityByLeadId)
  const blocked = boundAction.blocked_by.length > 0
  const requiresOperator = boundAction.requires_operator || boundAction.kind === "review_approval"
  const requiresLeadTarget = boundAction.kind === "research_company" && !boundAction.href?.trim()
  const canExecuteAutonomously =
    !requiresOperator &&
    !blocked &&
    !requiresLeadTarget &&
    boundAction.kind !== "wait" &&
    boundAction.kind !== "review_reply"

  const item: AvaWorkItem = {
    id: `work:${boundAction.id}`,
    type: mapDecisionKindToWorkItemType(boundAction.kind),
    title: boundAction.title,
    description: boundAction.reason.map((row) => row.label).join(" · ") || null,
    status: "planned",
    priority: boundAction.overall_score,
    source: "decision_engine",
    created_at: timestamp,
    updated_at: timestamp,
    estimated_minutes: boundAction.estimated_time_minutes,
    estimated_revenue_impact: boundAction.score_breakdown.revenue_impact,
    requires_operator: requiresOperator,
    can_execute_autonomously: canExecuteAutonomously,
    depends_on: boundAction.depends_on,
    blocked_by: boundAction.blocked_by,
    next_action: boundAction.reason[0]?.label ?? null,
    decision_score: boundAction.overall_score,
    confidence: boundAction.confidence,
    href: boundAction.href,
    company_name: boundAction.company_name,
    decision_source_id: boundAction.source_id,
    relationship_graph: boundAction.relationship_graph ?? null,
  }

  return applyCanonicalAuthorityToWorkItem(item, authorityByLeadId)
}

export function nextBestActionsToWorkItems(
  actions: NextBestAction[],
  timestamp: string,
  authorityByLeadId?: GrowthCanonicalOpportunityAuthorityMap | null,
): AvaWorkItem[] {
  return actions.map((action) => nextBestActionToWorkItem(action, timestamp, authorityByLeadId))
}
