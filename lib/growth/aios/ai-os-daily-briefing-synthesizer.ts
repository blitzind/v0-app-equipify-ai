/** GE-AIOS-5D — Deterministic Daily Briefing synthesis from Command Center read model (client-safe). */

import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import { GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER } from "@/lib/growth/aios/ai-os-command-center-types"
import {
  GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER,
  type AiOsDailyBriefing,
  type AiOsDailyBriefingActionItem,
  type AiOsDailyBriefingRisk,
  type AiOsDailyBriefingSuggestedLink,
  type AiOsDailyBriefingUrgencyLevel,
  type AiOsDailyBriefingWin,
} from "@/lib/growth/aios/ai-os-daily-briefing-types"
import {
  buildAiOsMissionPlanningHref,
  buildAiOsPilotLeadResearchHref,
} from "@/lib/growth/aios/ai-os-public-routes"

const OBJECTIVES_HREF = "/growth/objectives" as const
const LEADS_HREF = "/growth/leads" as const

const WIN_EVENT_MARKERS = [
  "completed",
  "approved",
  "passed",
  "succeeded",
  "executive.work_order_proposed",
  "decision_gate_passed",
] as const

type ScoredPriority = AiOsDailyBriefingActionItem & { score: number }

function buildLeadHref(leadId: string): string {
  return `/growth/leads/${leadId}`
}

function urgencyFromSeverity(severity: "high" | "medium" | "low"): AiOsDailyBriefingUrgencyLevel {
  return severity
}

function impactForAttentionKind(
  kind: string,
): "high" | "medium" | "low" {
  if (kind === "approval_required" || kind === "blocked_work_order") return "high"
  if (kind === "mission_stalled" || kind === "agent_unhealthy") return "medium"
  return "low"
}

function attentionScore(kind: string, severity: "high" | "medium" | "low"): number {
  const kindWeight: Record<string, number> = {
    approval_required: 100,
    blocked_work_order: 95,
    mission_stalled: 85,
    agent_unhealthy: 75,
    provider_degraded: 65,
    pilot_attention: 45,
  }
  const severityWeight = severity === "high" ? 30 : severity === "medium" ? 15 : 0
  return (kindWeight[kind] ?? 40) + severityWeight
}

function stableBriefingId(source: Omit<AiOsCommandCenterReadModel, "dailyBriefing">): string {
  const fingerprint = [
    source.executiveSummary.approvalRequiredCount,
    source.executiveSummary.blockedWorkOrderCount,
    source.executiveSummary.activeMissionCount,
    source.activeMissions
      .map((mission) => mission.missionId)
      .sort()
      .join(","),
    source.needsAttention
      .map((item) => item.id)
      .sort()
      .join(","),
    source.approvalWorkOrders
      .map((workOrder) => workOrder.workOrderId)
      .sort()
      .join(","),
  ].join("|")

  let hash = 0
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash << 5) - hash + fingerprint.charCodeAt(index)
    hash |= 0
  }
  return `briefing-${Math.abs(hash).toString(36)}`
}

function mapAttentionToAction(
  item: AiOsCommandCenterReadModel["needsAttention"][number],
): ScoredPriority {
  const linkLabel =
    item.href?.includes("/planning")
      ? "Mission Planning Review"
      : item.href?.includes("/pilot/")
        ? "Pilot observation"
        : item.href?.includes("/objectives")
          ? "Objectives"
          : item.href?.includes("/leads")
            ? "Leads"
            : item.href
              ? "Open"
              : null

  return {
    id: `attention:${item.id}`,
    title: item.title,
    reason: item.summary,
    impact: impactForAttentionKind(item.kind),
    urgency: urgencyFromSeverity(item.severity),
    href: item.href,
    linkLabel,
    score: attentionScore(item.kind, item.severity),
  }
}

function mapApprovalWorkOrder(
  workOrder: AiOsCommandCenterReadModel["approvalWorkOrders"][number],
): ScoredPriority {
  return {
    id: `approval:${workOrder.workOrderId}`,
    title: `Approve ${workOrder.workOrderType.replaceAll("_", " ")}`,
    reason: `Work Order ${workOrder.workOrderId.slice(0, 8)}… is awaiting operator approval before Alden can continue.`,
    impact: "high",
    urgency: workOrder.priority >= 80 ? "high" : workOrder.priority >= 50 ? "medium" : "low",
    href: workOrder.planningReviewHref,
    linkLabel: "Mission Planning Review",
    score: 110 - Math.min(workOrder.priority, 100),
  }
}

