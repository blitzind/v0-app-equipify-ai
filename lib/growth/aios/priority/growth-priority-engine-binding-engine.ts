/** GE-AI-2E — Priority Engine Binding engine (client-safe, deterministic). */

import type { AiOsCommandCenterActiveMission, AiOsCommandCenterWorkOrderSummary } from "@/lib/growth/aios/ai-os-command-center-types"
import type { GrowthMissionType } from "@/lib/growth/aios/growth/growth-mission-framework-types"
import type {
  GrowthMissionAllocationRecommendation,
  GrowthMissionCapacityKind,
  GrowthMissionPriorityReadModel,
  GrowthMissionStarvationIssue,
} from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type { RevenueOperatorOrchestrationRecord } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type { GrowthMetaRecommendation } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import {
  GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER,
  GROWTH_PRIORITY_ENGINE_BINDING_RANKING_FORMULA,
  GROWTH_PRIORITY_ENGINE_BINDING_RULE,
  type GrowthPriorityBinding,
  type GrowthPriorityBindingBlocker,
  type GrowthPriorityBindingObjectiveContext,
  type GrowthPriorityBindingStatus,
  type GrowthPriorityEngineBindingReadModel,
  type GrowthPriorityEngineOrchestrationBinding,
  type GrowthPriorityEngineRevenueOperatorBinding,
  type GrowthPriorityRecommendedNextStep,
  type GrowthPriorityWorkflowAgent,
} from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"

export type GrowthPriorityEngineBindingInput = {
  organizationId: string
  generatedAt: string
  objectives: GrowthObjective[]
  activeMissions: AiOsCommandCenterActiveMission[]
  approvalWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  missionPriority: GrowthMissionPriorityReadModel
  metaRecommendations: GrowthMetaRecommendation[]
  orchestrations: RevenueOperatorOrchestrationRecord[]
  policyContext?: {
    emergencyStopActive: boolean
    autonomyEnabled: boolean
  }
  metaScoreMultiplier?: number
  topLimit?: number
  totalLimit?: number
}

function stableBindingId(parts: Array<string | number | null | undefined>): string {
  const fingerprint = parts.map((part) => String(part ?? "")).join("|")
  let hash = 0
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash << 5) - hash + fingerprint.charCodeAt(index)
    hash |= 0
  }
  return `priority-bind-${Math.abs(hash).toString(36)}`
}

function resolveLeadIdsForObjective(objective: GrowthObjective): string[] {
  const leadIds = new Set<string>()
  for (const signal of objective.recentSignals) {
    if (signal.leadId) leadIds.add(signal.leadId)
  }
  return [...leadIds]
}

function resolveObjectiveForLead(input: {
  leadId: string
  objectives: GrowthObjective[]
}): GrowthObjective | null {
  const matches = input.objectives.filter((objective) =>
    resolveLeadIdsForObjective(objective).includes(input.leadId),
  )
  if (matches.length === 0) return null
  const running = matches.find((row) => row.runtime?.running && row.status === "active")
  return running ?? matches.find((row) => row.status === "active") ?? matches[0] ?? null
}

function mapCapacityKindToAgent(capacityKind: GrowthMissionCapacityKind): GrowthPriorityWorkflowAgent {
  switch (capacityKind) {
    case "research_capacity":
      return "research"
    case "qualification_capacity":
      return "qualification"
    case "planning_capacity":
      return "planning"
    case "execution_capacity":
      return "execution"
    case "meeting_preparation_capacity":
      return "meeting_preparation"
    case "revenue_operator_review_capacity":
      return "revenue_operator"
    default:
      return "none"
  }
}

function mapMissionTypeToNextStep(missionType: GrowthMissionType): GrowthPriorityRecommendedNextStep {
  switch (missionType) {
    case "enrich_account":
    case "monitor_account":
      return "run_research"
    case "qualify_lead":
    case "identify_buying_committee":
      return "run_qualification"
    case "prepare_outreach":
      return "prepare_outreach"
    case "prepare_meeting":
      return "prepare_meeting"
    case "recover_failed_workflow":
      return "review_execution_plan"
    case "close_opportunity":
      return "monitor"
    default:
      return "run_planning"
  }
}

