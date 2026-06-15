/** Phase GS-3E — Human Intervention Engine types (client-safe). */

export const HUMAN_INTERVENTION_QA_MARKER = "growth-human-interventions-gs3e-v1" as const

export const HUMAN_INTERVENTION_CONFIRM = "RUN_HUMAN_INTERVENTIONS_CERTIFICATION" as const

export const HUMAN_INTERVENTION_TYPES = [
  "reply_required",
  "campaign_blocked",
  "approval_required",
  "channel_issue",
  "high_intent",
  "risk_detected",
  "opportunity",
  "manual_review",
] as const

export type HumanInterventionType = (typeof HUMAN_INTERVENTION_TYPES)[number]

export const HUMAN_INTERVENTION_PRIORITIES = ["low", "medium", "high", "urgent"] as const
export type HumanInterventionPriority = (typeof HUMAN_INTERVENTION_PRIORITIES)[number]

export const HUMAN_INTERVENTION_TYPE_LABELS: Record<HumanInterventionType, string> = {
  reply_required: "Reply required",
  campaign_blocked: "Campaign blocked",
  approval_required: "Approval required",
  channel_issue: "Channel issue",
  high_intent: "High intent",
  risk_detected: "Risk detected",
  opportunity: "Opportunity",
  manual_review: "Manual review",
}

export const HUMAN_INTERVENTION_FILTERS = [
  "all",
  "urgent",
  "replies",
  "approvals",
  "risks",
  "opportunities",
] as const

export type HumanInterventionFilter = (typeof HUMAN_INTERVENTION_FILTERS)[number]

export const HUMAN_INTERVENTION_ACTIONS = ["mark_reviewed", "dismiss", "view_details"] as const
export type HumanInterventionActionType = (typeof HUMAN_INTERVENTION_ACTIONS)[number]

export type HumanInterventionTrigger = {
  trigger_id: string
  trigger_type: string
  reason: string
  evidence: string[]
  source_system: string
  source_ref: string
}

export type HumanInterventionRecommendation = {
  recommendation_id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  related_href: string | null
  action_type: "view_details" | "open_related" | "mark_reviewed" | "dismiss"
}

export type HumanInterventionAction = {
  action_id: string
  label: string
  action_type: HumanInterventionActionType
  requires_confirmation: true
}

export type HumanInterventionResolution = {
  resolution_status: "pending" | "reviewed" | "dismissed" | "resolved"
  resolved_at: string | null
  resolved_by: string | null
}

export type HumanInterventionRelatedEntity = {
  entity_type: "lead" | "thread" | "signal" | "approval" | "campaign" | "playbook"
  entity_id: string
  label: string
  href: string | null
}

export type HumanIntervention = {
  qa_marker: typeof HUMAN_INTERVENTION_QA_MARKER
  intervention_id: string
  intervention_type: HumanInterventionType
  priority: HumanInterventionPriority
  title: string
  description: string
  trigger: HumanInterventionTrigger
  recommendations: HumanInterventionRecommendation[]
  supporting_context: string[]
  related_entities: HumanInterventionRelatedEntity[]
  available_actions: HumanInterventionAction[]
  resolution: HumanInterventionResolution
  lead_id: string | null
  company_name: string | null
  occurred_at: string
  related_href: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type HumanInterventionsResponse = {
  qa_marker: typeof HUMAN_INTERVENTION_QA_MARKER
  generated_at: string
  total: number
  urgent_count: number
  type_counts: Record<HumanInterventionType, number>
  interventions: HumanIntervention[]
  requires_human_review: true
  autonomous_execution_enabled: false
}

export const HUMAN_INTERVENTION_AUDIT_EVENTS = [
  "human_intervention_generated",
  "human_intervention_reviewed",
  "human_intervention_dismissed",
  "human_intervention_resolved",
] as const

export type HumanInterventionAuditEvent = (typeof HUMAN_INTERVENTION_AUDIT_EVENTS)[number]