function mapBlockedWorkOrder(
  workOrder: AiOsCommandCenterReadModel["blockedWorkOrders"][number],
): ScoredPriority {
  return {
    id: `blocked:${workOrder.workOrderId}`,
    title: `Unblock ${workOrder.workOrderType.replaceAll("_", " ")}`,
    reason: `Work Order is ${workOrder.status.replaceAll("_", " ")} and needs review before execution can resume.`,
    impact: "high",
    urgency: "high",
    href: workOrder.planningReviewHref,
    linkLabel: "Mission Planning Review",
    score: 98 - Math.min(workOrder.priority, 90),
  }
}

function buildExecutiveHeadline(source: Omit<AiOsCommandCenterReadModel, "dailyBriefing">): string {
  const { executiveSummary, safeMode } = source

  if (safeMode.emergencyStopActive) {
    return "Emergency stop is active — Alden is paused until you review safe mode and mission state."
  }
  if (executiveSummary.approvalRequiredCount > 0) {
    return `Today: approve ${executiveSummary.approvalRequiredCount} Work Order(s) so Alden can keep missions moving.`
  }
  if (executiveSummary.blockedWorkOrderCount > 0) {
    return `Today: ${executiveSummary.blockedWorkOrderCount} blocked Work Order(s) need your attention before progress continues.`
  }
  if (executiveSummary.activeMissionCount > 0) {
    return `Today: Alden is running ${executiveSummary.activeMissionCount} mission(s) — review progress and next best actions.`
  }
  return "Today: Alden is standing by — no active missions or urgent approvals."
}

function buildWhatChangedSummary(source: Omit<AiOsCommandCenterReadModel, "dailyBriefing">): string {
  const parts: string[] = []

  if (source.recentActivity.length > 0) {
    parts.push(`${source.recentActivity.length} recent AI OS event(s)`)
  }
  if (source.recentDecisionRecords.length > 0) {
    parts.push(`${source.recentDecisionRecords.length} Decision Record(s) logged`)
  }
  if (source.executiveSummary.approvalRequiredCount > 0) {
    parts.push(`${source.executiveSummary.approvalRequiredCount} Work Order(s) awaiting approval`)
  }
  if (source.executiveSummary.blockedWorkOrderCount > 0) {
    parts.push(`${source.executiveSummary.blockedWorkOrderCount} Work Order(s) blocked or escalated`)
  }
  if (source.executiveSummary.activeMissionCount > 0) {
    parts.push(`${source.executiveSummary.activeMissionCount} active mission(s)`)
  }

  if (parts.length === 0) {
    return "No material AI OS activity since the last briefing window."
  }
  return `What changed: ${parts.join(" · ")}.`
}

function isWinEvent(eventType: string, summary: string): boolean {
  const normalized = `${eventType} ${summary}`.toLowerCase()
  return WIN_EVENT_MARKERS.some((marker) => normalized.includes(marker))
}

function buildRecentWins(source: Omit<AiOsCommandCenterReadModel, "dailyBriefing">): AiOsDailyBriefingWin[] {
  const wins: AiOsDailyBriefingWin[] = []

  for (const activity of source.recentActivity) {
    if (!isWinEvent(activity.eventType, activity.summary)) continue
    wins.push({
      id: `win:event:${activity.eventId}`,
      title: activity.title,
      summary: activity.summary,
      occurredAt: activity.occurredAt,
    })
  }

  for (const record of source.recentDecisionRecords) {
    if (record.confidence < 0.75) continue
    wins.push({
      id: `win:decision:${record.decisionRecordId}`,
      title: `${record.ownerAgent} decision`,
      summary: record.explanation,
      occurredAt: record.createdAt,
    })
  }

  return wins
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 5)
}