function mapAllocationStatusToBindingStatus(
  allocationStatus: GrowthMissionAllocationRecommendation["allocationStatus"],
  hasStarvation: boolean,
  hasApprovalBlocker: boolean,
): GrowthPriorityBindingStatus {
  if (hasStarvation) return "starved"
  if (hasApprovalBlocker) return "needs_approval"
  if (allocationStatus === "waiting_for_human") return "needs_approval"
  if (allocationStatus === "blocked" || allocationStatus === "abandon_recommended") return "blocked"
  if (allocationStatus === "waiting_for_prerequisite" || allocationStatus === "deferred") return "waiting"
  if (allocationStatus === "allocated") return "ready"
  return "needs_review"
}

function findMetaRecommendation(input: {
  recommendations: GrowthMetaRecommendation[]
  leadId: string
  missionId: string
  objectiveId?: string
}): GrowthMetaRecommendation | null {
  return (
    input.recommendations.find(
      (rec) =>
        rec.subjectId === input.leadId ||
        rec.subjectId === input.missionId ||
        (input.objectiveId && rec.subjectId === input.objectiveId),
    ) ?? null
  )
}

function findOrchestration(
  orchestrations: RevenueOperatorOrchestrationRecord[],
  leadId: string,
): RevenueOperatorOrchestrationRecord | null {
  return orchestrations.find((row) => row.leadId === leadId) ?? null
}

function findStarvationIssues(
  issues: GrowthMissionStarvationIssue[],
  missionId: string,
): GrowthMissionStarvationIssue[] {
  return issues.filter((issue) => issue.missionId === missionId)
}

function hasApprovalForObjective(
  approvalWorkOrders: AiOsCommandCenterWorkOrderSummary[],
  objectiveId: string | undefined,
): boolean {
  if (!objectiveId) return false
  return approvalWorkOrders.some((row) => row.missionId === objectiveId)
}

