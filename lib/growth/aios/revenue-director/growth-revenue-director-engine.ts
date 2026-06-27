/** GE-AI-3A — Revenue Director engine (client-safe, deterministic). */

import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import type { GrowthMetaRecommendationType } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { GrowthPriorityRecommendedNextStep } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"
import {
  GROWTH_REVENUE_DIRECTOR_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_RANKING_FORMULA,
  GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE,
  type GrowthRevenueDirectorBottleneck,
  type GrowthRevenueDirectorCommandCenterSnapshot,
  type GrowthRevenueDirectorEscalation,
  type GrowthRevenueDirectorExecutiveSummary,
  type GrowthRevenueDirectorObjectiveHealth,
  type GrowthRevenueDirectorObjectivePace,
  type GrowthRevenueDirectorReadModel,
  type GrowthRevenueDirectorResourceAllocation,
  type GrowthRevenueDirectorRevenueHealth,
  type GrowthRevenueDirectorRisk,
  type GrowthRevenueDirectorWorkflowRequest,
  type GrowthRevenueDirectorWorkflowRequestType,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

export type GrowthRevenueDirectorEngineInput = {
  organizationId: string
  snapshot: GrowthRevenueDirectorCommandCenterSnapshot
  eventObservation?: {
    eventsReceived: number
    lastEventType: string | null
  }
}

function stableId(parts: Array<string | number | null | undefined>): string {
  const fingerprint = parts.map((part) => String(part ?? "")).join("|")
  let hash = 0
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash << 5) - hash + fingerprint.charCodeAt(index)
    hash |= 0
  }
  return `rev-dir-${Math.abs(hash).toString(36)}`
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function mapMetaTypeToWorkflowRequest(
  type: GrowthMetaRecommendationType,
): GrowthRevenueDirectorWorkflowRequestType | null {
  switch (type) {
    case "research":
      return "run_research"
    case "qualify":
      return "rerun_qualification"
    case "prepare_outreach":
      return "generate_outreach"
    case "review":
    case "escalate":
      return "review_approval_queue"
    case "pause":
      return "pause_objective"
    case "monitor":
      return "wait"
    default:
      return null
  }
}

function mapPriorityStepToWorkflowRequest(
  step: GrowthPriorityRecommendedNextStep,
): GrowthRevenueDirectorWorkflowRequestType | null {
  switch (step) {
    case "run_research":
      return "run_research"
    case "run_qualification":
      return "rerun_qualification"
    case "prepare_outreach":
    case "approve_outreach":
      return "generate_outreach"
    case "review_execution_plan":
      return "review_approval_queue"
    case "pause":
      return "pause_objective"
    case "monitor":
    case "run_planning":
      return "wait"
    default:
      return null
  }
}

function resolveObjectivePace(input: {
  missionStatus?: string
  blockedReasons?: string[]
  stalled?: boolean
}): GrowthRevenueDirectorObjectivePace {
  if (input.missionStatus === "completed") return "completed"
  if (input.blockedReasons && input.blockedReasons.length > 0) return "blocked"
  if (input.missionStatus === "waiting_for_human") return "waiting"
  if (input.stalled) return "behind"
  return "on_pace"
}

function resolveRevenueHealth(input: {
  blockedCount: number
  stalledCount: number
  emergencyStop: boolean
  approvalBacklog: number
}): GrowthRevenueDirectorRevenueHealth {
  if (input.emergencyStop || input.blockedCount > 2) return "blocked"
  if (input.stalledCount > 0 || input.approvalBacklog > 10) return "at_risk"
  if (input.approvalBacklog > 5) return "degraded"
  return "on_pace"
}

function buildObjectiveHealth(
  snapshot: GrowthRevenueDirectorCommandCenterSnapshot,
): GrowthRevenueDirectorObjectiveHealth[] {
  const missions = snapshot.missionFramework.missions.slice(0, 12)
  const bindingByLead = new Map(
    snapshot.priorityBinding.bindings
      .filter((binding) => binding.leadId)
      .map((binding) => [binding.leadId!, binding]),
  )

  return missions.map((mission) => {
    const binding = bindingByLead.get(mission.leadId)
    return {
      objectiveId: mission.missionId,
      title: mission.objective,
      pace: resolveObjectivePace({
        missionStatus: mission.currentStatus,
        blockedReasons: mission.blockedReasons,
        stalled: mission.health.state === "stalled",
      }),
      blockerCount: mission.blockedReasons.length,
      priorityRank: binding?.priorityRank ?? null,
      recommendedAgent: binding?.workflowAgent ?? mission.ownerAgent,
    }
  })
}