function buildRisks(source: Omit<AiOsCommandCenterReadModel, "dailyBriefing">): AiOsDailyBriefingRisk[] {
  const risks: AiOsDailyBriefingRisk[] = []

  if (source.safeMode.emergencyStopActive) {
    risks.push({
      id: "risk:emergency-stop",
      label: "Emergency stop active",
      summary: "Autonomy is halted — missions will not advance until safe mode is cleared.",
      severity: "high",
    })
  }

  if (source.executiveSummary.blockedWorkOrderCount > 0) {
    risks.push({
      id: "risk:blocked-work-orders",
      label: "Blocked Work Orders",
      summary: `${source.executiveSummary.blockedWorkOrderCount} Work Order(s) are stuck and may stall mission outcomes.`,
      severity: "high",
    })
  }

  const unhealthyAgents = source.agentHealth.agents.filter(
    (agent) => agent.stale || agent.healthStatus !== "healthy",
  )
  if (unhealthyAgents.length > 0) {
    risks.push({
      id: "risk:agent-health",
      label: "Agent health degraded",
      summary: `${unhealthyAgents.length} agent registration(s) are stale or unhealthy.`,
      severity: unhealthyAgents.length >= 2 ? "high" : "medium",
    })
  }

  if (!source.providerHealth.ready) {
    risks.push({
      id: "risk:provider-health",
      label: "Provider runtime degraded",
      summary: "One or more AI providers are unavailable — autonomous steps may fail when invoked.",
      severity: "medium",
    })
  }

  if (source.executiveSummary.approvalRequiredCount >= 3) {
    risks.push({
      id: "risk:approval-backlog",
      label: "Approval backlog",
      summary: `${source.executiveSummary.approvalRequiredCount} approvals are queued — mission velocity may slow.`,
      severity: "medium",
    })
  }

  return risks
}

function buildRecommendedNextActions(
  priorities: AiOsDailyBriefingActionItem[],
  source: Omit<AiOsCommandCenterReadModel, "dailyBriefing">,
): AiOsDailyBriefingActionItem[] {
  const actions: AiOsDailyBriefingActionItem[] = [...priorities]

  const topMission = source.activeMissions[0]
  if (topMission) {
    actions.push({
      id: `action:mission:${topMission.missionId}`,
      title: `Review ${topMission.title}`,
      reason: `Mission is ${topMission.progressPercent}% complete with ${topMission.activeWorkOrderCount} active Work Order(s).`,
      impact: topMission.progressPercent >= 50 ? "high" : "medium",
      urgency: topMission.running ? "medium" : "low",
      href: topMission.planningReviewHref,
      linkLabel: "Mission Planning Review",
    })
  }

  const pilotLeadId = source.pilotStatus.recentLeadIds[0]
  if (pilotLeadId && source.pilotStatus.featureEnabled) {
    actions.push({
      id: `action:pilot:${pilotLeadId}`,
      title: "Observe Lead Research Pilot",
      reason: "Pilot missions are active — review latest lead evidence before approving outreach steps.",
      impact: "medium",
      urgency: "low",
      href: buildAiOsPilotLeadResearchHref(pilotLeadId),
      linkLabel: "Pilot observation",
    })
  }

  if (source.executiveSummary.activeMissionCount === 0 && source.executiveSummary.approvalRequiredCount === 0) {
    actions.push({
      id: "action:objectives",
      title: "Review Growth objectives",
      reason: "No active missions — confirm objectives and launch the next mission when ready.",
      impact: "medium",
      urgency: "low",
      href: OBJECTIVES_HREF,
      linkLabel: "Objectives",
    })
  }

  const seen = new Set<string>()
  return actions.filter((action) => {
    if (seen.has(action.id)) return false
    seen.add(action.id)
    return true
  }).slice(0, 5)
}