export function buildBindingFromRankedMission(input: {
  organizationId: string
  generatedAt: string
  ranked: GrowthMissionAllocationRecommendation
  priorityRank: number
  objectives: GrowthObjective[]
  approvalWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  starvationIssues: GrowthMissionStarvationIssue[]
  metaRecommendations: GrowthMetaRecommendation[]
  orchestrations: RevenueOperatorOrchestrationRecord[]
  policyContext?: GrowthPriorityEngineBindingInput["policyContext"]
  metaScoreMultiplier?: number
}): GrowthPriorityBinding {
  const objective = resolveObjectiveForLead({ leadId: input.ranked.leadId, objectives: input.objectives })
  const objectiveId = objective?.id
  const starvation = findStarvationIssues(input.starvationIssues, input.ranked.missionId)
  const approvalBlocked = hasApprovalForObjective(input.approvalWorkOrders, objectiveId)
  const metaRec = findMetaRecommendation({
    recommendations: input.metaRecommendations,
    leadId: input.ranked.leadId,
    missionId: input.ranked.missionId,
    objectiveId,
  })
  const orchestration = findOrchestration(input.orchestrations, input.ranked.leadId)

  const blockers: GrowthPriorityBindingBlocker[] = []
  for (const blocker of input.ranked.blockers) {
    blockers.push({ type: "runtime", label: blocker, severity: "medium" })
  }
  if (approvalBlocked) {
    blockers.push({
      type: "approval",
      label: "Work order awaiting human approval",
      severity: "high",
    })
  }
  for (const issue of starvation) {
    blockers.push({
      type: "starvation",
      label: issue.summary,
      severity: "high",
    })
  }
  if (input.ranked.allocationStatus === "deferred" && input.ranked.deferReason) {
    blockers.push({ type: "budget", label: input.ranked.deferReason, severity: "medium" })
  }
  if (orchestration?.policyBlockReasons?.length) {
    for (const reason of orchestration.policyBlockReasons) {
      blockers.push({ type: "policy", label: reason, severity: "high" })
    }
  } else if (orchestration?.blockedReasons.length) {
    for (const reason of orchestration.blockedReasons.slice(0, 2)) {
      blockers.push({ type: "policy", label: reason, severity: "medium" })
    }
  }
  if (metaRec?.policy.blockedReason) {
    blockers.push({ type: "policy", label: metaRec.policy.blockedReason, severity: "high" })
  }
  if (input.policyContext?.emergencyStopActive) {
    blockers.push({
      type: "policy",
      label: "Emergency stop active — configure in Growth Autonomy.",
      severity: "high",
    })
  }

  const status = mapAllocationStatusToBindingStatus(
    input.ranked.allocationStatus,
    starvation.length > 0,
    approvalBlocked || Boolean(metaRec?.policy.requiresHumanApproval && metaRec.recommendationType === "review"),
  )

  let recommendedNextStep = mapMissionTypeToNextStep(input.ranked.missionType)
  if (orchestration?.orchestrationDecision === "handoff_to_research") recommendedNextStep = "run_research"
  if (orchestration?.orchestrationDecision === "handoff_to_qualification") recommendedNextStep = "run_qualification"
  if (orchestration?.orchestrationDecision === "handoff_to_planning") recommendedNextStep = "run_planning"
  if (orchestration?.orchestrationDecision === "handoff_to_execution") recommendedNextStep = "review_execution_plan"
  if (orchestration?.orchestrationDecision === "handoff_to_meeting") recommendedNextStep = "prepare_meeting"
  if (orchestration?.orchestrationDecision === "human_review_required") recommendedNextStep = "review_execution_plan"
  if (input.ranked.allocationStatus === "abandon_recommended") recommendedNextStep = "pause"

  const workflowAgent = orchestration
    ? orchestration.recommendedNextAgent === "research_agent"
      ? "research"
      : orchestration.recommendedNextAgent === "qualification_agent"
        ? "qualification"
        : orchestration.recommendedNextAgent === "planning_agent"
          ? "planning"
          : orchestration.recommendedNextAgent === "execution_agent"
            ? "execution"
            : orchestration.recommendedNextAgent === "meeting_agent"
              ? "meeting_preparation"
              : mapCapacityKindToAgent(input.ranked.capacityKind)
    : mapCapacityKindToAgent(input.ranked.capacityKind)

  const metaScore = metaRec?.score ?? 0
  const metaMultiplier = input.metaScoreMultiplier ?? 0.15
  const priorityScore = input.ranked.priority.overallPriority + metaScore * metaMultiplier

  const route =
    metaRec?.suggestedAction?.route ??
    (objectiveId ? `/growth/os/missions/${objectiveId}/planning` : `/growth/os/pilot/lead-research/${input.ranked.leadId}`)

  return {
    id: stableBindingId(["ranked-mission", input.ranked.missionId, input.ranked.leadId]),
    organizationId: input.organizationId,
    objectiveId,
    missionId: input.ranked.missionId,
    leadId: input.ranked.leadId,
    sourceRecommendationId: metaRec?.id,
    priorityRank: input.priorityRank,
    priorityScore: Math.round(priorityScore * 100) / 100,
    status,
    recommendedNextStep,
    workflowAgent,
    title: `${input.ranked.companyName ?? input.ranked.leadId} — ${input.ranked.missionType.replaceAll("_", " ")}`,
    summary: input.ranked.recommendedAction,
    evidence: [
      { source: "mission_priority", label: "Overall priority", value: input.ranked.priority.overallPriority },
      { source: "mission_priority", label: "Queue bucket", value: input.ranked.queueBucket },
      { source: "mission_priority", label: "Allocation status", value: input.ranked.allocationStatus },
      ...(metaRec
        ? [{ source: "meta_recommender", label: "Meta score", value: metaRec.score, confidence: metaRec.confidence }]
        : []),
      ...(orchestration
        ? [{ source: "revenue_operator", label: "Orchestration decision", value: orchestration.orchestrationDecision }]
        : []),
      ...(objective ? [{ source: "growth_objectives", label: "Linked objective", value: objective.title }] : []),
    ],
    blockers,
    route,
    createdAt: input.generatedAt,
  }
}

