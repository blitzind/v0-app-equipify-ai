/** GE-AIOS-GROWTH-4C — Agent Event & Scheduling engine (client-safe, deterministic). */

import { GROWTH_AGENT_SCHEDULER_MODES } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthAgentKind, GrowthAgentRequiredGate } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import { GROWTH_AGENT_KINDS } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import { isAgentSchedulerActive } from "@/lib/growth/aios/growth/growth-agent-framework-permissions"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  buildRevenueOperatorOrchestration,
  resolveOwningAgent,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-engine"
import type { RevenueOperatorPlanStateInput } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type {
  GrowthAgentEventPlanContext,
  GrowthAgentEventPriority,
  GrowthAgentEventQueueItem,
  GrowthAgentEventQueueStatus,
  GrowthAgentEventRecord,
  GrowthAgentEventRoutingResult,
  GrowthAgentEventSource,
  GrowthAgentEventType,
  GrowthAgentEventsReadModel,
  GrowthAgentSchedulingDefinition,
} from "@/lib/growth/aios/growth/growth-agent-event-types"
import {
  GROWTH_AGENT_EVENT_QA_MARKER,
  GROWTH_AGENT_EVENT_RULE,
  GROWTH_AGENT_EVENT_TYPES,
} from "@/lib/growth/aios/growth/growth-agent-event-types"

const SUPERVISOR: GrowthAgentKind = "revenue_operator_agent"

const ROUTING_TABLE: Record<
  GrowthAgentEventType,
  { routedAgent: GrowthAgentKind; candidateAgents: GrowthAgentKind[]; explanation: string }
> = {
  lead_discovered: {
    routedAgent: "research_agent",
    candidateAgents: ["research_agent", "revenue_operator_agent"],
    explanation: "New lead discovered — Research Agent should evaluate enrichment path.",
  },
  research_completed: {
    routedAgent: "qualification_agent",
    candidateAgents: ["qualification_agent", "planning_agent", SUPERVISOR],
    explanation: "Research complete — Qualification Agent owns verification and committee mapping.",
  },
  qualification_completed: {
    routedAgent: "planning_agent",
    candidateAgents: ["planning_agent", SUPERVISOR],
    explanation: "Qualification complete — Planning Agent prepares execution path.",
  },
  opportunity_changed: {
    routedAgent: "planning_agent",
    candidateAgents: ["planning_agent", SUPERVISOR],
    explanation: "Opportunity assessment changed — Planning Agent re-evaluates mission plan.",
  },
  execution_plan_created: {
    routedAgent: "planning_agent",
    candidateAgents: ["planning_agent", SUPERVISOR],
    explanation: "Execution plan created — Planning Agent owns review until approval.",
  },
  execution_plan_approved: {
    routedAgent: SUPERVISOR,
    candidateAgents: [SUPERVISOR, "planning_agent", "execution_agent"],
    explanation: "Plan approved — Revenue Operator supervises readiness and handoff.",
  },
  readiness_changed: {
    routedAgent: SUPERVISOR,
    candidateAgents: [SUPERVISOR, "planning_agent", "execution_agent"],
    explanation: "Readiness state changed — Revenue Operator re-evaluates ownership.",
  },
  dry_run_completed: {
    routedAgent: SUPERVISOR,
    candidateAgents: [SUPERVISOR, "execution_agent"],
    explanation: "Dry-run finished — Revenue Operator validates execution handoff gates.",
  },
  runtime_completed: {
    routedAgent: SUPERVISOR,
    candidateAgents: [SUPERVISOR, "execution_agent", "research_agent"],
    explanation: "Runtime completed — Revenue Operator supervises next lifecycle step.",
  },
  meeting_booked: {
    routedAgent: "meeting_agent",
    candidateAgents: ["meeting_agent", SUPERVISOR],
    explanation: "Meeting booked — Meeting Agent owns preparation.",
  },
  meeting_completed: {
    routedAgent: "meeting_agent",
    candidateAgents: ["meeting_agent", SUPERVISOR],
    explanation: "Meeting completed — Meeting Agent owns follow-up planning.",
  },
  workflow_failed: {
    routedAgent: SUPERVISOR,
    candidateAgents: [SUPERVISOR, "planning_agent"],
    explanation: "Workflow failed — Revenue Operator escalates for human review.",
  },
  human_review_requested: {
    routedAgent: SUPERVISOR,
    candidateAgents: [SUPERVISOR],
    explanation: "Human review requested — Revenue Operator owns escalation routing.",
  },
  daily_review: {
    routedAgent: SUPERVISOR,
    candidateAgents: [SUPERVISOR, "planning_agent"],
    explanation: "Daily review tick — Revenue Operator evaluates portfolio ownership.",
  },
  manual_operator_request: {
    routedAgent: SUPERVISOR,
    candidateAgents: [SUPERVISOR, "planning_agent"],
    explanation: "Manual operator request — Revenue Operator routes recommendation only.",
  },
}

