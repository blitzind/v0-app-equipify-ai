/** GE-AIOS-CONSOLIDATION-1B — AI Operations dashboard synthesizer (client-safe). */

import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import type { GrowthAiOsAutonomyPolicyReadModel } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import { GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import type {
  AiOsOperationsActiveWorkItem,
  AiOsOperationsAutonomyStateSummary,
  AiOsOperationsActivityTimelineItem,
  AiOsOperationsApprovalSummary,
  AiOsOperationsDashboardReadModel,
  AiOsOperationsDashboardSupplement,
  AiOsOperationsEngineeringDiagnosticSummary,
  AiOsOperationsExecutiveOverview,
  AiOsOperationsHealthStatus,
  AiOsOperationsHealthSummary,
  AiOsOperationsMissionPriorityRow,
  AiOsOperationsObjectiveRow,
  AiOsOperationsRoiLabel,
  AiOsOperationsUrgencyLevel,
} from "@/lib/growth/aios/ai-os-operations-dashboard-types"
import { GROWTH_AI_OS_PUBLIC_BASE_PATH } from "@/lib/growth/aios/ai-os-public-routes"
import {
  AI_OS_OPERATIONS_DASHBOARD_RUNTIME_RULE,
  GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER,
} from "@/lib/growth/aios/ai-os-operations-dashboard-types"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthMissionQueueBucket } from "@/lib/growth/aios/growth/growth-mission-priority-types"

const TOP_PRIORITY_LIMIT = 10
const ACTIVITY_LIMIT = 24
const ACTIVE_WORK_LIMIT = 12

function urgencyFromScore(score: number): AiOsOperationsUrgencyLevel {
  if (score >= 0.7) return "high"
  if (score >= 0.4) return "medium"
  return "low"
}

function roiLabelFromScore(score: number): AiOsOperationsRoiLabel {
  if (score >= 0.7) return "high"
  if (score >= 0.4) return "medium"
  if (score > 0) return "low"
  return "unknown"
}

function priorityLabelFromBucket(bucket: GrowthMissionQueueBucket): string {
  switch (bucket) {
    case "immediate":
      return "Immediate"
    case "today":
      return "Today"
    case "this_week":
      return "This week"
    case "backlog":
      return "Backlog"
    case "archive_candidate":
      return "Archive candidate"
    default:
      return "Queued"
  }
}

function resolveOperatingModeLabel(
  safeMode: AiOsCommandCenterReadModel["safeMode"],
): string {
  if (safeMode.emergencyStopActive) return "Emergency stop"
  if (!safeMode.autonomyEnabled) return "Manual"
  if (safeMode.objectiveModeEnabled) return "Objective mode"
  return "Assisted autonomy"
}

function resolveSafeModeLabel(safeMode: AiOsCommandCenterReadModel["safeMode"]): string {
  if (safeMode.emergencyStopActive) return "Emergency stop active"
  if (!safeMode.autonomyEnabled) return "Autonomy disabled"
  return "Guardrails active"
}

function resolveOverallHealth(input: {
  agentHealthyRatio: number
  providerReady: boolean
  blockedAgents: number
  schedulerBlocked: boolean
}): AiOsOperationsHealthStatus {
  if (input.blockedAgents > 0 || !input.providerReady) return "blocked"
  if (input.agentHealthyRatio < 0.8 || input.schedulerBlocked) return "degraded"
  return "healthy"
}

function missionOwnerLookup(
  commandCenter: AiOsCommandCenterReadModel,
  missionId: string,
): GrowthAgentKind {
  const mission = commandCenter.missionFramework.missions.find((entry) => entry.missionId === missionId)
  return mission?.ownerAgent ?? "revenue_operator"
}

function missionLabelLookup(commandCenter: AiOsCommandCenterReadModel, missionId: string): string {
  const mission = commandCenter.missionFramework.missions.find((entry) => entry.missionId === missionId)
  if (mission?.companyName) return mission.companyName
  if (mission?.missionType) return mission.missionType.replaceAll("_", " ")
  return missionId.slice(0, 8)
}