function buildBottlenecks(
  snapshot: GrowthRevenueDirectorCommandCenterSnapshot,
): GrowthRevenueDirectorBottleneck[] {
  const bottlenecks: GrowthRevenueDirectorBottleneck[] = []

  if (snapshot.humanApprovalCenter.summary.totalPending > 0) {
    bottlenecks.push({
      id: stableId(["bottleneck", "approval_backlog"]),
      label: "Approval backlog",
      severity:
        snapshot.humanApprovalCenter.summary.totalPending > 8
          ? "high"
          : snapshot.humanApprovalCenter.summary.totalPending > 3
            ? "medium"
            : "low",
      source: "human_approval_center",
      summary: `${snapshot.humanApprovalCenter.summary.totalPending} item(s) awaiting operator review.`,
    })
  }

  for (const binding of snapshot.priorityBinding.bindings.filter((row) => row.status === "starved").slice(0, 3)) {
    bottlenecks.push({
      id: stableId(["bottleneck", "starved", binding.id]),
      label: "Starved priority binding",
      severity: "medium",
      source: "priority_binding",
      summary: binding.recommendedNextStep ?? "Binding starved — resources needed.",
    })
  }

  if (snapshot.boundedAutonomousOutbound.summary.blockedScopes > 0) {
    bottlenecks.push({
      id: stableId(["bottleneck", "outbound_blocked"]),
      label: "Blocked autonomous outbound scopes",
      severity: "high",
      source: "bounded_autonomous_outbound",
      summary: `${snapshot.boundedAutonomousOutbound.summary.blockedScopes} scope(s) blocked by gates.`,
    })
  }

  if (snapshot.revenueOperator.summary.blocked > 0) {
    bottlenecks.push({
      id: stableId(["bottleneck", "revenue_operator_blocked"]),
      label: "Revenue Operator blocked leads",
      severity: "medium",
      source: "revenue_operator",
      summary: `${snapshot.revenueOperator.summary.blocked} lead orchestration(s) blocked.`,
    })
  }

  return bottlenecks.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })
}

function buildRisks(
  snapshot: GrowthRevenueDirectorCommandCenterSnapshot,
): GrowthRevenueDirectorRisk[] {
  const risks: GrowthRevenueDirectorRisk[] = []

  if (snapshot.autonomyPolicy.emergencyStopActive) {
    risks.push({
      id: stableId(["risk", "emergency_stop"]),
      label: "Emergency stop active",
      severity: "high",
      summary: "All autonomous execution is halted by platform policy.",
      mitigation: "Review Growth Autonomy control plane before resuming.",
    })
  }

  if (!isEventBusHealthy(snapshot.eventBusHealth)) {
    risks.push({
      id: stableId(["risk", "event_bus_degraded"]),
      label: "Event bus degraded",
      severity: "medium",
      summary: `${snapshot.eventBusHealth.droppedEvents} dropped event(s); review subscriber health.`,
      mitigation: "Monitor event bus health — orchestration signals may be stale.",
    })
  }

  const unhealthyAgents = snapshot.agentHealth.agents.filter(
    (agent) => agent.healthStatus === "unhealthy" || agent.stale,
  )
  if (unhealthyAgents.length > 0) {
    risks.push({
      id: stableId(["risk", "agent_unhealthy"]),
      label: "Unhealthy workflow agents",
      severity: "high",
      summary: `${unhealthyAgents.length} agent(s) report unhealthy status.`,
      mitigation: "Inspect agent runtime health before requesting new workflow runs.",
    })
  }

  return risks
}

function isEventBusHealthy(eventBusHealth: GrowthRevenueDirectorCommandCenterSnapshot["eventBusHealth"]): boolean {
  if (eventBusHealth.droppedEvents > 0) return false
  return eventBusHealth.subscriberHealth.every((row) => row.eventsFailed === 0)
}

