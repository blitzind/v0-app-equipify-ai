/** GE-AIOS-5C — AI OS Command Center read service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateAiOsAgentHealth } from "@/lib/growth/aios/ai-agent-runtime-health"
import { evaluateAiOsProviderHealth } from "@/lib/growth/aios/ai-provider-health"
import {
  GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER,
  type AiOsCommandCenterActivityItem,
  type AiOsCommandCenterAttentionItem,
  type AiOsCommandCenterDecisionSummary,
  type AiOsCommandCenterExecutiveBrainActivityItem,
  type AiOsCommandCenterExecutSummary,
  type AiOsCommandCenterPilotStatus,
  type AiOsCommandCenterReadModel,
  type AiOsCommandCenterSafeMode,
  type AiOsCommandCenterWorkOrderSummary,
} from "@/lib/growth/aios/ai-os-command-center-types"
import { listAiDecisionRecords } from "@/lib/growth/aios/ai-decision-record-repository"
import { listAiOsEvents } from "@/lib/growth/aios/ai-event-repository"
import { listAiExecutiveBrainRuntimes } from "@/lib/growth/aios/ai-executive-brain-repository"
import { resolveExecutiveMissionPlanningStage } from "@/lib/growth/aios/ai-executive-mission-planning-planner"
import {
  LEAD_RESEARCH_PILOT_MISSION_TITLE,
} from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import { resolveLeadResearchPilotConfig } from "@/lib/growth/aios/pilot/lead-research-pilot-config"
import { buildGrowthLeadResearchWorkflowCommandCenterSummary } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { buildGrowthLeadResearchExecutionPlanApprovalQueue } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import { buildGrowthLeadResearchApprovedPlanReadinessQueue } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import {
  buildGrowthLeadResearchFutureExecutionHandoffContracts,
  resolveFutureExecutionHandoffInfrastructure,
} from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import { buildGrowthLeadResearchExecutionBoundaryAudit } from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-service"
import { buildGrowthLeadResearchExecutionPreflightChecklist } from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-service"
import { buildGrowthLeadResearchExecutionSimulation } from "@/lib/growth/aios/growth/growth-lead-research-execution-simulation-service"
import { buildGrowthLeadResearchExecutionRuntimeReadModel } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-service"
import { buildGrowthAgentFrameworkReadModel } from "@/lib/growth/aios/growth/growth-agent-framework-service"
import { buildRevenueOperatorReadModel } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-service"
import { buildGrowthAgentEventsReadModel } from "@/lib/growth/aios/growth/growth-agent-event-service"
import { buildGrowthAgentMemoryReadModel } from "@/lib/growth/aios/growth/growth-agent-memory-service"
import { buildGrowthMissionFrameworkReadModel } from "@/lib/growth/aios/growth/growth-mission-framework-service"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import { buildGrowthSchedulerReadinessReadModel } from "@/lib/growth/aios/growth/growth-scheduler-readiness-service"
import { buildGrowthAutonomousOutreachPreparationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service"
import { buildAutonomousOutreachPreparationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-engine"
import { buildGrowthAutonomousMeetingPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-service"
import { buildAutonomousMeetingPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-engine"
import { buildGrowthAutonomousExecutionPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-service"
import { buildGrowthAutonomousPlanningPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-service"
import { buildGrowthAutonomousQualificationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-service"
import { buildGrowthAutonomousResearchPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-service"
import {
  buildAiOsMissionPlanningHref,
  GROWTH_AI_OS_PUBLIC_BASE_PATH,
} from "@/lib/growth/aios/ai-os-public-routes"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import {
  isAiWorkOrderActiveStatus,
  type AiWorkOrder,
} from "@/lib/growth/aios/ai-work-order-types"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { fetchGrowthAiOsAutonomyPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  buildCommandCenterSafeModeFromPolicy,
  enrichAgentFrameworkWithAutonomyPolicy,
  enrichAutonomousOutreachPreparationPilotWithAutonomyPolicy,
  enrichAutonomousMeetingPilotWithAutonomyPolicy,
  enrichAutonomousExecutionPilotWithAutonomyPolicy,
  enrichAutonomousPlanningPilotWithAutonomyPolicy,
  enrichAutonomousQualificationPilotWithAutonomyPolicy,
  enrichAutonomousResearchPilotWithAutonomyPolicy,
  enrichRevenueOperatorWithAutonomyPolicy,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import { listGeV15OrganizationApprovalInbox } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval-inbox"
import { logGrowthEngine } from "@/lib/growth/growth-engine-session"

const DEFAULT_LIMIT = 12

function nowIso(): string {
  return new Date().toISOString()
}

function missionProgressPercent(objective: GrowthObjective): number {
  if (objective.targetValue <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((objective.currentValue / objective.targetValue) * 100)))
}

function isPilotObjective(objective: GrowthObjective): boolean {
  return objective.title === LEAD_RESEARCH_PILOT_MISSION_TITLE
}

function isActiveMission(objective: GrowthObjective): boolean {
  if (objective.status !== "active") return false
  if (objective.emergencyStopActive) return false
  return objective.runtime?.running === true || objective.status === "active"
}

function mapWorkOrderSummary(workOrder: AiWorkOrder): AiOsCommandCenterWorkOrderSummary {
  return {
    workOrderId: workOrder.id,
    missionId: workOrder.missionId,
    workOrderType: workOrder.workOrderType,
    status: workOrder.status,
    assignedAgent: workOrder.assignedAgent,
    priority: workOrder.priority,
    updatedAt: workOrder.updatedAt,
    planningReviewHref: buildAiOsMissionPlanningHref(workOrder.missionId),
  }
}

function eventTitle(eventType: string): string {
  return eventType.replaceAll(".", " ").replaceAll("_", " ")
}

function extractPilotLeadIds(objectives: GrowthObjective[]): string[] {
  const leadIds = new Set<string>()
  for (const objective of objectives.filter(isPilotObjective)) {
    for (const signal of objective.recentSignals ?? []) {
      if (signal.leadId) leadIds.add(signal.leadId)
    }
  }
  return [...leadIds].slice(0, 5)
}

function buildAttentionItems(input: {
  approvalWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  blockedWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  objectives: GrowthObjective[]
  agentStaleCount: number
  providerReady: boolean
  pilotEnabled: boolean
  activePilotMissions: number
}): AiOsCommandCenterAttentionItem[] {
  const items: AiOsCommandCenterAttentionItem[] = []

  for (const workOrder of input.approvalWorkOrders.slice(0, 6)) {
    items.push({
      id: `approval:${workOrder.workOrderId}`,
      kind: "approval_required",
      title: "Approval required",
      summary: `${workOrder.workOrderType.replaceAll("_", " ")} · ${workOrder.status.replaceAll("_", " ")}`,
      severity: "high",
      missionId: workOrder.missionId,
      workOrderId: workOrder.workOrderId,
      leadId: null,
      href: workOrder.planningReviewHref,
    })
  }

  for (const workOrder of input.blockedWorkOrders.slice(0, 6)) {
    items.push({
      id: `blocked:${workOrder.workOrderId}`,
      kind: "blocked_work_order",
      title: "Blocked or escalated Work Order",
      summary: `${workOrder.workOrderType.replaceAll("_", " ")} · ${workOrder.status}`,
      severity: workOrder.status === "failed" ? "high" : "medium",
      missionId: workOrder.missionId,
      workOrderId: workOrder.workOrderId,
      leadId: null,
      href: workOrder.planningReviewHref,
    })
  }

  for (const objective of input.objectives) {
    if (!objective.emergencyStopActive && objective.status !== "paused") continue
    items.push({
      id: `mission:${objective.id}`,
      kind: "mission_stalled",
      title: objective.emergencyStopActive ? "Mission emergency stop" : "Mission paused",
      summary: objective.title,
      severity: "high",
      missionId: objective.id,
      workOrderId: null,
      leadId: null,
      href: buildAiOsMissionPlanningHref(objective.id),
    })
  }

  if (input.agentStaleCount > 0) {
    items.push({
      id: "agent:stale",
      kind: "agent_unhealthy",
      title: "Agent health degraded",
      summary: `${input.agentStaleCount} agent registration(s) stale or offline`,
      severity: "medium",
      missionId: null,
      workOrderId: null,
      leadId: null,
      href: null,
    })
  }

  if (!input.providerReady) {
    items.push({
      id: "provider:degraded",
      kind: "provider_degraded",
      title: "Provider health degraded",
      summary: "AI provider runtime is not fully ready",
      severity: "medium",
      missionId: null,
      workOrderId: null,
      leadId: null,
      href: null,
    })
  }

  if (input.pilotEnabled && input.activePilotMissions > 0) {
    items.push({
      id: "pilot:active",
      kind: "pilot_attention",
      title: "Lead Research Pilot active",
      summary: `${input.activePilotMissions} pilot mission container(s) running`,
      severity: "low",
      missionId: null,
      workOrderId: null,
      leadId: null,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research`,
    })
  }

  return items
}

function buildExecutSummary(input: {
  activeMissionCount: number
  pendingWorkOrderCount: number
  approvalRequiredCount: number
  blockedWorkOrderCount: number
  recentEventCount: number
  primaryFocus: string | null
}): AiOsCommandCenterExecutSummary {
  const headline =
    input.approvalRequiredCount > 0
      ? `Alden needs your approval on ${input.approvalRequiredCount} Work Order(s).`
      : input.blockedWorkOrderCount > 0
        ? `${input.blockedWorkOrderCount} Work Order(s) are blocked or escalated.`
        : input.activeMissionCount > 0
          ? `Alden is working ${input.activeMissionCount} active mission(s).`
          : "Alden is idle — no active missions."

  return {
    headline,
    activeMissionCount: input.activeMissionCount,
    pendingWorkOrderCount: input.pendingWorkOrderCount,
    approvalRequiredCount: input.approvalRequiredCount,
    blockedWorkOrderCount: input.blockedWorkOrderCount,
    recentEventCount: input.recentEventCount,
    primaryFocus: input.primaryFocus,
  }
}

export async function fetchAiOsCommandCenterReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<AiOsCommandCenterReadModel> {
  const limit = input.limit ?? DEFAULT_LIMIT
  const pilotConfig = resolveLeadResearchPilotConfig()
  const generatedAt = nowIso()

  const autonomyPolicy = await fetchGrowthAiOsAutonomyPolicy(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  const [
    objectives,
    allWorkOrders,
    recentEvents,
    executiveEvents,
    recentDecisions,
    agentHealth,
    providerHealth,
    executiveRuntimes,
  ] = await Promise.all([
    listGrowthObjectives(admin, input.organizationId),
    listAiWorkOrders(admin, { organizationId: input.organizationId, limit: 200 }),
    listAiOsEvents(admin, { organizationId: input.organizationId, limit }),
    listAiOsEvents(admin, { organizationId: input.organizationId, category: "executive", limit }),
    listAiDecisionRecords(admin, { organizationId: input.organizationId, limit }),
    evaluateAiOsAgentHealth(admin, { organizationId: input.organizationId }),
    evaluateAiOsProviderHealth(admin, { organizationId: input.organizationId }),
    listAiExecutiveBrainRuntimes(admin, { organizationId: input.organizationId }),
  ])

  const activeObjectives = objectives.filter(isActiveMission)
  const pilotObjectives = objectives.filter(isPilotObjective).filter((row) => row.runtime?.running)

  const activeWorkOrders = allWorkOrders.filter((row) => isAiWorkOrderActiveStatus(row.status))
  const pendingWorkOrders = allWorkOrders
    .filter((row) => ["issued", "planning", "waiting", "executing", "monitoring"].includes(row.status))
    .slice(0, limit)
    .map(mapWorkOrderSummary)
  const approvalWorkOrders = allWorkOrders
    .filter((row) => row.status === "awaiting_approval" || row.status === "awaiting_decision")
    .slice(0, limit)
    .map(mapWorkOrderSummary)
  const blockedWorkOrders = allWorkOrders
    .filter((row) => row.status === "escalated" || row.status === "failed")
    .slice(0, limit)
    .map(mapWorkOrderSummary)

  const workOrdersByMission = new Map<string, AiWorkOrder[]>()
  for (const workOrder of activeWorkOrders) {
    const bucket = workOrdersByMission.get(workOrder.missionId) ?? []
    bucket.push(workOrder)
    workOrdersByMission.set(workOrder.missionId, bucket)
  }

  const activeMissions = activeObjectives.slice(0, limit).map((objective) => ({
    missionId: objective.id,
    title: objective.title,
    status: objective.status,
    objectiveType: objective.objectiveType,
    currentStageId: resolveExecutiveMissionPlanningStage(objective),
    running: objective.runtime?.running ?? false,
    progressPercent: missionProgressPercent(objective),
    activeWorkOrderCount: workOrdersByMission.get(objective.id)?.length ?? 0,
    planningReviewHref: buildAiOsMissionPlanningHref(objective.id) ?? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/missions`,
  }))

  const recentActivity: AiOsCommandCenterActivityItem[] = recentEvents.map((event) => ({
    eventId: event.id,
    eventType: event.eventType,
    category: event.category,
    title: eventTitle(event.eventType),
    summary: String(event.payload?.summary ?? event.metadata?.summary ?? event.eventType),
    occurredAt: event.occurredAt,
    missionId: event.missionId,
    workOrderId: event.workOrderId,
  }))

  const executiveBrainActivity: AiOsCommandCenterExecutiveBrainActivityItem[] = executiveEvents.map((event) => ({
    eventId: event.id,
    eventType: event.eventType,
    summary: String(event.payload?.summary ?? event.metadata?.summary ?? event.eventType),
    occurredAt: event.occurredAt,
    missionId: event.missionId,
  }))

  if (executiveBrainActivity.length === 0 && executiveRuntimes.length > 0) {
    for (const runtime of executiveRuntimes.slice(0, 3)) {
      executiveBrainActivity.push({
        eventId: runtime.id,
        eventType: "executive.runtime_status",
        summary: `Runtime ${runtime.instanceId} · ${runtime.runtimeStatus}`,
        occurredAt: runtime.updatedAt,
        missionId: null,
      })
    }
  }

  const recentDecisionRecords: AiOsCommandCenterDecisionSummary[] = recentDecisions.map((record) => ({
    decisionRecordId: record.id,
    missionId: record.missionId,
    workOrderId: record.workOrderId,
    ownerAgent: record.ownerAgent,
    explanation: record.explanation,
    confidence: record.confidence,
    createdAt: record.createdAt,
  }))

  const agentStaleCount = agentHealth.agents.filter((agent) => agent.stale || agent.healthStatus !== "healthy").length

  const needsAttention = buildAttentionItems({
    approvalWorkOrders,
    blockedWorkOrders,
    objectives,
    agentStaleCount,
    providerReady: providerHealth.ready,
    pilotEnabled: pilotConfig.enabled,
    activePilotMissions: pilotObjectives.length,
  })

  const primaryFocus = needsAttention[0]?.title ?? activeMissions[0]?.title ?? null

  const safeMode = buildCommandCenterSafeModeFromPolicy(autonomyPolicy)

  const pilotStatus: AiOsCommandCenterPilotStatus = {
    featureEnabled: pilotConfig.enabled,
    enableAiEvidence: pilotConfig.enableAiEvidence,
    activePilotMissions: pilotObjectives.length,
    recentLeadIds: extractPilotLeadIds(objectives),
    observationHrefTemplate: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/{leadId}`,
  }

  const growthLeadResearchWorkflow = await buildGrowthLeadResearchWorkflowCommandCenterSummary(admin, {
    organizationId: input.organizationId,
    limit,
  })

  const executionPlanReviewQueue = await buildGrowthLeadResearchExecutionPlanApprovalQueue(admin, {
    organizationId: input.organizationId,
    limit,
  })

  const approvedPlanReadinessQueue = await buildGrowthLeadResearchApprovedPlanReadinessQueue(admin, {
    organizationId: input.organizationId,
    limit,
  })

  const handoffInfrastructure = await resolveFutureExecutionHandoffInfrastructure(admin, {
    organizationId: input.organizationId,
  })

  const futureExecutionHandoffContracts = await buildGrowthLeadResearchFutureExecutionHandoffContracts(admin, {
    organizationId: input.organizationId,
    limit,
    infrastructure: handoffInfrastructure,
    generatedAt,
  })

  const executionBoundaryAudit = await buildGrowthLeadResearchExecutionBoundaryAudit(admin, {
    organizationId: input.organizationId,
    limit,
    generatedAt,
  })

  const executionPreflightChecklist = await buildGrowthLeadResearchExecutionPreflightChecklist(admin, {
    organizationId: input.organizationId,
    limit,
    generatedAt,
  })

  const executionSimulation = await buildGrowthLeadResearchExecutionSimulation(admin, {
    organizationId: input.organizationId,
    limit,
    generatedAt,
  })

  const executionRuntime = await buildGrowthLeadResearchExecutionRuntimeReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })

  const agentFramework = enrichAgentFrameworkWithAutonomyPolicy(
    await buildGrowthAgentFrameworkReadModel(admin, { generatedAt }),
    autonomyPolicy,
  )
  const revenueOperator = enrichRevenueOperatorWithAutonomyPolicy(
    await buildRevenueOperatorReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    }),
    autonomyPolicy,
  )
  const agentEvents = await buildGrowthAgentEventsReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const agentMemory = await buildGrowthAgentMemoryReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const missionFramework = await buildGrowthMissionFrameworkReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const missionPriority = await buildGrowthMissionPriorityReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const schedulerReadiness = await buildGrowthSchedulerReadinessReadModel(admin, {
    organizationId: input.organizationId,
    generatedAt,
  })
  const autonomousResearchPilot = enrichAutonomousResearchPilotWithAutonomyPolicy(
    await buildGrowthAutonomousResearchPilotReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    }),
    autonomyPolicy,
  )
  const autonomousQualificationPilot = enrichAutonomousQualificationPilotWithAutonomyPolicy(
    await buildGrowthAutonomousQualificationPilotReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    }),
    autonomyPolicy,
  )
  const autonomousPlanningPilot = enrichAutonomousPlanningPilotWithAutonomyPolicy(
    await buildGrowthAutonomousPlanningPilotReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    }),
    autonomyPolicy,
  )
  const autonomousExecutionPilot = enrichAutonomousExecutionPilotWithAutonomyPolicy(
    await buildGrowthAutonomousExecutionPilotReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt,
    }),
    autonomyPolicy,
  )
  let autonomousOutreachPreparationPilot
  try {
    autonomousOutreachPreparationPilot = enrichAutonomousOutreachPreparationPilotWithAutonomyPolicy(
      await buildGrowthAutonomousOutreachPreparationPilotReadModel(admin, {
        organizationId: input.organizationId,
        generatedAt,
      }),
      autonomyPolicy,
    )
  } catch (error) {
    logGrowthEngine("outreach_preparation_read_model_failed", {
      organizationId: input.organizationId,
      message: error instanceof Error ? error.message : String(error),
    })
    autonomousOutreachPreparationPilot = enrichAutonomousOutreachPreparationPilotWithAutonomyPolicy(
      buildAutonomousOutreachPreparationPilotReadModel({
        controlState: "disabled",
        runs: [],
        generatedAt,
        eligibleLeads: 0,
        activeRuns: 0,
      }),
      autonomyPolicy,
    )
  }

  let autonomousMeetingPilot
  try {
    autonomousMeetingPilot = enrichAutonomousMeetingPilotWithAutonomyPolicy(
      await buildGrowthAutonomousMeetingPilotReadModel(admin, {
        organizationId: input.organizationId,
        generatedAt,
      }),
      autonomyPolicy,
    )
  } catch (error) {
    logGrowthEngine("meeting_preparation_read_model_failed", {
      organizationId: input.organizationId,
      message: error instanceof Error ? error.message : String(error),
    })
    autonomousMeetingPilot = enrichAutonomousMeetingPilotWithAutonomyPolicy(
      buildAutonomousMeetingPilotReadModel({
        controlState: "disabled",
        runs: [],
        generatedAt,
        eligibleLeads: 0,
        activeRuns: 0,
      }),
      autonomyPolicy,
    )
  }

  const automationApprovalInbox = await listGeV15OrganizationApprovalInbox(admin, {
    organizationId: input.organizationId,
    limit: 250,
  })

  const commandCenterBase = {
    readOnly: true as const,
    qaMarker: GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER,
    generatedAt: nowIso(),
    executiveSummary: buildExecutSummary({
      activeMissionCount: activeMissions.length,
      pendingWorkOrderCount: pendingWorkOrders.length,
      approvalRequiredCount: approvalWorkOrders.length,
      blockedWorkOrderCount: blockedWorkOrders.length,
      recentEventCount: recentActivity.length,
      primaryFocus,
    }),
    activeMissions,
    needsAttention,
    recentActivity,
    executiveBrainActivity,
    pendingWorkOrders,
    approvalWorkOrders,
    blockedWorkOrders,
    recentDecisionRecords,
    agentHealth,
    providerHealth,
    pilotStatus,
    growthLeadResearchWorkflow,
    executionPlanReviewQueue,
    approvedPlanReadinessQueue,
    futureExecutionHandoffContracts,
    executionBoundaryAudit,
    executionPreflightChecklist,
    executionSimulation,
    executionRuntime,
    agentFramework,
    revenueOperator,
    agentEvents,
    agentMemory,
    missionFramework,
    missionPriority,
    schedulerReadiness,
    autonomousResearchPilot,
    autonomousQualificationPilot,
    autonomousPlanningPilot,
    autonomousExecutionPilot,
    autonomousOutreachPreparationPilot,
    autonomousMeetingPilot,
    safeMode,
  }

  const withDailyBriefing = {
    ...commandCenterBase,
    dailyBriefing: synthesizeAiOsDailyBriefing(commandCenterBase),
  }

  return {
    ...withDailyBriefing,
    autonomyPolicy,
    operationsDashboard: synthesizeAiOsOperationsDashboard(withDailyBriefing, {
      automationApprovalCount: automationApprovalInbox.length,
    }, autonomyPolicy),
  }
}
