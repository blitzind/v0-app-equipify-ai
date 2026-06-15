/** Phase GS-4D — Agent Orchestration Framework types (client-safe). */

export const AGENT_ORCHESTRATION_QA_MARKER = "growth-agent-orchestration-gs4d-v1" as const

export const AGENT_ORCHESTRATION_CONFIRM = "RUN_AGENT_ORCHESTRATION_CERTIFICATION" as const

export const GROWTH_AGENT_PLAN_STATUSES = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_human_approval",
] as const

export type GrowthAgentStatus = (typeof GROWTH_AGENT_PLAN_STATUSES)[number]

export const GROWTH_AGENT_IDS = [
  "readiness_coordinator",
  "sequence_planner",
  "intervention_router",
  "follow_up_planner",
  "campaign_builder_coordinator",
  "inbox_triage_coordinator",
  "event_bus_observer",
] as const

export type GrowthAgentId = (typeof GROWTH_AGENT_IDS)[number]

export const GROWTH_AGENT_TASK_SOURCES = [
  "campaign_readiness",
  "sequence_preview",
  "follow_up_policies",
  "human_interventions",
  "campaign_builder",
  "operator_inbox",
  "realtime_events",
  "opportunity_intelligence",
  "knowledge_recommendations",
  "sequence_intelligence",
] as const

export type GrowthAgentTaskSource = (typeof GROWTH_AGENT_TASK_SOURCES)[number]

export const AGENT_ORCHESTRATION_FILTERS = ["all", "blocked", "needs_review", "ready"] as const
export type AgentOrchestrationFilter = (typeof AGENT_ORCHESTRATION_FILTERS)[number]

export const AGENT_ORCHESTRATION_ACTIONS = ["mark_reviewed", "dismiss", "view_details"] as const
export type AgentOrchestrationActionType = (typeof AGENT_ORCHESTRATION_ACTIONS)[number]

export const GROWTH_AGENT_STATUS_LABELS: Record<GrowthAgentStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  blocked: "Blocked",
  ready_for_human_approval: "Ready for human approval",
}

export const GROWTH_AGENT_LABELS: Record<GrowthAgentId, string> = {
  readiness_coordinator: "Readiness coordinator",
  sequence_planner: "Sequence planner",
  intervention_router: "Intervention router",
  follow_up_planner: "Follow-up planner",
  campaign_builder_coordinator: "Campaign builder coordinator",
  inbox_triage_coordinator: "Inbox triage coordinator",
  event_bus_observer: "Event bus observer",
}

export type GrowthAgent = {
  agent_id: GrowthAgentId
  label: string
  role: string
  subsystem: GrowthAgentTaskSource
  requires_human_review: true
  autonomous_execution_enabled: false
}

export type GrowthAgentTask = {
  task_id: string
  agent_id: GrowthAgentId
  source: GrowthAgentTaskSource
  label: string
  description: string
  order: number
  status: "pending" | "ready" | "blocked" | "complete" | "needs_review"
  priority: "low" | "medium" | "high" | "urgent"
  related_href: string | null
  blockers: string[]
}

export type GrowthAgentDependency = {
  dependency_id: string
  from_task_id: string
  to_task_id: string
  dependency_type: "blocks" | "informs" | "optional"
  rationale: string
}

export type GrowthAgentRecommendation = {
  recommendation_id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  source: GrowthAgentTaskSource
  related_href: string | null
  action_type: "view_details" | "open_related" | "mark_reviewed" | "dismiss"
}

export type GrowthAgentExecutionGraph = {
  graph_id: string
  nodes: Array<{ node_id: string; task_id: string; label: string; order: number }>
  edges: Array<{ edge_id: string; from_task_id: string; to_task_id: string; label: string }>
}

export type GrowthAgentPlan = {
  qa_marker: typeof AGENT_ORCHESTRATION_QA_MARKER
  plan_id: string
  plan_status: GrowthAgentStatus
  plan_score: number
  lead_id: string | null
  company_name: string | null
  agents: GrowthAgent[]
  tasks: GrowthAgentTask[]
  recommendations: GrowthAgentRecommendation[]
  dependencies: GrowthAgentDependency[]
  execution_graph: GrowthAgentExecutionGraph
  risks: Array<{ risk_id: string; severity: "low" | "medium" | "high" | "critical"; title: string; description: string }>
  required_approvals: string[]
  suggested_order: string[]
  review_status: "pending" | "reviewed" | "dismissed"
  related_href: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
  generated_at: string
}

export type GrowthAgentOrchestrationResponse = {
  qa_marker: typeof AGENT_ORCHESTRATION_QA_MARKER
  generated_at: string
  total: number
  blocked_count: number
  needs_review_count: number
  ready_count: number
  status_counts: Record<GrowthAgentStatus, number>
  plans: GrowthAgentPlan[]
  requires_human_review: true
  autonomous_execution_enabled: false
  outreach_execution: false
  enrollment_execution: false
}

export const AGENT_ORCHESTRATION_AUDIT_EVENTS = [
  "agent_plan_generated",
  "agent_plan_reviewed",
  "agent_plan_dismissed",
  "agent_plan_viewed",
] as const

export type AgentOrchestrationAuditEvent = (typeof AGENT_ORCHESTRATION_AUDIT_EVENTS)[number]

export type AgentOrchestrationGenerateRequest = {
  lead_id?: string | null
  pattern_id?: string | null
  filter?: AgentOrchestrationFilter
  limit?: number
  include_campaign_readiness?: boolean
}