function buildExecutiveOverview(
  commandCenter: AiOsCommandCenterReadModel,
  policy?: GrowthAiOsAutonomyPolicyReadModel,
): AiOsOperationsExecutiveOverview {
  const healthyAgents = commandCenter.agentHealth.agents.filter(
    (agent) => agent.healthStatus === "healthy",
  ).length
  const totalAgents = commandCenter.agentHealth.agents.length
  const agentHealthyRatio = totalAgents === 0 ? 1 : healthyAgents / totalAgents
  const schedulerBlocked =
    commandCenter.schedulerReadiness.summary.activationStatus.startsWith("blocked") ||
    commandCenter.schedulerReadiness.summary.blockedReasonCount > 0
  const healthStatus = resolveOverallHealth({
    agentHealthyRatio,
    providerReady: commandCenter.providerHealth.ready,
    blockedAgents: commandCenter.agentHealth.agents.filter((agent) => agent.stale || agent.healthStatus !== "healthy")
      .length,
    schedulerBlocked,
  })

  const approvalBacklog =
    commandCenter.executionPlanReviewQueue.filter((item) => item.approvalStatus === "pending_review").length +
    commandCenter.approvalWorkOrders.length

  const priorityWork =
    commandCenter.missionPriority.rankedMissions[0]?.companyName ??
    commandCenter.missionPriority.rankedMissions[0]?.recommendedAction ??
    commandCenter.executiveSummary.primaryFocus

  return {
    dailyBriefingHeadline: commandCenter.dailyBriefing.executiveHeadline,
    dailyBriefingSummary: commandCenter.dailyBriefing.whatChangedSummary,
    aiHealthStatus: healthStatus,
    aiHealthLabel:
      healthStatus === "healthy"
        ? "AI systems healthy"
        : healthStatus === "degraded"
          ? "AI systems need review"
          : "AI systems blocked or degraded",
    activeAutonomousRuns:
      commandCenter.autonomousResearchPilot.telemetry.activeRuns +
      commandCenter.autonomousQualificationPilot.telemetry.activeRuns +
      commandCenter.autonomousPlanningPilot.telemetry.activeRuns,
    priorityWorkLabel: priorityWork ?? null,
    needsAttentionCount: commandCenter.needsAttention.length,
    approvalBacklogCount: approvalBacklog,
    safeModeLabel: policy?.safeModeActive
      ? resolveSafeModeLabel(commandCenter.safeMode)
      : resolveSafeModeLabel(commandCenter.safeMode),
    operatingModeLabel: policy?.operatingModeLabel ?? resolveOperatingModeLabel(commandCenter.safeMode),
    operatingModeReadOnly: true,
    configureHref: GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH,
  }
}

function buildAutonomyStateSummary(
  policy?: GrowthAiOsAutonomyPolicyReadModel,
): AiOsOperationsAutonomyStateSummary {
  if (!policy) {
    return {
      operatingModeLabel: "Unknown",
      autonomyEnabled: false,
      emergencyStopActive: true,
      safeModeActive: true,
      shadowModeEnabled: false,
      activeAutonomousAgents: [],
      configureHref: GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH,
    }
  }

  return {
    operatingModeLabel: policy.operatingModeLabel,
    autonomyEnabled: policy.autonomyEnabled,
    emergencyStopActive: policy.emergencyStopActive,
    safeModeActive: policy.safeModeActive,
    shadowModeEnabled: policy.shadowModeEnabled,
    activeAutonomousAgents: policy.activeAutonomousAgents.map((agent) => agent.replaceAll("_", " ")),
    configureHref: policy.controlPlaneHref,
  }
}