function buildSuggestedLinks(
  source: Omit<AiOsCommandCenterReadModel, "dailyBriefing">,
  actions: AiOsDailyBriefingActionItem[],
): AiOsDailyBriefingSuggestedLink[] {
  const links: AiOsDailyBriefingSuggestedLink[] = []
  const seen = new Set<string>()

  function pushLink(
    id: string,
    label: string,
    href: string,
    category: AiOsDailyBriefingSuggestedLink["category"],
  ) {
    if (!href || seen.has(href)) return
    seen.add(href)
    links.push({ id, label, href, category })
  }

  for (const mission of source.activeMissions.slice(0, 3)) {
    pushLink(
      `link:planning:${mission.missionId}`,
      `Mission Planning Review · ${mission.title}`,
      mission.planningReviewHref,
      "planning_review",
    )
  }

  for (const leadId of source.pilotStatus.recentLeadIds.slice(0, 3)) {
    const href = buildAiOsPilotLeadResearchHref(leadId)
    if (href) {
      pushLink(`link:pilot:${leadId}`, `Pilot observation · ${leadId.slice(0, 8)}…`, href, "pilot_observation")
    }
  }

  for (const leadId of source.pilotStatus.recentLeadIds.slice(0, 2)) {
    pushLink(`link:lead:${leadId}`, `Lead · ${leadId.slice(0, 8)}…`, buildLeadHref(leadId), "leads")
  }

  pushLink("link:objectives", "Growth objectives", OBJECTIVES_HREF, "objectives")
  pushLink("link:leads-hub", "Leads workspace", LEADS_HREF, "leads")

  for (const action of actions) {
    if (!action.href || !action.linkLabel) continue
    const category: AiOsDailyBriefingSuggestedLink["category"] = action.href.includes("/planning")
      ? "planning_review"
      : action.href.includes("/pilot/")
        ? "pilot_observation"
        : action.href.includes("/objectives")
          ? "objectives"
          : "leads"
    pushLink(`link:action:${action.id}`, action.linkLabel, action.href, category)
  }

  return links.slice(0, 8)
}

function stripScore(item: ScoredPriority): AiOsDailyBriefingActionItem {
  const { score: _score, ...action } = item
  return action
}

export type AiOsDailyBriefingSource = Omit<AiOsCommandCenterReadModel, "dailyBriefing">

export function synthesizeAiOsDailyBriefing(source: AiOsDailyBriefingSource): AiOsDailyBriefing {
  const scoredPriorities: ScoredPriority[] = [
    ...source.needsAttention.map(mapAttentionToAction),
    ...source.approvalWorkOrders.map(mapApprovalWorkOrder),
    ...source.blockedWorkOrders.map(mapBlockedWorkOrder),
  ]

  scoredPriorities.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return left.id.localeCompare(right.id)
  })

  const topPriorities = scoredPriorities.slice(0, 3).map(stripScore)

  const needsApproval = source.approvalWorkOrders
    .map(mapApprovalWorkOrder)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .map(stripScore)

  const blockers = [
    ...source.blockedWorkOrders.map(mapBlockedWorkOrder),
    ...source.needsAttention
      .filter((item) => item.kind === "blocked_work_order" || item.kind === "mission_stalled")
      .map(mapAttentionToAction),
  ]
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .map(stripScore)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 6)

  const recentWins = buildRecentWins(source)
  const risks = buildRisks(source)
  const recommendedNextActions = buildRecommendedNextActions(topPriorities, source)
  const suggestedLinks = buildSuggestedLinks(source, recommendedNextActions)

  return {
    readOnly: true,
    qaMarker: GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER,
    briefingId: stableBriefingId(source),
    generatedAt: source.generatedAt,
    executiveHeadline: buildExecutiveHeadline(source),
    whatChangedSummary: buildWhatChangedSummary(source),
    topPriorities,
    needsApproval,
    blockers,
    recentWins,
    risks,
    recommendedNextActions,
    suggestedLinks,
  }
}

