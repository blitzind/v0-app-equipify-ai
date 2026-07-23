/** GE-AIOS-11A — Ava Work Manager types (client-safe). */

export const GROWTH_WORK_MANAGER_QA_MARKER = "ge-aios-11a-work-manager-v1" as const

export type AvaWorkItemStatus =
  | "planned"
  | "ready"
  | "working"
  | "blocked"
  | "waiting_for_operator"
  | "waiting_for_customer"
  | "completed"
  | "cancelled"
  | "deferred"

export type AvaWorkItemType =
  | "research"
  | "qualification"
  | "outreach"
  | "approval"
  | "reply"
  | "meeting"
  | "mission"
  | "business_understanding"
  | "wait"

export type AvaWorkItemSource =
  | "decision_engine"
  | "accomplishment"
  | "interruption"
  | "operator_queue"

export type AvaWorkItem = {
  id: string
  type: AvaWorkItemType
  title: string
  description: string | null
  status: AvaWorkItemStatus
  priority: number
  source: AvaWorkItemSource
  created_at: string
  updated_at: string
  estimated_minutes: number | null
  estimated_revenue_impact: number | null
  requires_operator: boolean
  can_execute_autonomously: boolean
  depends_on: string[]
  blocked_by: string[]
  next_action: string | null
  decision_score: number
  confidence: number
  href: string | null
  company_name: string | null
  decision_source_id: string
  assigned_specialist?: import("@/lib/growth/specialists/types").AvaSpecialistId | null
  specialist_confidence?: number | null
  routing_reason?: string | null
  relationship_graph?: import("@/lib/growth/relationship/relationship-graph-types").AvaRelationshipGraphContext | null
  /** AVA-GROWTH-OPERATOR-1B — bound to canonical decision when present. */
  canonical_decision_fingerprint?: string | null
  canonical_authority_owner?: import("@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types").GrowthCanonicalDecisionActor | null
  authority_bound?: boolean
}

export type AvaWorkPlanEntry = {
  position: number
  work_item_id: string
  title: string
  status: AvaWorkItemStatus
}

export type AvaWorkInterruption = {
  id: string
  inserted_work_item_id: string
  paused_work_item_id: string | null
  reason_code: string
  reason_label: string
}

export type AvaWorkManagerResult = {
  qaMarker: typeof GROWTH_WORK_MANAGER_QA_MARKER
  active_work: AvaWorkItem | null
  work_plan: AvaWorkPlanEntry[]
  blocked: AvaWorkItem[]
  completed_today: AvaWorkItem[]
  deferred: AvaWorkItem[]
  interruptions: AvaWorkInterruption[]
  operator_queue: AvaWorkItem[]
  all_work_items: AvaWorkItem[]
  specialist_orchestrator_qa_marker?: string | null
  specialist_orchestrator_result?: import("@/lib/growth/specialists/types").AvaSpecialistOrchestratorResult | null
}