function buildActiveWork(commandCenter: AiOsCommandCenterReadModel): AiOsOperationsActiveWorkItem[] {
  const items: AiOsOperationsActiveWorkItem[] = []

  for (const ranked of commandCenter.missionPriority.rankedMissions.slice(0, 5)) {
    items.push({
      id: `mission-${ranked.missionId}`,
      category: "mission",
      title: ranked.companyName ?? ranked.missionType.replaceAll("_", " "),
      summary: ranked.recommendedAction,
      href: ranked.leadId ? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${ranked.leadId}` : null,
    })
  }

  for (const plan of commandCenter.executionPlanReviewQueue.filter(
    (entry) => entry.approvalStatus === "pending_review" || entry.approvalRequired,
  ).slice(0, 4)) {
    items.push({
      id: `plan-${plan.planId}`,
      category: "execution_plan",
      title: plan.companyName ?? "Execution plan review",
      summary: plan.reason,
      href: plan.observationHref,
    })
  }

  if (commandCenter.autonomousResearchPilot.enabled) {
    items.push({
      id: "autonomous-research-pilot",
      category: "autonomous_research",
      title: "Autonomous research pilot",
      summary: `${commandCenter.autonomousResearchPilot.telemetry.activeRuns} active run(s) · ${commandCenter.autonomousResearchPilot.controlState}`,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}#autonomous-research-pilot`,
    })
  }

  if (commandCenter.autonomousQualificationPilot.enabled) {
    items.push({
      id: "autonomous-qualification-pilot",
      category: "autonomous_qualification",
      title: "Autonomous qualification pilot",
      summary: `${commandCenter.autonomousQualificationPilot.telemetry.eligibleLeads} eligible · ${commandCenter.autonomousQualificationPilot.telemetry.successfulRuns} completed · ${commandCenter.autonomousQualificationPilot.controlState}`,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}#autonomous-qualification-pilot`,
    })
  }

  if (commandCenter.autonomousPlanningPilot.enabled) {
    items.push({
      id: "autonomous-planning-pilot",
      category: "autonomous_planning",
      title: "Autonomous planning pilot",
      summary: `${commandCenter.autonomousPlanningPilot.telemetry.plansGenerated} plans · ${commandCenter.autonomousPlanningPilot.telemetry.blockedPlanning} blocked · ${commandCenter.autonomousPlanningPilot.controlState}`,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}#autonomous-planning-pilot`,
    })
  }

  for (const ranked of commandCenter.missionPriority.rankedMissions.filter(
    (entry) => entry.allocationStatus === "waiting_for_human",
  ).slice(0, 4)) {
    items.push({
      id: `waiting-${ranked.missionId}`,
      category: "waiting_for_human",
      title: ranked.companyName ?? ranked.missionType.replaceAll("_", " "),
      summary: ranked.recommendedAction,
      href: ranked.leadId ? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${ranked.leadId}` : null,
    })
  }

  for (const ranked of commandCenter.missionPriority.rankedMissions.filter(
    (entry) => entry.allocationStatus === "blocked" || entry.blockers.length > 0,
  ).slice(0, 4)) {
    items.push({
      id: `blocked-${ranked.missionId}`,
      category: "blocked",
      title: ranked.companyName ?? ranked.missionType.replaceAll("_", " "),
      summary: ranked.blockers[0] ?? ranked.recommendedAction,
      href: ranked.leadId ? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${ranked.leadId}` : null,
    })
  }

  for (const workOrder of commandCenter.blockedWorkOrders.slice(0, 3)) {
    items.push({
      id: `wo-blocked-${workOrder.workOrderId}`,
      category: "blocked",
      title: workOrder.workOrderType.replaceAll("_", " "),
      summary: `Work Order ${workOrder.status}`,
      href: workOrder.planningReviewHref,
    })
  }

  return items.slice(0, ACTIVE_WORK_LIMIT)
}