/** Fixture helper for certification — builds a minimal Command Center source snapshot. */
export function buildAiOsDailyBriefingCertFixture(): AiOsDailyBriefingSource {
  const missionId = "mission-cert-fixture"
  const planningHref = buildAiOsMissionPlanningHref(missionId) ?? "/growth/os/missions/mission-cert-fixture/planning"

  return {
    readOnly: true,
    qaMarker: GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER,
    generatedAt: "2026-06-25T12:00:00.000Z",
    executiveSummary: {
      headline: "Fixture headline",
      activeMissionCount: 1,
      pendingWorkOrderCount: 2,
      approvalRequiredCount: 1,
      blockedWorkOrderCount: 1,
      recentEventCount: 3,
      primaryFocus: "Approve outreach Work Order",
    },
    activeMissions: [
      {
        missionId,
        title: "Cert Mission",
        status: "active",
        objectiveType: "demos_booked",
        currentStageId: "launch",
        running: true,
        progressPercent: 42,
        activeWorkOrderCount: 1,
        planningReviewHref: planningHref,
      },
    ],
    needsAttention: [
      {
        id: "approval:wo-1",
        kind: "approval_required",
        title: "Approve generate_email Work Order",
        summary: "Outreach draft awaits approval.",
        severity: "high",
        missionId,
        workOrderId: "wo-1",
        leadId: null,
        href: planningHref,
      },
    ],
    recentActivity: [
      {
        eventId: "evt-1",
        eventType: "work_order.status_changed",
        category: "work_order",
        title: "Work order completed",
        summary: "Work Order completed successfully",
        occurredAt: "2026-06-25T11:55:00.000Z",
        missionId,
        workOrderId: "wo-0",
      },
    ],
    executiveBrainActivity: [],
    pendingWorkOrders: [],
    approvalWorkOrders: [
      {
        workOrderId: "wo-1",
        missionId,
        workOrderType: "generate_email",
        status: "awaiting_approval",
        assignedAgent: "outreach",
        priority: 85,
        updatedAt: "2026-06-25T11:50:00.000Z",
        planningReviewHref: planningHref,
      },
    ],
    blockedWorkOrders: [
      {
        workOrderId: "wo-2",
        missionId,
        workOrderType: "verify_email",
        status: "escalated",
        assignedAgent: "research",
        priority: 70,
        updatedAt: "2026-06-25T11:45:00.000Z",
        planningReviewHref: planningHref,
      },
    ],
    recentDecisionRecords: [
      {
        decisionRecordId: "dec-1",
        missionId,
        workOrderId: "wo-0",
        ownerAgent: "executive_brain",
        explanation: "Selected launch stage outreach strategy.",
        confidence: 0.91,
        createdAt: "2026-06-25T11:40:00.000Z",
      },
    ],
    agentHealth: {
      organizationId: "org-cert",
      evaluatedAt: "2026-06-25T12:00:00.000Z",
      staleThresholdMs: 60_000,
      agents: [
        {
          registrationId: "agent-1",
          agentKey: "executive_brain",
          instanceId: "inst-1",
          healthStatus: "healthy",
          lastHeartbeatAt: "2026-06-25T11:59:00.000Z",
          stale: false,
          activeLeaseCount: 0,
        },
      ],
      expiredLeases: 0,
    },
    providerHealth: {
      organizationId: "org-cert",
      evaluatedAt: "2026-06-25T12:00:00.000Z",
      schemaReady: true,
      runtimeDegraded: false,
      degradedReason: null,
      activeProvider: "openai",
      providers: [
        {
          providerId: "openai",
          available: true,
          degraded: false,
          message: null,
        },
      ],
      ready: true,
    },
    pilotStatus: {
      featureEnabled: true,
      enableAiEvidence: true,
      activePilotMissions: 1,
      recentLeadIds: ["lead-cert-001"],
      observationHrefTemplate: "/growth/os/pilot/lead-research/{leadId}",
    },
    safeMode: {
      emergencyStopActive: false,
      objectiveModeEnabled: true,
      autonomyEnabled: true,
      killSwitches: { autonomy_enabled: true },
    },
    growthLeadResearchWorkflow: {
      workflowKey: "growth_lead_research",
      featureEnabled: true,
      statusCounts: {
        not_started: 0,
        scheduled: 0,
        researching: 1,
        research_complete: 0,
        qualified: 0,
        assessed: 1,
        blocked: 1,
        failed: 0,
      },
      activeLeads: [],
      assessedLeads: [],
      qualifiedLeads: [],
      blockedLeads: [],
      recommendedNextActions: [],
    },
    executionPlanReviewQueue: [],
    approvedPlanReadinessQueue: [],
    futureExecutionHandoffContracts: [],
    executionBoundaryAudit: {
      readOnly: true,
      qaMarker: "growth-aios-growth-2a-execution-boundary-audit-v1",
      generatedAt: "2026-06-25T12:00:00.000Z",
      workflowReports: [],
      systemSummary: {
        workflowsAudited: 0,
        futureExecutionAllowedCount: 0,
        outboundRiskWorkflows: [],
        coreRiskWorkflows: [],
        planningOnlyWorkflows: [],
        notAllowedWorkflows: [],
        missingGlobalGuardrails: [],
        systemRiskLevel: "low",
        headline: "Fixture — no boundary audit data",
      },
      planBoundaries: [],
    },
  }
}
