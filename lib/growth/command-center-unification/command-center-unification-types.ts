/** Phase GS-6A — Command Center Unification types (client-safe). */

export const COMMAND_CENTER_UNIFICATION_QA_MARKER = "growth-command-center-unification-gs6a-v1" as const

export const COMMAND_CENTER_UNIFICATION_CONFIRM = "RUN_COMMAND_CENTER_UNIFICATION_CERTIFICATION" as const

export const COMMAND_CENTER_WORKSPACE_STATUSES = [
  "healthy",
  "needs_attention",
  "blocked",
  "waiting_for_review",
] as const

export type GrowthCommandCenterWorkspaceStatus = (typeof COMMAND_CENTER_WORKSPACE_STATUSES)[number]

export const COMMAND_CENTER_SECTION_TYPES = [
  "signals",
  "readiness",
  "playbooks",
  "follow_up_policies",
  "sequence_preview",
  "campaign_builder",
  "agent_plan",
  "inbox_activity",
  "audit_timeline",
  "interventions",
  "realtime_events",
  "approvals",
] as const

export type GrowthCommandCenterSectionType = (typeof COMMAND_CENTER_SECTION_TYPES)[number]

export const COMMAND_CENTER_VIEW_IDS = [
  "needs_attention",
  "high_intent",
  "campaign_blocked",
  "ready_for_outreach",
  "waiting_for_human_review",
  "approval_queue",
  "active_conversations",
] as const

export type GrowthCommandCenterViewId = (typeof COMMAND_CENTER_VIEW_IDS)[number]

export const COMMAND_CENTER_TIMELINE_STAGES = [
  "signal",
  "intervention",
  "readiness_change",
  "follow_up_recommendation",
  "sequence_preview",
  "campaign_builder",
  "agent_plan",
  "human_approval",
] as const

export type GrowthCommandCenterTimelineStage = (typeof COMMAND_CENTER_TIMELINE_STAGES)[number]

export const COMMAND_CENTER_UNIFICATION_ACTIONS = [
  "view_details",
  "mark_reviewed",
  "navigate_to_source",
  "dismiss",
] as const

export type CommandCenterUnificationActionType = (typeof COMMAND_CENTER_UNIFICATION_ACTIONS)[number]

export const COMMAND_CENTER_UNIFICATION_FILTERS = ["all", "blocked", "needs_attention", "ready"] as const
export type CommandCenterUnificationFilter = (typeof COMMAND_CENTER_UNIFICATION_FILTERS)[number]

export const WORKSPACE_STATUS_LABELS: Record<GrowthCommandCenterWorkspaceStatus, string> = {
  healthy: "Healthy",
  needs_attention: "Needs attention",
  blocked: "Blocked",
  waiting_for_review: "Waiting for review",
}

export const VIEW_LABELS: Record<GrowthCommandCenterViewId, string> = {
  needs_attention: "Needs Attention",
  high_intent: "High Intent",
  campaign_blocked: "Campaign Blocked",
  ready_for_outreach: "Ready for Outreach",
  waiting_for_human_review: "Waiting on Human Review",
  approval_queue: "Approval Queue",
  active_conversations: "Active Conversations",
}

export type GrowthCommandCenterSection = {
  section_id: string
  section_type: GrowthCommandCenterSectionType
  label: string
  status: GrowthCommandCenterWorkspaceStatus
  item_count: number
  summary: string
  related_href: string | null
  source_panel: string
}

export type GrowthCommandCenterViewItem = {
  item_id: string
  view_id: GrowthCommandCenterViewId
  title: string
  description: string
  priority: "low" | "medium" | "high" | "urgent"
  lead_id: string | null
  company_name: string | null
  related_href: string | null
  source_subsystem: string
}

export type GrowthCommandCenterView = {
  view_id: GrowthCommandCenterViewId
  label: string
  item_count: number
  items: GrowthCommandCenterViewItem[]
}

export type GrowthCommandCenterTimelineItem = {
  timeline_id: string
  stage: GrowthCommandCenterTimelineStage
  title: string
  description: string
  occurred_at: string
  lead_id: string | null
  company_name: string | null
  source_subsystem: string
  related_href: string | null
  order: number
}

export type GrowthCommandCenterMetrics = {
  total_signals: number
  inbox_items: number
  interventions_count: number
  blocked_campaigns: number
  needs_attention_count: number
  ready_for_outreach_count: number
  approval_queue_count: number
  high_intent_count: number
  active_conversations_count: number
  waiting_for_review_count: number
  agent_plans_count: number
  readiness_assessments_count: number
}

export type GrowthCommandCenterWorkspace = {
  qa_marker: typeof COMMAND_CENTER_UNIFICATION_QA_MARKER
  workspace_id: string
  workspace_status: GrowthCommandCenterWorkspaceStatus
  generated_at: string
  sections: GrowthCommandCenterSection[]
  views: GrowthCommandCenterView[]
  timeline: GrowthCommandCenterTimelineItem[]
  metrics: GrowthCommandCenterMetrics
  attention_queue: GrowthCommandCenterViewItem[]
  approval_queue: GrowthCommandCenterViewItem[]
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

export type GrowthCommandCenterLeadWorkspace = {
  qa_marker: typeof COMMAND_CENTER_UNIFICATION_QA_MARKER
  workspace_id: string
  lead_id: string
  company_name: string | null
  workspace_status: GrowthCommandCenterWorkspaceStatus
  generated_at: string
  sections: GrowthCommandCenterSection[]
  timeline: GrowthCommandCenterTimelineItem[]
  metrics: GrowthCommandCenterMetrics
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

export type GrowthCommandCenterUnificationResponse = GrowthCommandCenterWorkspace & {
  lead_workspaces: GrowthCommandCenterLeadWorkspace[]
}

export const COMMAND_CENTER_UNIFICATION_AUDIT_EVENTS = [
  "command_center_workspace_generated",
  "command_center_workspace_viewed",
  "command_center_workspace_reviewed",
  "command_center_workspace_navigation",
] as const

export type CommandCenterUnificationAuditEvent = (typeof COMMAND_CENTER_UNIFICATION_AUDIT_EVENTS)[number]