function buildWorkflowRequests(
  input: GrowthRevenueDirectorEngineInput,
): GrowthRevenueDirectorWorkflowRequest[] {
  const { snapshot } = input
  const requests: GrowthRevenueDirectorWorkflowRequest[] = []

  for (const recommendation of snapshot.metaRecommender.topRecommendations.slice(0, 6)) {
    const requestType = mapMetaTypeToWorkflowRequest(recommendation.recommendationType)
    if (!requestType) continue
    requests.push({
      id: stableId(["wf-req", "meta", recommendation.id, requestType]),
      requestType,
      advisory: true,
      title: recommendation.title,
      summary: recommendation.summary,
      objectiveId: recommendation.scope === "objective" ? recommendation.subjectId : undefined,
      leadId: recommendation.scope === "lead" ? recommendation.subjectId : undefined,
      targetWorkflowAgent: recommendation.policy.autonomyCapability ?? "revenue_operator",
      priorityScore: clampScore(recommendation.score),
      requiresHumanApproval: recommendation.policy.requiresHumanApproval,
      evidence: recommendation.evidence.slice(0, 4).map((row) => ({
        source: row.source,
        label: row.label,
        value: row.value,
      })),
      routeHint: recommendation.suggestedAction?.route,
    })
  }

  for (const binding of snapshot.priorityBinding.bindings
    .filter((row) => row.status === "needs_approval" || row.status === "needs_review")
    .slice(0, 4)) {
    const requestType = mapPriorityStepToWorkflowRequest(binding.recommendedNextStep)
    if (!requestType) continue
    requests.push({
      id: stableId(["wf-req", "priority", binding.id, requestType]),
      requestType,
      advisory: true,
      title: `Priority: ${binding.recommendedNextStep.replace(/_/g, " ")}`,
      summary: binding.summary,
      leadId: binding.leadId,
      targetWorkflowAgent: binding.workflowAgent,
      priorityScore: clampScore(binding.priorityScore ?? 60),
      requiresHumanApproval: true,
      evidence: binding.evidence.slice(0, 3).map((row) => ({
        source: row.source,
        label: row.label,
        value: row.value,
      })),
    })
  }

  if (snapshot.communicationEngine.plans.length > 0) {
    const topPlan = snapshot.communicationEngine.plans[0]
    requests.push({
      id: stableId(["wf-req", "communication", topPlan.id]),
      requestType: "request_communication_plan",
      advisory: true,
      title: "Apply communication plan",
      summary: `Strategy ${topPlan.recommendedStrategy.replace(/_/g, " ")} for ${topPlan.subject.type}:${topPlan.subject.id}.`,
      objectiveId: topPlan.subject.type === "objective" ? topPlan.subject.id : undefined,
      leadId: topPlan.subject.type === "lead" ? topPlan.subject.id : undefined,
      targetWorkflowAgent: "outreach_preparation",
      priorityScore: clampScore(topPlan.confidence),
      requiresHumanApproval: true,
      evidence: topPlan.evidence.slice(0, 3).map((row) => ({
        source: row.source,
        label: row.label,
        value: row.value,
      })),
      routeHint: topPlan.routeHints[0]?.href,
    })
  }

  if (snapshot.humanApprovalCenter.summary.totalPending > 0) {
    requests.push({
      id: stableId(["wf-req", "approval_queue"]),
      requestType: "review_approval_queue",
      advisory: true,
      title: "Review approval queue",
      summary: `${snapshot.humanApprovalCenter.summary.totalPending} approval item(s) need operator attention.`,
      targetWorkflowAgent: "none",
      priorityScore: clampScore(snapshot.humanApprovalCenter.summary.totalPending * 8),
      requiresHumanApproval: true,
      evidence: [
        {
          source: "human_approval_center",
          label: "Pending count",
          value: snapshot.humanApprovalCenter.summary.totalPending,
        },
      ],
      routeHint: "/growth/os/approvals",
    })
  }

  if (snapshot.autonomyPolicy.emergencyStopActive || !snapshot.autonomyPolicy.killSwitches.autonomyOutboundEnabled) {
    requests.push({
      id: stableId(["wf-req", "pause_outbound"]),
      requestType: "pause_objective",
      advisory: true,
      title: "Pause outbound activity",
      summary: "Growth Autonomy restricts outbound — hold autonomous scopes until policy clears.",
      targetWorkflowAgent: "revenue_operator",
      priorityScore: 95,
      requiresHumanApproval: true,
      evidence: [
        {
          source: "autonomy_policy",
          label: "Emergency stop",
          value: snapshot.autonomyPolicy.emergencyStopActive,
        },
      ],
      routeHint: snapshot.autonomyPolicy.controlPlaneHref,
    })
  }

  return requests
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore
      }
      return left.id.localeCompare(right.id)
    })
    .slice(0, 12)
}