export function buildBindingFromObjectiveAttention(input: {
  organizationId: string
  generatedAt: string
  mission: AiOsCommandCenterActiveMission
  metaRecommendations: GrowthMetaRecommendation[]
  approvalWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  policyContext?: GrowthPriorityEngineBindingInput["policyContext"]
  priorityRank: number
}): GrowthPriorityBinding | null {
  const metaRec = input.metaRecommendations.find(
    (rec) => rec.scope === "objective" && rec.subjectId === input.mission.missionId,
  )
  if (!metaRec && !input.mission.running && input.mission.activeWorkOrderCount === 0) return null

  const approvalBlocked = hasApprovalForObjective(input.approvalWorkOrders, input.mission.missionId)
  const blockers: GrowthPriorityBindingBlocker[] = []
  if (approvalBlocked) {
    blockers.push({
      type: "approval",
      label: "Work order awaiting human approval",
      severity: "high",
    })
  }
  if (metaRec?.policy.blockedReason) {
    blockers.push({ type: "policy", label: metaRec.policy.blockedReason, severity: "high" })
  }
  if (input.policyContext?.emergencyStopActive) {
    blockers.push({
      type: "policy",
      label: "Emergency stop active — configure in Growth Autonomy.",
      severity: "high",
    })
  }

  const status: GrowthPriorityBindingStatus = approvalBlocked
    ? "needs_approval"
    : metaRec?.recommendationType === "pause"
      ? "blocked"
      : metaRec?.recommendationType === "escalate"
        ? "needs_review"
        : input.mission.running
          ? "ready"
          : "waiting"

  return {
    id: stableBindingId(["objective-attention", input.mission.missionId]),
    organizationId: input.organizationId,
    objectiveId: input.mission.missionId,
    missionId: input.mission.missionId,
    sourceRecommendationId: metaRec?.id,
    priorityRank: input.priorityRank,
    priorityScore: metaRec?.score ?? (input.mission.running ? 55 : 40),
    status,
    recommendedNextStep: metaRec?.recommendationType === "review" ? "review_execution_plan" : "monitor",
    workflowAgent: "revenue_operator",
    title: input.mission.title,
    summary: metaRec?.summary ?? `Objective ${input.mission.status} — ${input.mission.activeWorkOrderCount} active work order(s).`,
    evidence: [
      { source: "growth_objectives", label: "Objective status", value: input.mission.status },
      { source: "growth_objectives", label: "Running", value: input.mission.running },
      ...(metaRec ? [{ source: "meta_recommender", label: "Meta score", value: metaRec.score }] : []),
    ],
    blockers,
    route: input.mission.planningReviewHref,
    createdAt: input.generatedAt,
  }
}

export function rankGrowthPriorityBindings(bindings: GrowthPriorityBinding[]): GrowthPriorityBinding[] {
  return [...bindings].sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore
    if (left.priorityRank !== right.priorityRank) return left.priorityRank - right.priorityRank
    return left.id.localeCompare(right.id)
  })
}

export function buildGrowthPriorityEngineRevenueOperatorBinding(input: {
  topBindings: GrowthPriorityBinding[]
  orchestrations: RevenueOperatorOrchestrationRecord[]
}): GrowthPriorityEngineRevenueOperatorBinding {
  const leadIds = new Set(input.topBindings.map((row) => row.leadId).filter(Boolean) as string[])
  const alignedOrchestrationIds = input.orchestrations
    .filter((row) => leadIds.has(row.leadId))
    .map((row) => row.orchestrationId)

  return {
    readOnly: true,
    topBindingIds: input.topBindings.map((row) => row.id),
    alignedOrchestrationIds,
    summary:
      alignedOrchestrationIds.length > 0
        ? `${alignedOrchestrationIds.length} Revenue Operator orchestration(s) align with top priority bindings.`
        : "Top priority bindings are objective or system items — no lead orchestration overlap in top set.",
  }
}

export function buildOrchestrationPriorityBindingMap(input: {
  bindings: GrowthPriorityBinding[]
  orchestrations: RevenueOperatorOrchestrationRecord[]
}): Map<string, GrowthPriorityEngineOrchestrationBinding> {
  const byLead = new Map<string, GrowthPriorityBinding>()
  for (const binding of input.bindings) {
    if (binding.leadId) byLead.set(binding.leadId, binding)
  }

  const result = new Map<string, GrowthPriorityEngineOrchestrationBinding>()
  for (const orchestration of input.orchestrations) {
    const binding = byLead.get(orchestration.leadId)
    result.set(orchestration.orchestrationId, {
      bindingId: binding?.id ?? null,
      priorityRank: binding?.priorityRank ?? null,
      priorityScore: binding?.priorityScore ?? null,
      status: binding?.status ?? null,
      recommendedNextStep: binding?.recommendedNextStep ?? null,
    })
  }
  return result
}

export function buildObjectivePriorityContexts(input: {
  objectives: GrowthObjective[]
  bindings: GrowthPriorityBinding[]
}): GrowthPriorityBindingObjectiveContext[] {
  return input.objectives
    .filter((objective) => objective.status === "active" || objective.status === "planning")
    .map((objective) => {
      const objectiveBindings = input.bindings.filter((binding) => binding.objectiveId === objective.id)
      const ranked = rankGrowthPriorityBindings(objectiveBindings)
      return {
        objectiveId: objective.id,
        title: objective.title,
        status: objective.status,
        running: objective.runtime?.running ?? false,
        topBinding: ranked[0] ?? null,
        bindings: ranked,
      }
    })
}

