/** GE-AIOS-11A — Convert Decision Engine output to canonical work items (no re-scoring). */

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

export function nextBestActionToWorkItem(action: NextBestAction, timestamp: string): AvaWorkItem {
  const blocked = action.blocked_by.length > 0
  const requiresOperator = action.requires_operator || action.kind === "review_approval"
  const canExecuteAutonomously =
    !requiresOperator && !blocked && action.kind !== "wait" && action.kind !== "review_reply"

  return {
    id: `work:${action.id}`,
    type: mapDecisionKindToWorkItemType(action.kind),
    title: action.title,
    description: action.reason.map((row) => row.label).join(" · ") || null,
    status: "planned",
    priority: action.overall_score,
    source: "decision_engine",
    created_at: timestamp,
    updated_at: timestamp,
    estimated_minutes: action.estimated_time_minutes,
    estimated_revenue_impact: action.score_breakdown.revenue_impact,
    requires_operator: requiresOperator,
    can_execute_autonomously: canExecuteAutonomously,
    depends_on: action.depends_on,
    blocked_by: action.blocked_by,
    next_action: action.reason[0]?.label ?? null,
    decision_score: action.overall_score,
    confidence: action.confidence,
    href: action.href,
    company_name: action.company_name,
    decision_source_id: action.source_id,
    relationship_graph: action.relationship_graph ?? null,
  }
}

export function nextBestActionsToWorkItems(actions: NextBestAction[], timestamp: string): AvaWorkItem[] {
  return actions.map((action) => nextBestActionToWorkItem(action, timestamp))
}