const BASE_GATES: GrowthAgentRequiredGate[] = [
  "approval",
  "readiness",
  "handoff",
  "preflight",
  "boundary",
]

function orderAgents(agents: GrowthAgentKind[]): GrowthAgentKind[] {
  return GROWTH_AGENT_KINDS.filter((kind) => agents.includes(kind))
}

export function resolveAgentEventRouting(input: {
  event: GrowthAgentEventRecord
}): GrowthAgentEventRoutingResult {
  const route = ROUTING_TABLE[input.event.eventType]
  const blockedReasons = [...input.event.blockedReasons]

  if (input.event.workflowType === "outreach_generation") {
    blockedReasons.push("Outreach events blocked — no autonomous outbound in 4C.")
  }

  let queueStatus: GrowthAgentEventQueueStatus = "completed_recommendation"
  if (blockedReasons.length > 0) {
    queueStatus = "blocked"
  } else if (input.event.eventType === "daily_review" && input.event.source === "scheduler_placeholder") {
    queueStatus = "ignored"
  } else if (input.event.priority === "low" && input.event.source === "ai_os_event_bus") {
    queueStatus = "pending"
  } else {
    queueStatus = "completed_recommendation"
  }

  return {
    eventId: input.event.eventId,
    eventType: input.event.eventType,
    routedAgent: route.routedAgent,
    owningAgent: input.event.owningAgent,
    routingExplanation: route.explanation,
    queueStatus,
    blockedReasons,
    recommendation: `Recommend ${route.routedAgent.replaceAll("_", " ")} evaluate — no execution in 4C.`,
  }
}

export function buildAgentEventRecord(input: {
  eventType: GrowthAgentEventType
  source: GrowthAgentEventSource
  timestamp: string
  leadId?: string | null
  companyId?: string | null
  companyName?: string | null
  workflowType?: GrowthLeadResearchCanonicalWorkflowType | null
  priority?: GrowthAgentEventPriority
  triggeringReason: string
  planState?: RevenueOperatorPlanStateInput | null
  aiOsEventType?: string | null
  blockedReasons?: string[]
}): GrowthAgentEventRecord {
  const route = ROUTING_TABLE[input.eventType]
  const owningAgent = input.planState
    ? resolveOwningAgent(input.planState)
    : route.routedAgent

  const blockedReasons = [...(input.blockedReasons ?? [])]
  if (input.workflowType === "outreach_generation") {
    blockedReasons.push("Outreach workflow — outbound blocked.")
  }

  const requiredGates = [...BASE_GATES]
  if (input.eventType === "dry_run_completed" || input.eventType === "runtime_completed") {
    requiredGates.push("dry_run", "runtime_pilot")
  }
  if (input.eventType === "execution_plan_approved") {
    requiredGates.push("dry_run")
  }

  return {
    eventId: `agent-event:${input.eventType}:${input.leadId ?? "global"}:${input.timestamp}`,
    eventType: input.eventType,
    source: input.source,
    timestamp: input.timestamp,
    leadId: input.leadId ?? null,
    companyId: input.companyId ?? input.leadId ?? null,
    companyName: input.companyName ?? null,
    workflowType: input.workflowType ?? null,
    priority: input.priority ?? "normal",
    triggeringReason: input.triggeringReason,
    candidateAgents: orderAgents(route.candidateAgents),
    owningAgent,
    requiredGates,
    blockedReasons,
    aiOsEventType: input.aiOsEventType ?? null,
  }
}

export function mapAiOsEventTypeToAgentEventType(aiOsEventType: string): GrowthAgentEventType | null {
  switch (aiOsEventType) {
    case "growth.workflow.status_changed":
      return "research_completed"
    case "growth.execution_plan.review_changed":
      return "execution_plan_approved"
    case "growth.execution_runtime.lifecycle_changed":
      return "runtime_completed"
    case "growth.execution_runtime.step_completed":
      return "runtime_completed"
    case "agent.wake":
      return "manual_operator_request"
    case "executive.tick":
      return "daily_review"
    default:
      return null
  }
}

export function inferAgentEventTypeFromPlanState(input: {
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  approvalStatus: RevenueOperatorPlanStateInput["approvalStatus"]
  readinessState?: RevenueOperatorPlanStateInput["readinessState"]
  latestDryRunStatus?: RevenueOperatorPlanStateInput["latestDryRunStatus"]
  runtimeState?: RevenueOperatorPlanStateInput["runtimeState"]
}): GrowthAgentEventType {
  if (input.runtimeState === "completed") return "runtime_completed"
  if (input.runtimeState === "failed") return "workflow_failed"
  if (input.latestDryRunStatus === "dry_run_passed") return "dry_run_completed"
  if (input.approvalStatus === "approved_for_future_execution") return "execution_plan_approved"
  if (input.readinessState && input.readinessState !== "not_applicable") return "readiness_changed"
  if (input.workflowType === "meeting_preparation") return "meeting_booked"
  if (input.workflowType === "verify_email" || input.workflowType === "buying_committee") {
    return "qualification_completed"
  }
  if (input.workflowType === "research_company") return "research_completed"
  if (input.workflowType === "approval") return "execution_plan_created"
  return "opportunity_changed"
}