function buildActivityTimeline(commandCenter: AiOsCommandCenterReadModel): AiOsOperationsActivityTimelineItem[] {
  const items: AiOsOperationsActivityTimelineItem[] = []

  for (const event of commandCenter.recentActivity) {
    items.push({
      id: `cc-${event.eventId}`,
      source: "command_center",
      title: event.title,
      summary: event.summary,
      occurredAt: event.occurredAt,
      href: event.missionId ? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/missions/${event.missionId}/planning` : null,
    })
  }

  for (const event of commandCenter.executiveBrainActivity) {
    items.push({
      id: `eb-${event.eventId}`,
      source: "executive_brain",
      title: event.eventType.replaceAll(".", " "),
      summary: event.summary,
      occurredAt: event.occurredAt,
      href: event.missionId ? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/missions/${event.missionId}/planning` : null,
    })
  }

  for (const event of commandCenter.agentEvents.latestEvents) {
    items.push({
      id: `ae-${event.eventId}`,
      source: "agent_event",
      title: event.eventType.replaceAll("_", " "),
      summary: event.triggeringReason,
      occurredAt: event.timestamp,
      href: event.leadId ? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${event.leadId}` : null,
    })
  }

  for (const run of commandCenter.autonomousResearchPilot.recentRuns) {
    items.push({
      id: `ar-${run.runId}`,
      source: "autonomous_research",
      title: `Research run · ${run.outcome}`,
      summary: run.researchSummary ?? run.skipReason ?? run.companyName ?? run.leadId,
      occurredAt: run.completedAt,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${run.leadId}`,
    })
  }

  for (const run of commandCenter.autonomousQualificationPilot.recentRuns) {
    items.push({
      id: `aq-${run.runId}`,
      source: "autonomous_qualification",
      title: `Qualification run · ${run.outcome}`,
      summary: run.reasoning ?? run.skipReason ?? `${run.qualificationStatus ?? run.outcome} · ${run.companyName ?? run.leadId}`,
      occurredAt: run.completedAt,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${run.leadId}`,
    })
  }

  for (const run of commandCenter.autonomousPlanningPilot.recentRuns) {
    items.push({
      id: `ap-${run.runId}`,
      source: "autonomous_planning",
      title: `Planning run · ${run.outcome}`,
      summary: run.reasoning ?? run.skipReason ?? `${run.workflowType ?? run.outcome} · ${run.companyName ?? run.leadId}`,
      occurredAt: run.completedAt,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${run.leadId}`,
    })
  }

  for (const runtime of commandCenter.executionRuntime.activeExecutions.slice(0, 6)) {
    items.push({
      id: `rt-${runtime.executionId}`,
      source: "runtime",
      title: `Runtime · ${runtime.state}`,
      summary: runtime.blockReason ?? `${runtime.stepsCompleted}/${runtime.stepsTotal} steps`,
      occurredAt: runtime.updatedAt,
      href: runtime.observationHref ?? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${runtime.leadId}`,
    })
  }

  for (const orchestration of commandCenter.revenueOperator.orchestrations.slice(0, 6)) {
    items.push({
      id: `ro-${orchestration.leadId}-${orchestration.owningAgent}`,
      source: "revenue_operator",
      title: `Revenue Operator · ${orchestration.orchestrationDecision.replaceAll("_", " ")}`,
      summary: orchestration.recommendedNextAction,
      occurredAt: orchestration.evaluationTimestamp,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${orchestration.leadId}`,
    })
  }

  for (const action of commandCenter.growthLeadResearchWorkflow.recommendedNextActions.slice(0, 4)) {
    items.push({
      id: `wf-${action.leadId}`,
      source: "workflow",
      title: "Workflow recommendation",
      summary: action.action,
      occurredAt: commandCenter.generatedAt,
      href: action.observationHref,
    })
  }

  items.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
  return items.slice(0, ACTIVITY_LIMIT)
}

function buildHealthSummary(commandCenter: AiOsCommandCenterReadModel): AiOsOperationsHealthSummary {
  const healthyAgents = commandCenter.agentHealth.agents.filter(
    (agent) => agent.healthStatus === "healthy" && !agent.stale,
  ).length
  const totalAgents = commandCenter.agentHealth.agents.length
  const blockedAgents = commandCenter.agentHealth.agents.filter(
    (agent) => agent.stale || agent.healthStatus !== "healthy",
  ).length
  const agentHealthyRatio = totalAgents === 0 ? 1 : healthyAgents / totalAgents
  const schedulerBlocked =
    commandCenter.schedulerReadiness.summary.activationStatus.startsWith("blocked") ||
    commandCenter.schedulerReadiness.summary.blockedReasonCount > 0

  const overallStatus = resolveOverallHealth({
    agentHealthyRatio,
    providerReady: commandCenter.providerHealth.ready,
    blockedAgents,
    schedulerBlocked,
  })

  const budgetHour =
    commandCenter.autonomousResearchPilot.telemetry.budgetConsumptionHour +
    commandCenter.autonomousQualificationPilot.telemetry.budgetConsumptionHour +
    commandCenter.autonomousPlanningPilot.telemetry.budgetConsumptionHour
  const budgetDay =
    commandCenter.autonomousResearchPilot.telemetry.budgetConsumptionDay +
    commandCenter.autonomousQualificationPilot.telemetry.budgetConsumptionDay +
    commandCenter.autonomousPlanningPilot.telemetry.budgetConsumptionDay
  const budgetMaxHour =
    commandCenter.autonomousResearchPilot.budgetLimits.maxRunsPerHour +
    commandCenter.autonomousQualificationPilot.budgetLimits.maxRunsPerHour +
    commandCenter.autonomousPlanningPilot.budgetLimits.maxRunsPerHour
  const budgetMaxDay =
    commandCenter.autonomousResearchPilot.budgetLimits.maxRunsPerDay +
    commandCenter.autonomousQualificationPilot.budgetLimits.maxRunsPerDay +
    commandCenter.autonomousPlanningPilot.budgetLimits.maxRunsPerDay

  return {
    overallStatus,
    agentHealthLabel: `${healthyAgents}/${totalAgents} agents healthy`,
    runtimeHealthLabel: commandCenter.executionRuntime.systemSummary.failedCount > 0
      ? `${commandCenter.executionRuntime.systemSummary.failedCount} failed execution(s)`
      : `${commandCenter.executionRuntime.systemSummary.activeCount} active execution(s)`,
    queueHealthLabel: `${commandCenter.pendingWorkOrders.length} pending · ${commandCenter.approvalWorkOrders.length} awaiting approval`,
    schedulerReadinessLabel: commandCenter.schedulerReadiness.summary.activationStatus.replaceAll("_", " "),
    budgetUsageLabel: `${budgetHour}/${budgetMaxHour} hourly · ${budgetDay}/${budgetMaxDay} daily`,
    safeModeLabel: resolveSafeModeLabel(commandCenter.safeMode),
    blockedAgentsCount: blockedAgents,
  }
}