function buildExecutiveSummary(input: {
  snapshot: GrowthRevenueDirectorCommandCenterSnapshot
  bottlenecks: GrowthRevenueDirectorBottleneck[]
  workflowRequests: GrowthRevenueDirectorWorkflowRequest[]
}): GrowthRevenueDirectorExecutiveSummary {
  const { snapshot, bottlenecks, workflowRequests } = input
  const revenueHealth = resolveRevenueHealth({
    blockedCount: snapshot.boundedAutonomousOutbound.summary.blockedScopes + snapshot.revenueOperator.summary.blocked,
    stalledCount: snapshot.missionFramework.summary.stalled,
    emergencyStop: snapshot.autonomyPolicy.emergencyStopActive,
    approvalBacklog: snapshot.humanApprovalCenter.summary.totalPending,
    emergencyStop: snapshot.autonomyPolicy.emergencyStopActive,
  })

  const shouldPauseOutbound =
    snapshot.autonomyPolicy.emergencyStopActive ||
    !snapshot.autonomyPolicy.killSwitches.autonomyOutboundEnabled ||
    snapshot.boundedAutonomousOutbound.summary.blockedScopes > 0

  const shouldIntervene =
    snapshot.humanApprovalCenter.summary.totalPending > 0 ||
    bottlenecks.some((row) => row.severity === "high") ||
    snapshot.needsAttention.some((item) => item.severity === "high")

  const topRequest = workflowRequests[0]

  return {
    revenueHealth,
    onPace: revenueHealth === "on_pace",
    primaryFocus: topRequest?.title ?? snapshot.executiveSummary.primaryFocus,
    headline:
      topRequest?.title ??
      snapshot.executiveSummary.headline ??
      "Revenue Director monitoring — no urgent advisory requests.",
    shouldPauseOutbound,
    shouldIntervene,
  }
}

function buildResourceAllocation(
  snapshot: GrowthRevenueDirectorCommandCenterSnapshot,
): GrowthRevenueDirectorResourceAllocation {
  const topBinding = snapshot.priorityBinding.bindings
    .filter((row) => row.priorityRank !== null)
    .sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999))[0]

  const activeScope = snapshot.boundedAutonomousOutbound.activeScopes[0]

  return {
    topObjectiveId: topBinding?.objectiveId ?? topBinding?.id ?? null,
    topObjectiveTitle: topBinding?.title ?? null,
    starvedBindingCount: snapshot.priorityBinding.bindings.filter((row) => row.status === "starved").length,
    outboundActionsToday: snapshot.boundedAutonomousOutbound.summary.actionsExecutedToday,
    outboundDailyLimit: activeScope?.scope.limits.maxActionsPerDay ?? null,
    communicationTopChannel: snapshot.communicationEngine.summary.topChannel,
  }
}

function buildEscalations(
  snapshot: GrowthRevenueDirectorCommandCenterSnapshot,
): GrowthRevenueDirectorEscalation[] {
  return snapshot.needsAttention
    .filter((item) => item.severity === "high" || item.severity === "medium")
    .slice(0, 6)
    .map((item) => ({
      id: stableId(["escalation", item.id]),
      title: item.title,
      summary: item.summary,
      route: item.href ?? undefined,
      severity: item.severity === "high" ? "high" : "medium",
    }))
}