export function buildAgentEventQueueItem(input: {
  event: GrowthAgentEventRecord
  planState?: RevenueOperatorPlanStateInput | null
}): GrowthAgentEventQueueItem {
  const routing = resolveAgentEventRouting({ event: input.event })
  const orchestration = input.planState
    ? buildRevenueOperatorOrchestration(input.planState)
    : null

  return {
    ...input.event,
    ...routing,
    revenueOperator: {
      owningAgent: orchestration?.record.owningAgent ?? input.event.owningAgent,
      recommendedNextAgent:
        orchestration?.record.recommendedNextAgent ?? routing.routedAgent,
      recommendation:
        orchestration?.record.recommendedNextAction ?? routing.recommendation,
      blockedReasons: [
        ...routing.blockedReasons,
        ...(orchestration?.record.blockedReasons ?? []),
      ],
      escalationLevel: orchestration?.record.escalationLevel ?? "none",
      handoffPreview: orchestration?.record.handoffPreview ?? null,
    },
  }
}

export function buildAgentSchedulingDefinitions(): GrowthAgentSchedulingDefinition[] {
  return GROWTH_AGENT_KINDS.map((agentKind) => {
    const wakeOnEvents = GROWTH_AGENT_EVENT_TYPES.filter(
      (eventType) => ROUTING_TABLE[eventType].routedAgent === agentKind,
    )
    const schedulerMode =
      agentKind === SUPERVISOR
        ? ("event_driven" as const)
        : wakeOnEvents.length > 0
          ? ("event_driven" as const)
          : ("disabled" as const)

    return {
      agentKind,
      schedulerMode,
      schedulerActive: false as const,
      wakeOnEvents,
      description: `${agentKind.replaceAll("_", " ")} scheduler disabled in 4C — ${schedulerMode} mode defined only.`,
    }
  })
}

export function buildAgentEventQueue(input: {
  events: GrowthAgentEventRecord[]
  planStatesByLeadId?: Map<string, RevenueOperatorPlanStateInput>
  generatedAt: string
}): GrowthAgentEventsReadModel["queue"] & { items: GrowthAgentEventQueueItem[] } {
  const items = input.events.map((event) =>
    buildAgentEventQueueItem({
      event,
      planState: event.leadId ? input.planStatesByLeadId?.get(event.leadId) ?? null : null,
    }),
  )

  return {
    items,
    pending: items.filter((row) => row.queueStatus === "pending"),
    ignored: items.filter((row) => row.queueStatus === "ignored"),
    blocked: items.filter((row) => row.queueStatus === "blocked"),
    completedRecommendations: items.filter((row) => row.queueStatus === "completed_recommendation"),
  }
}

export function buildAgentEventsReadModel(input: {
  events: GrowthAgentEventRecord[]
  planStatesByLeadId?: Map<string, RevenueOperatorPlanStateInput>
  generatedAt: string
}): GrowthAgentEventsReadModel {
  const queue = buildAgentEventQueue(input)
  const schedulingDefinitions = buildAgentSchedulingDefinitions()

  return {
    qaMarker: GROWTH_AGENT_EVENT_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_AGENT_EVENT_RULE,
    schedulerActive: false,
    schedulingMode: "disabled",
    schedulingDefinitions,
    summary: {
      totalEvents: queue.items.length,
      pending: queue.pending.length,
      ignored: queue.ignored.length,
      blocked: queue.blocked.length,
      completedRecommendations: queue.completedRecommendations.length,
    },
    queue: {
      pending: queue.pending,
      ignored: queue.ignored,
      blocked: queue.blocked,
      completedRecommendations: queue.completedRecommendations,
    },
    latestEvents: queue.items.slice(0, 12),
  }
}

export function buildAgentEventPlanContext(input: {
  queueItem: GrowthAgentEventQueueItem | null
}): GrowthAgentEventPlanContext | null {
  if (!input.queueItem) return null
  return {
    latestTriggeringEvent: input.queueItem.eventType,
    latestTriggeringEventId: input.queueItem.eventId,
    latestTriggeringReason: input.queueItem.triggeringReason,
    owningAgent: input.queueItem.revenueOperator.owningAgent,
    routedAgent: input.queueItem.routedAgent,
    routingExplanation: input.queueItem.routingExplanation,
    queueStatus: input.queueItem.queueStatus,
  }
}

export function isAgentEventSchedulerActive(): false {
  return isAgentSchedulerActive()
}

export function listSupportedSchedulerModes(): typeof GROWTH_AGENT_SCHEDULER_MODES {
  return GROWTH_AGENT_SCHEDULER_MODES
}