function buildApprovalSummary(
  commandCenter: AiOsCommandCenterReadModel,
  supplement: AiOsOperationsDashboardSupplement,
): AiOsOperationsApprovalSummary {
  const executionPlanCount = commandCenter.executionPlanReviewQueue.filter(
    (item) => item.approvalStatus === "pending_review",
  ).length
  const workOrderCount = commandCenter.approvalWorkOrders.length
  const automationCount = supplement.automationApprovalCount

  const categories = [
    {
      id: "execution_plans" as const,
      label: "Execution plans",
      count: executionPlanCount,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}#execution-plan-review`,
    },
    {
      id: "work_orders" as const,
      label: "Work Orders",
      count: workOrderCount,
      href: `${GROWTH_AI_OS_PUBLIC_BASE_PATH}#work-order-queues`,
    },
    {
      id: "automation" as const,
      label: "Automation approvals",
      count: automationCount,
      href: "/growth/activity",
    },
    {
      id: "outreach" as const,
      label: "Outreach approvals",
      count: 0,
      href: "/admin/growth/outreach/approval",
    },
  ]

  return {
    totalCount: categories.reduce((sum, category) => sum + category.count, 0),
    categories,
  }
}

function buildMissionPriorities(commandCenter: AiOsCommandCenterReadModel): AiOsOperationsMissionPriorityRow[] {
  return commandCenter.missionPriority.rankedMissions.slice(0, TOP_PRIORITY_LIMIT).map((ranked, index) => ({
    rank: index + 1,
    priorityLabel: priorityLabelFromBucket(ranked.queueBucket),
    ownerAgent: missionOwnerLookup(commandCenter, ranked.missionId),
    missionLabel: ranked.companyName ?? missionLabelLookup(commandCenter, ranked.missionId),
    roiLabel: roiLabelFromScore(ranked.priority.estimatedRoi),
    urgency: urgencyFromScore(ranked.priority.urgencyScore),
    blockers: ranked.blockers.slice(0, 3),
    href: ranked.leadId ? `${GROWTH_AI_OS_PUBLIC_BASE_PATH}/pilot/lead-research/${ranked.leadId}` : null,
    queueBucket: ranked.queueBucket,
  }))
}

function buildActiveObjectives(commandCenter: AiOsCommandCenterReadModel): AiOsOperationsObjectiveRow[] {
  const stalledMissionIds = new Set(
    commandCenter.missionFramework.missions
      .filter((mission) => mission.health.state === "stalled")
      .map((mission) => mission.missionId),
  )

  return commandCenter.activeMissions.map((mission) => {
    const stalled = stalledMissionIds.has(mission.missionId) || mission.progressPercent < 5
    const remaining = Math.max(0, 100 - mission.progressPercent)
    const forecast =
      mission.progressPercent >= 100
        ? "Complete"
        : remaining <= 25
          ? "Near completion"
          : remaining <= 50
            ? "On track this period"
            : "Extended timeline likely"

    const aiContribution =
      mission.activeWorkOrderCount > 0
        ? `${mission.activeWorkOrderCount} active AI Work Order(s)`
        : "Monitoring objective progress"

    return {
      objectiveId: mission.missionId,
      title: mission.title,
      progressPercent: mission.progressPercent,
      aiContributionLabel: aiContribution,
      stalled,
      completionForecastLabel: forecast,
      href: mission.planningReviewHref,
    }
  })
}

