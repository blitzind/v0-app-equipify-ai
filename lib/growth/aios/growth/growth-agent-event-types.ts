/** GE-AIOS-GROWTH-4C — Agent Event & Scheduling types (client-safe). */

import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type {
  GrowthAgentKind,
  GrowthAgentRequiredGate,
  GrowthAgentSchedulerMode,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { RevenueOperatorAgentHandoffContract } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type { RevenueOperatorEscalationLevel } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"

export const GROWTH_AIOS_GROWTH_4C_PHASE = "GE-AIOS-GROWTH-4C" as const

export const GROWTH_AGENT_EVENT_QA_MARKER = "growth-aios-growth-4c-agent-events-v1" as const

export const GROWTH_AGENT_EVENT_RULE =
  "Agent events and scheduling are recommendation-only in 4C — events determine when agents should wake and evaluate work without executing agents, runtime, outbound, providers, Work Orders, or Core mutations. Scheduler remains disabled." as const

export const GROWTH_AGENT_EVENT_TYPES = [
  "lead_discovered",
  "research_completed",
  "qualification_completed",
  "opportunity_changed",
  "execution_plan_created",
  "execution_plan_approved",
  "readiness_changed",
  "dry_run_completed",
  "runtime_completed",
  "meeting_booked",
  "meeting_completed",
  "workflow_failed",
  "human_review_requested",
  "daily_review",
  "manual_operator_request",
] as const

export type GrowthAgentEventType = (typeof GROWTH_AGENT_EVENT_TYPES)[number]

export const GROWTH_AGENT_EVENT_SOURCES = [
  "ai_os_event_bus",
  "plan_state",
  "operator_surface",
  "scheduler_placeholder",
] as const

export type GrowthAgentEventSource = (typeof GROWTH_AGENT_EVENT_SOURCES)[number]

export const GROWTH_AGENT_EVENT_PRIORITIES = ["low", "normal", "high", "critical"] as const

export type GrowthAgentEventPriority = (typeof GROWTH_AGENT_EVENT_PRIORITIES)[number]

export const GROWTH_AGENT_EVENT_QUEUE_STATUSES = [
  "pending",
  "ignored",
  "blocked",
  "completed_recommendation",
] as const

export type GrowthAgentEventQueueStatus = (typeof GROWTH_AGENT_EVENT_QUEUE_STATUSES)[number]

export type GrowthAgentEventRecord = {
  eventId: string
  eventType: GrowthAgentEventType
  source: GrowthAgentEventSource
  timestamp: string
  leadId: string | null
  companyId: string | null
  companyName: string | null
  workflowType: GrowthLeadResearchCanonicalWorkflowType | null
  priority: GrowthAgentEventPriority
  triggeringReason: string
  candidateAgents: GrowthAgentKind[]
  owningAgent: GrowthAgentKind
  requiredGates: GrowthAgentRequiredGate[]
  blockedReasons: string[]
  aiOsEventType: string | null
}

export type GrowthAgentEventRoutingResult = {
  eventId: string
  eventType: GrowthAgentEventType
  routedAgent: GrowthAgentKind
  owningAgent: GrowthAgentKind
  routingExplanation: string
  queueStatus: GrowthAgentEventQueueStatus
  blockedReasons: string[]
  recommendation: string
}

export type GrowthAgentEventRevenueOperatorConsumption = {
  owningAgent: GrowthAgentKind
  recommendedNextAgent: GrowthAgentKind
  recommendation: string
  blockedReasons: string[]
  escalationLevel: RevenueOperatorEscalationLevel
  handoffPreview: RevenueOperatorAgentHandoffContract | null
}

export type GrowthAgentEventQueueItem = GrowthAgentEventRecord &
  GrowthAgentEventRoutingResult & {
    revenueOperator: GrowthAgentEventRevenueOperatorConsumption
  }

export type GrowthAgentSchedulingDefinition = {
  agentKind: GrowthAgentKind
  schedulerMode: GrowthAgentSchedulerMode
  schedulerActive: false
  wakeOnEvents: GrowthAgentEventType[]
  description: string
}

export type GrowthAgentEventPlanContext = {
  latestTriggeringEvent: GrowthAgentEventType
  latestTriggeringEventId: string
  latestTriggeringReason: string
  owningAgent: GrowthAgentKind
  routedAgent: GrowthAgentKind
  routingExplanation: string
  queueStatus: GrowthAgentEventQueueStatus
}

export type GrowthAgentEventsReadModel = {
  qaMarker: typeof GROWTH_AGENT_EVENT_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AGENT_EVENT_RULE
  schedulerActive: false
  schedulingMode: GrowthAgentSchedulerMode
  schedulingDefinitions: GrowthAgentSchedulingDefinition[]
  summary: {
    totalEvents: number
    pending: number
    ignored: number
    blocked: number
    completedRecommendations: number
  }
  queue: {
    pending: GrowthAgentEventQueueItem[]
    ignored: GrowthAgentEventQueueItem[]
    blocked: GrowthAgentEventQueueItem[]
    completedRecommendations: GrowthAgentEventQueueItem[]
  }
  latestEvents: GrowthAgentEventQueueItem[]
}