type PriorityBindingSourceCollector = {
  source: string
  collect: (input: GrowthPriorityEngineBindingInput) => GrowthPriorityBinding[]
}

export const GROWTH_PRIORITY_BINDING_SOURCE_COLLECTORS: readonly PriorityBindingSourceCollector[] = [
  {
    source: "mission_priority.ranked_missions",
    collect: (input) =>
      input.missionPriority.rankedMissions.slice(0, 24).map((ranked, index) =>
        buildBindingFromRankedMission({
          organizationId: input.organizationId,
          generatedAt: input.generatedAt,
          ranked,
          priorityRank: index + 1,
          objectives: input.objectives,
          approvalWorkOrders: input.approvalWorkOrders,
          starvationIssues: input.missionPriority.starvationIssues,
          metaRecommendations: input.metaRecommendations,
          orchestrations: input.orchestrations,
          policyContext: input.policyContext,
          metaScoreMultiplier: input.metaScoreMultiplier,
        }),
      ),
  },
  {
    source: "growth_objectives.active_missions",
    collect: (input) => {
      const existingObjectiveIds = new Set(
        input.missionPriority.rankedMissions
          .map((ranked) => resolveObjectiveForLead({ leadId: ranked.leadId, objectives: input.objectives })?.id)
          .filter(Boolean),
      )
      const bindings: GrowthPriorityBinding[] = []
      let rank = input.missionPriority.rankedMissions.length + 1
      for (const mission of input.activeMissions) {
        if (existingObjectiveIds.has(mission.missionId)) continue
        const binding = buildBindingFromObjectiveAttention({
          organizationId: input.organizationId,
          generatedAt: input.generatedAt,
          mission,
          metaRecommendations: input.metaRecommendations,
          approvalWorkOrders: input.approvalWorkOrders,
          policyContext: input.policyContext,
          priorityRank: rank,
        })
        if (binding) {
          bindings.push(binding)
          rank += 1
        }
      }
      return bindings
    },
  },
]

export function synthesizeGrowthPriorityEngineBindingReadModel(
  input: GrowthPriorityEngineBindingInput,
): GrowthPriorityEngineBindingReadModel {
  const topLimit = input.topLimit ?? 5
  const totalLimit = input.totalLimit ?? 50
  const sourcesIncluded: string[] = []
  const sourcesFailed: Array<{ source: string; message: string }> = []
  const collected: GrowthPriorityBinding[] = []

  for (const collector of GROWTH_PRIORITY_BINDING_SOURCE_COLLECTORS) {
    try {
      const rows = collector.collect(input)
      collected.push(...rows)
      if (rows.length > 0) sourcesIncluded.push(collector.source)
    } catch (error) {
      sourcesFailed.push({
        source: collector.source,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const deduped = new Map<string, GrowthPriorityBinding>()
  for (const binding of collected) {
    const existing = deduped.get(binding.id)
    if (!existing || existing.priorityScore < binding.priorityScore) {
      deduped.set(binding.id, binding)
    }
  }

  const ranked = rankGrowthPriorityBindings([...deduped.values()])
  const topBindings = ranked.slice(0, topLimit)
  const bindings = ranked.slice(0, totalLimit)
  const objectiveContexts = buildObjectivePriorityContexts({
    objectives: input.objectives,
    bindings,
  })

  const byStatus: Partial<Record<GrowthPriorityBindingStatus, number>> = {}
  for (const binding of bindings) {
    byStatus[binding.status] = (byStatus[binding.status] ?? 0) + 1
  }

  return {
    readOnly: true,
    qaMarker: GROWTH_PRIORITY_ENGINE_BINDING_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_PRIORITY_ENGINE_BINDING_RULE,
    rankingFormula: GROWTH_PRIORITY_ENGINE_BINDING_RANKING_FORMULA,
    topBindings,
    bindings,
    objectiveContexts,
    sourcesIncluded,
    sourcesFailed,
    summary: {
      total: bindings.length,
      starved: bindings.filter((row) => row.status === "starved").length,
      needsApproval: bindings.filter((row) => row.status === "needs_approval").length,
      blocked: bindings.filter((row) => row.status === "blocked").length,
      byStatus,
    },
    revenueOperatorBinding: buildGrowthPriorityEngineRevenueOperatorBinding({
      topBindings,
      orchestrations: input.orchestrations,
    }),
  }
}