function buildEngineeringDiagnostics(
  commandCenter: AiOsCommandCenterReadModel,
): AiOsOperationsEngineeringDiagnosticSummary[] {
  return [
    {
      id: "agent-framework",
      label: "Agent Framework",
      statusLabel: `${commandCenter.agentFramework.summary.totalAgents} agents defined`,
      detail: `${commandCenter.agentFramework.summary.disabledAgents} disabled`,
      count: commandCenter.agentFramework.summary.totalAgents,
    },
    {
      id: "agent-events",
      label: "Agent Events",
      statusLabel: `${commandCenter.agentEvents.summary.pending} pending`,
      detail: `${commandCenter.agentEvents.summary.blocked} blocked events`,
      count: commandCenter.agentEvents.summary.totalEvents,
    },
    {
      id: "agent-memory",
      label: "Agent Memory",
      statusLabel: `${commandCenter.agentMemory.summary.leadsIndexed} leads indexed`,
      detail: `${commandCenter.agentMemory.summary.conflictsDetected} conflicts`,
      count: commandCenter.agentMemory.summary.leadsIndexed,
    },
    {
      id: "scheduler-readiness",
      label: "Scheduler Readiness",
      statusLabel: commandCenter.schedulerReadiness.summary.activationStatus.replaceAll("_", " "),
      detail: `${commandCenter.schedulerReadiness.summary.blockedReasonCount} blockers`,
      count: commandCenter.schedulerReadiness.summary.wakeRulesDefined,
    },
    {
      id: "boundary-audit",
      label: "Boundary Audit",
      statusLabel: commandCenter.executionBoundaryAudit.systemSummary.systemRiskLevel,
      detail: commandCenter.executionBoundaryAudit.systemSummary.headline,
      count: commandCenter.executionBoundaryAudit.systemSummary.workflowsAudited,
    },
    {
      id: "preflight",
      label: "Preflight",
      statusLabel: `${commandCenter.executionPreflightChecklist.systemSummary.preflightPassedCount} passed`,
      detail: `${commandCenter.executionPreflightChecklist.systemSummary.blockedCount} blocked`,
      count: commandCenter.executionPreflightChecklist.systemSummary.workflowsChecked,
    },
    {
      id: "simulation",
      label: "Simulation",
      statusLabel: `${commandCenter.executionSimulation.systemSummary.successCount} success`,
      detail: `${commandCenter.executionSimulation.systemSummary.blockedCount} blocked`,
      count: commandCenter.executionSimulation.systemSummary.simulationsGenerated,
    },
    {
      id: "readiness",
      label: "Readiness",
      statusLabel: `${commandCenter.approvedPlanReadinessQueue.length} in queue`,
      detail: "Approved plan readiness",
      count: commandCenter.approvedPlanReadinessQueue.length,
    },
    {
      id: "handoff",
      label: "Handoff",
      statusLabel: `${commandCenter.futureExecutionHandoffContracts.length} contracts`,
      detail: "Future execution handoff",
      count: commandCenter.futureExecutionHandoffContracts.length,
    },
  ]
}

export function synthesizeAiOsOperationsDashboard(
  commandCenter: AiOsCommandCenterReadModel,
  supplement: AiOsOperationsDashboardSupplement = { automationApprovalCount: 0 },
  policy?: GrowthAiOsAutonomyPolicyReadModel,
): AiOsOperationsDashboardReadModel {
  return {
    readOnly: true,
    qaMarker: GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER,
    generatedAt: commandCenter.generatedAt,
    executiveOverview: buildExecutiveOverview(commandCenter, policy),
    autonomyState: buildAutonomyStateSummary(policy),
    activeWork: buildActiveWork(commandCenter),
    activityTimeline: buildActivityTimeline(commandCenter),
    healthSummary: buildHealthSummary(commandCenter),
    approvalSummary: buildApprovalSummary(commandCenter, supplement),
    missionPriorities: buildMissionPriorities(commandCenter),
    activeObjectives: buildActiveObjectives(commandCenter),
    engineeringDiagnostics: buildEngineeringDiagnostics(commandCenter),
    dailyBriefing: commandCenter.dailyBriefing,
  }
}

export { AI_OS_OPERATIONS_DASHBOARD_RUNTIME_RULE }