export function extractGrowthRevenueDirectorSnapshot(
  commandCenter: Omit<AiOsCommandCenterReadModel, "revenueDirector" | "revenueDirectorDecisionLedger">,
): GrowthRevenueDirectorCommandCenterSnapshot {
  return {
    generatedAt: commandCenter.generatedAt,
    executiveSummary: commandCenter.executiveSummary,
    activeMissions: commandCenter.activeMissions,
    needsAttention: commandCenter.needsAttention,
    agentHealth: commandCenter.agentHealth,
    missionFramework: commandCenter.missionFramework,
    missionPriority: commandCenter.missionPriority,
    revenueOperator: commandCenter.revenueOperator,
    metaRecommender: commandCenter.metaRecommender,
    priorityBinding: commandCenter.priorityBinding,
    humanApprovalCenter: commandCenter.humanApprovalCenter,
    communicationEngine: commandCenter.communicationEngine,
    boundedAutonomousOutbound: commandCenter.boundedAutonomousOutbound,
    eventBusHealth: commandCenter.eventBusHealth,
    autonomyPolicy: commandCenter.autonomyPolicy,
    operationsDashboard: commandCenter.operationsDashboard,
  }
}

export function synthesizeGrowthRevenueDirectorReadModel(
  input: GrowthRevenueDirectorEngineInput,
): GrowthRevenueDirectorReadModel {
  const { snapshot } = input
  const objectiveHealth = buildObjectiveHealth(snapshot)
  const bottlenecks = buildBottlenecks(snapshot)
  const risks = buildRisks(snapshot)
  const workflowRequests = buildWorkflowRequests(input)
  const executiveSummary = buildExecutiveSummary({ snapshot, bottlenecks, workflowRequests })
  const resourceAllocation = buildResourceAllocation(snapshot)
  const escalations = buildEscalations(snapshot)

  const recommendations = snapshot.metaRecommender.topRecommendations.slice(0, 5).map((rec) => ({
    id: rec.id,
    title: rec.title,
    summary: rec.summary,
    source: "meta_recommender",
  }))

  const unhealthyAgents = snapshot.agentHealth.agents.filter(
    (agent) => agent.healthStatus === "unhealthy" || agent.stale,
  ).length
  const agentHealthStatus =
    unhealthyAgents > 0 ? "unhealthy" : snapshot.agentHealth.expiredLeases > 0 ? "degraded" : "healthy"

  const eventBusHealthy = isEventBusHealthy(snapshot.eventBusHealth)

  const autonomyStatus = snapshot.autonomyPolicy.emergencyStopActive
    ? "stopped"
    : snapshot.autonomyPolicy.autonomyEnabled
      ? "enabled"
      : "restricted"

  return {
    readOnly: true,
    qaMarker: GROWTH_REVENUE_DIRECTOR_QA_MARKER,
    generatedAt: snapshot.generatedAt,
    rule: GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE,
    rankingFormula: GROWTH_REVENUE_DIRECTOR_RANKING_FORMULA,
    executiveSummary,
    objectiveHealth,
    kpis: {
      approvalBacklog: snapshot.humanApprovalCenter.summary.totalPending,
      activeAutonomousScopes: snapshot.boundedAutonomousOutbound.summary.activeScopes,
      blockedAutonomousScopes: snapshot.boundedAutonomousOutbound.summary.blockedScopes,
      activeMissions: snapshot.missionFramework.summary.active,
      stalledMissions: snapshot.missionFramework.summary.stalled,
      humanReviewRequired: snapshot.revenueOperator.summary.humanReviewRequired,
      communicationPlansGenerated: snapshot.communicationEngine.summary.plansGenerated,
      eventBusHealthy,
    },
    resourceAllocation,
    workflowRequests,
    bottlenecks,
    risks,
    escalations,
    recommendations,
    health: {
      agentHealthStatus,
      eventBusStatus: eventBusHealthy ? "healthy" : "degraded",
      autonomyStatus,
    },
    eventObservation: {
      subscriberId: "revenue_director_observer",
      eventsReceived: input.eventObservation?.eventsReceived ?? 0,
      lastEventType: input.eventObservation?.lastEventType ?? null,
    },
  }
}
