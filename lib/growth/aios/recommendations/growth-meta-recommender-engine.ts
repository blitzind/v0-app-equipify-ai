/** GE-AI-2F — Meta-Recommender engine (client-safe, deterministic). */

import type { AiOsCommandCenterAttentionItem } from "@/lib/growth/aios/ai-os-command-center-types"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import type { RevenueOperatorOrchestrationRecord } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type { GrowthMissionAllocationRecommendation } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import {
  GROWTH_META_RECOMMENDER_QA_MARKER,
  GROWTH_META_RECOMMENDER_RANKING_FORMULA,
  GROWTH_META_RECOMMENDER_RUNTIME_RULE,
  type GrowthMetaRecommendation,
  type GrowthMetaRecommendationPolicy,
  type GrowthMetaRecommendationScope,
  type GrowthMetaRecommendationType,
  type GrowthMetaRecommenderPolicyContext,
  type GrowthMetaRecommenderReadModel,
  type GrowthMetaRecommenderRevenueOperatorBinding,
} from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"

export type GrowthMetaRecommenderInput = {
  organizationId: string
  generatedAt: string
  commandCenter: Omit<
    AiOsCommandCenterReadModel,
    "dailyBriefing" | "operationsDashboard" | "autonomyPolicy" | "metaRecommender"
  >
  policyContext?: GrowthMetaRecommenderPolicyContext
  metaCoefficients?: {
    impact: number
    urgency: number
    confidence: number
    effort: number
  }
  topLimit?: number
  totalLimit?: number
}

const EXTERNAL_ACTION_TYPES = new Set<GrowthMetaRecommendationType>([
  "call",
  "sms",
  "email",
  "video",
  "prepare_outreach",
  "prepare_meeting",
  "follow_up",
])

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeGrowthMetaRecommendationScore(input: {
  impact: number
  urgency: number
  confidence: number
  effort: number
  coefficients?: {
    impact: number
    urgency: number
    confidence: number
    effort: number
  }
}): number {
  const coefficients = input.coefficients ?? {
    impact: 0.35,
    urgency: 0.25,
    confidence: 0.25,
    effort: 0.15,
  }
  const raw =
    input.impact * coefficients.impact +
    input.urgency * coefficients.urgency +
    input.confidence * coefficients.confidence -
    input.effort * coefficients.effort
  return clampScore(raw)
}

function stableRecommendationId(parts: Array<string | number | null | undefined>): string {
  const fingerprint = parts.map((part) => String(part ?? "")).join("|")
  let hash = 0
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash << 5) - hash + fingerprint.charCodeAt(index)
    hash |= 0
  }
  return `meta-rec-${Math.abs(hash).toString(36)}`
}

function severityToUrgency(severity: "high" | "medium" | "low"): number {
  if (severity === "high") return 90
  if (severity === "medium") return 60
  return 35
}

function policyForRecommendation(input: {
  recommendationType: GrowthMetaRecommendationType
  policyContext?: GrowthMetaRecommenderPolicyContext
  blockedReason?: string | null
}): GrowthMetaRecommendationPolicy {
  const requiresHumanApproval =
    EXTERNAL_ACTION_TYPES.has(input.recommendationType) || input.recommendationType === "review"

  let autonomyCapability: string | undefined
  if (input.recommendationType === "research") autonomyCapability = "research"
  if (input.recommendationType === "qualify") autonomyCapability = "qualification"
  if (input.recommendationType === "prepare_outreach") autonomyCapability = "outreach_preparation"
  if (input.recommendationType === "prepare_meeting") autonomyCapability = "meeting_preparation"
  if (input.recommendationType === "call") autonomyCapability = "email_execution"

  let blockedReason = input.blockedReason ?? undefined
  if (input.policyContext?.emergencyStopActive) {
    blockedReason = "Emergency stop active — configure in Growth Autonomy."
  } else if (input.policyContext && !input.policyContext.autonomyEnabled && autonomyCapability) {
    blockedReason = "Autonomy disabled by platform policy."
  }

  return {
    requiresHumanApproval,
    autonomyCapability,
    blockedReason,
  }
}

function mapAttentionKindToType(kind: AiOsCommandCenterAttentionItem["kind"]): GrowthMetaRecommendationType {
  switch (kind) {
    case "approval_required":
      return "review"
    case "blocked_work_order":
      return "escalate"
    case "mission_stalled":
      return "pause"
    case "agent_unhealthy":
    case "provider_degraded":
      return "monitor"
    case "pilot_attention":
      return "monitor"
    default:
      return "review"
  }
}

function mapOrchestrationDecisionToType(
  decision: RevenueOperatorOrchestrationRecord["orchestrationDecision"],
): GrowthMetaRecommendationType {
  switch (decision) {
    case "handoff_to_research":
      return "research"
    case "handoff_to_qualification":
      return "qualify"
    case "handoff_to_planning":
      return "prioritize"
    case "handoff_to_execution":
      return "optimize"
    case "handoff_to_meeting":
      return "prepare_meeting"
    case "human_review_required":
      return "review"
    case "blocked":
      return "escalate"
    case "continue_current_agent":
      return "monitor"
    default:
      return "monitor"
  }
}

function mapLeadActionToType(action: string): GrowthMetaRecommendationType {
  const normalized = action.toLowerCase()
  if (normalized.includes("call")) return "call"
  if (normalized.includes("email") || normalized.includes("outreach")) return "prepare_outreach"
  if (normalized.includes("meeting")) return "prepare_meeting"
  if (normalized.includes("research")) return "research"
  if (normalized.includes("qualif")) return "qualify"
  if (normalized.includes("follow")) return "follow_up"
  if (normalized.includes("review") || normalized.includes("approve")) return "review"
  if (normalized.includes("escalat")) return "escalate"
  return "monitor"
}

function queueBucketToUrgency(bucket: GrowthMissionAllocationRecommendation["queueBucket"]): number {
  switch (bucket) {
    case "immediate":
      return 95
    case "today":
      return 80
    case "this_week":
      return 55
    case "backlog":
      return 35
    case "archive_candidate":
      return 20
    default:
      return 40
  }
}

export function collectAttentionRecommendations(
  input: GrowthMetaRecommenderInput,
): GrowthMetaRecommendation[] {
  return input.commandCenter.needsAttention.map((item) => {
    const recommendationType = mapAttentionKindToType(item.kind)
    const urgency = severityToUrgency(item.severity)
    const impact = item.kind === "approval_required" ? 95 : item.kind === "blocked_work_order" ? 90 : 70
    const confidence = 85
    const effort = item.kind === "approval_required" ? 25 : 40
    const policy = policyForRecommendation({ recommendationType, policyContext: input.policyContext })

    return {
      id: stableRecommendationId(["attention", item.id, recommendationType]),
      organizationId: input.organizationId,
      scope: item.leadId ? "lead" : item.missionId ? "objective" : "system",
      subjectId: item.leadId ?? item.missionId ?? undefined,
      recommendationType,
      title: item.title,
      summary: item.summary,
      confidence,
      urgency,
      impact,
      effort,
      score: computeGrowthMetaRecommendationScore({ impact, urgency, confidence, effort }),
      evidence: [
        { source: "command_center.needs_attention", label: "Attention kind", value: item.kind },
        { source: "command_center.needs_attention", label: "Severity", value: item.severity },
      ],
      suggestedAction: item.href
        ? {
            label: "Open in workspace",
            actionType: recommendationType,
            requiresHumanApproval: policy.requiresHumanApproval,
            route: item.href,
          }
        : undefined,
      policy,
      createdAt: input.generatedAt,
    }
  })
}

export function collectApprovalWorkOrderRecommendations(
  input: GrowthMetaRecommenderInput,
): GrowthMetaRecommendation[] {
  return input.commandCenter.approvalWorkOrders.map((workOrder) => {
    const recommendationType: GrowthMetaRecommendationType = "review"
    const urgency = clampScore(workOrder.priority)
    const impact = 92
    const confidence = 88
    const effort = 30
    const policy = policyForRecommendation({ recommendationType, policyContext: input.policyContext })

    return {
      id: stableRecommendationId(["approval-wo", workOrder.workOrderId, recommendationType]),
      organizationId: input.organizationId,
      scope: "objective",
      subjectId: workOrder.missionId,
      recommendationType,
      title: `Approve ${workOrder.workOrderType.replaceAll("_", " ")}`,
      summary: `Work Order ${workOrder.workOrderId.slice(0, 8)} is ${workOrder.status.replaceAll("_", " ")}.`,
      confidence,
      urgency,
      impact,
      effort,
      score: computeGrowthMetaRecommendationScore({ impact, urgency, confidence, effort }),
      evidence: [
        { source: "ai_work_orders", label: "Work order type", value: workOrder.workOrderType },
        { source: "ai_work_orders", label: "Status", value: workOrder.status },
        { source: "ai_work_orders", label: "Priority", value: workOrder.priority },
      ],
      suggestedAction: workOrder.planningReviewHref
        ? {
            label: "Mission Planning Review",
            actionType: recommendationType,
            requiresHumanApproval: true,
            route: workOrder.planningReviewHref,
          }
        : undefined,
      policy,
      createdAt: input.generatedAt,
    }
  })
}

export function collectMissionPriorityRecommendations(
  input: GrowthMetaRecommenderInput,
): GrowthMetaRecommendation[] {
  return input.commandCenter.missionPriority.rankedMissions.slice(0, 12).map((ranked) => {
    const recommendationType: GrowthMetaRecommendationType =
      ranked.allocationStatus === "abandon_recommended"
        ? "abandon"
        : ranked.allocationStatus === "blocked"
          ? "escalate"
          : "prioritize"
    const urgency = queueBucketToUrgency(ranked.queueBucket)
    const impact = clampScore(ranked.priority.estimatedRoi * 100)
    const confidence = clampScore(ranked.priority.confidenceScore * 100)
    const effort = clampScore(ranked.priority.effortScore * 100)
    const policy = policyForRecommendation({ recommendationType, policyContext: input.policyContext })

    return {
      id: stableRecommendationId(["mission-priority", ranked.missionId, recommendationType]),
      organizationId: input.organizationId,
      scope: "objective",
      subjectId: ranked.missionId,
      recommendationType,
      title: `${ranked.companyName ?? ranked.leadId} — ${ranked.missionType.replaceAll("_", " ")}`,
      summary: ranked.recommendedAction,
      confidence,
      urgency,
      impact,
      effort,
      score: computeGrowthMetaRecommendationScore({ impact, urgency, confidence, effort }),
      evidence: [
        { source: "mission_priority", label: "Queue bucket", value: ranked.queueBucket },
        { source: "mission_priority", label: "Overall priority", value: ranked.priority.overallPriority },
        { source: "mission_priority", label: "ROI estimate", value: ranked.priority.estimatedRoi },
      ],
      suggestedAction: {
        label: "Review mission priority",
        actionType: recommendationType,
        requiresHumanApproval: recommendationType !== "prioritize",
        route: `/growth/os/missions/${ranked.missionId}/planning`,
      },
      policy,
      createdAt: input.generatedAt,
    }
  })
}

export function collectRevenueOperatorRecommendations(
  input: GrowthMetaRecommenderInput,
): GrowthMetaRecommendation[] {
  return input.commandCenter.revenueOperator.orchestrations.slice(0, 12).map((orchestration) => {
    const recommendationType = mapOrchestrationDecisionToType(orchestration.orchestrationDecision)
    const urgency =
      orchestration.escalationLevel === "critical"
        ? 95
        : orchestration.escalationLevel === "high"
          ? 85
          : orchestration.escalationLevel === "medium"
            ? 65
            : 45
    const impact = orchestration.orchestrationDecision === "human_review_required" ? 90 : 75
    const confidence = clampScore(orchestration.confidence * 100)
    const effort = orchestration.orchestrationDecision === "continue_current_agent" ? 20 : 45
    const policy = policyForRecommendation({
      recommendationType,
      policyContext: input.policyContext,
      blockedReason: orchestration.policyBlockReasons?.[0] ?? orchestration.blockedReasons[0] ?? null,
    })

    return {
      id: stableRecommendationId(["revenue-operator", orchestration.orchestrationId, recommendationType]),
      organizationId: input.organizationId,
      scope: "lead",
      subjectId: orchestration.leadId,
      recommendationType,
      title: `${orchestration.companyName ?? orchestration.leadId} — ${orchestration.recommendedNextAction}`,
      summary: orchestration.reasoning,
      confidence,
      urgency,
      impact,
      effort,
      score: computeGrowthMetaRecommendationScore({ impact, urgency, confidence, effort }),
      evidence: [
        { source: "revenue_operator", label: "Decision", value: orchestration.orchestrationDecision },
        { source: "revenue_operator", label: "Next agent", value: orchestration.recommendedNextAgent },
        { source: "revenue_operator", label: "Lifecycle stage", value: orchestration.currentLifecycleStage },
      ],
      suggestedAction: {
        label: orchestration.recommendedNextAction,
        actionType: recommendationType,
        requiresHumanApproval: policy.requiresHumanApproval,
        route: `/growth/os/pilot/lead-research/${orchestration.leadId}`,
      },
      policy,
      createdAt: input.generatedAt,
    }
  })
}

export function collectLeadResearchWorkflowRecommendations(
  input: GrowthMetaRecommenderInput,
): GrowthMetaRecommendation[] {
  const fromActions = input.commandCenter.growthLeadResearchWorkflow.recommendedNextActions.map((entry) => {
    const recommendationType = mapLeadActionToType(entry.action)
    const urgency = entry.priority === "high" ? 85 : entry.priority === "medium" ? 60 : 40
    const impact = 78
    const confidence = 80
    const effort = recommendationType === "research" ? 55 : 40
    const policy = policyForRecommendation({ recommendationType, policyContext: input.policyContext })

    return {
      id: stableRecommendationId(["lead-research-nba", entry.leadId, entry.action]),
      organizationId: input.organizationId,
      scope: "lead" as GrowthMetaRecommendationScope,
      subjectId: entry.leadId,
      recommendationType,
      title: `${entry.companyName ?? entry.leadId} — ${entry.action}`,
      summary: entry.reason,
      confidence,
      urgency,
      impact,
      effort,
      score: computeGrowthMetaRecommendationScore({ impact, urgency, confidence, effort }),
      evidence: [
        { source: "growth_lead_research_workflow", label: "Recommended action", value: entry.action },
        { source: "growth_lead_research_workflow", label: "Priority", value: entry.priority ?? "unknown" },
      ],
      suggestedAction: {
        label: entry.action,
        actionType: recommendationType,
        requiresHumanApproval: policy.requiresHumanApproval,
        route: entry.observationHref,
      },
      policy,
      createdAt: input.generatedAt,
    }
  })

  const fromAssessed = input.commandCenter.growthLeadResearchWorkflow.assessedLeads.slice(0, 8).map((lead) => {
    const recommendationType = mapLeadActionToType(lead.recommendedNextAction ?? lead.nextBestAction ?? "monitor")
    const urgency = lead.priority === "high" ? 80 : 55
    const impact = clampScore((lead.opportunityScore ?? lead.fitScore ?? 0.5) * 100)
    const confidence = clampScore((lead.confidence ?? 0.7) * 100)
    const effort = 45
    const policy = policyForRecommendation({ recommendationType, policyContext: input.policyContext })

    return {
      id: stableRecommendationId(["lead-research-assessed", lead.leadId, recommendationType]),
      organizationId: input.organizationId,
      scope: "lead" as GrowthMetaRecommendationScope,
      subjectId: lead.leadId,
      recommendationType,
      title: `${lead.companyName ?? lead.leadId} — assessed lead follow-up`,
      summary: lead.recommendedNextAction ?? lead.recommendation ?? "Review assessed lead workflow state.",
      confidence,
      urgency,
      impact,
      effort,
      score: computeGrowthMetaRecommendationScore({ impact, urgency, confidence, effort }),
      evidence: [
        { source: "growth_lead_research_workflow", label: "Workflow status", value: lead.workflowStatus },
        { source: "growth_lead_research_workflow", label: "Fit score", value: lead.fitScore ?? "n/a" },
        { source: "growth_lead_research_workflow", label: "Opportunity score", value: lead.opportunityScore ?? "n/a" },
      ],
      suggestedAction: {
        label: "Open lead observation",
        actionType: recommendationType,
        requiresHumanApproval: policy.requiresHumanApproval,
        route: lead.observationHref,
      },
      policy,
      createdAt: input.generatedAt,
    }
  })

  return [...fromActions, ...fromAssessed]
}

export function collectExecutionPlanReviewRecommendations(
  input: GrowthMetaRecommenderInput,
): GrowthMetaRecommendation[] {
  return input.commandCenter.executionPlanReviewQueue.slice(0, 8).map((item) => {
    const recommendationType: GrowthMetaRecommendationType = "review"
    const urgency = 88
    const impact = 90
    const confidence = 82
    const effort = 35
    const policy = policyForRecommendation({ recommendationType, policyContext: input.policyContext })

    return {
      id: stableRecommendationId(["execution-plan-review", item.leadId, item.planId]),
      organizationId: input.organizationId,
      scope: "lead",
      subjectId: item.leadId,
      recommendationType,
      title: `Review execution plan — ${item.companyName ?? item.leadId}`,
      summary: item.reason,
      confidence,
      urgency,
      impact,
      effort,
      score: computeGrowthMetaRecommendationScore({ impact, urgency, confidence, effort }),
      evidence: [
        { source: "execution_plan_review", label: "Approval status", value: item.approvalStatus },
        { source: "execution_plan_review", label: "Workflow type", value: item.recommendedWorkflow },
      ],
      suggestedAction: item.observationHref
        ? {
            label: "Execution plan review",
            actionType: recommendationType,
            requiresHumanApproval: true,
            route: item.observationHref,
          }
        : undefined,
      policy,
      createdAt: input.generatedAt,
    }
  })
}

export function collectStarvationRecommendations(input: GrowthMetaRecommenderInput): GrowthMetaRecommendation[] {
  return input.commandCenter.missionPriority.starvationIssues.slice(0, 6).map((issue) => {
    const recommendationType: GrowthMetaRecommendationType = "escalate"
    const urgency = 85
    const impact = 80
    const confidence = 90
    const effort = 50
    const policy = policyForRecommendation({ recommendationType, policyContext: input.policyContext })

    return {
      id: stableRecommendationId(["starvation", issue.issueId, recommendationType]),
      organizationId: input.organizationId,
      scope: "objective",
      subjectId: issue.missionId,
      recommendationType,
      title: `Mission starvation — ${issue.kind.replaceAll("_", " ")}`,
      summary: issue.summary,
      confidence,
      urgency,
      impact,
      effort,
      score: computeGrowthMetaRecommendationScore({ impact, urgency, confidence, effort }),
      evidence: [
        { source: "mission_priority", label: "Starvation kind", value: issue.kind },
        { source: "mission_priority", label: "Remediation", value: issue.recommendedRemediation },
      ],
      suggestedAction: {
        label: issue.recommendedRemediation,
        actionType: recommendationType,
        requiresHumanApproval: true,
        route: `/growth/os/missions/${issue.missionId}/planning`,
      },
      policy,
      createdAt: input.generatedAt,
    }
  })
}

type MetaRecommenderSourceCollector = {
  source: string
  collect: (input: GrowthMetaRecommenderInput) => GrowthMetaRecommendation[]
}

export const GROWTH_META_RECOMMENDER_SOURCE_COLLECTORS: readonly MetaRecommenderSourceCollector[] = [
  { source: "command_center.needs_attention", collect: collectAttentionRecommendations },
  { source: "ai_work_orders.approval_queue", collect: collectApprovalWorkOrderRecommendations },
  { source: "mission_priority.ranked_missions", collect: collectMissionPriorityRecommendations },
  { source: "mission_priority.starvation", collect: collectStarvationRecommendations },
  { source: "revenue_operator.orchestrations", collect: collectRevenueOperatorRecommendations },
  { source: "growth_lead_research_workflow", collect: collectLeadResearchWorkflowRecommendations },
  { source: "execution_plan_review_queue", collect: collectExecutionPlanReviewRecommendations },
]

export function rankGrowthMetaRecommendations(
  recommendations: GrowthMetaRecommendation[],
): GrowthMetaRecommendation[] {
  return [...recommendations].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    if (right.urgency !== left.urgency) return right.urgency - left.urgency
    return left.id.localeCompare(right.id)
  })
}

export function buildGrowthMetaRecommenderRevenueOperatorBinding(input: {
  topRecommendations: GrowthMetaRecommendation[]
  orchestrations: RevenueOperatorOrchestrationRecord[]
}): GrowthMetaRecommenderRevenueOperatorBinding {
  const leadIds = new Set(
    input.topRecommendations.filter((rec) => rec.scope === "lead" && rec.subjectId).map((rec) => rec.subjectId!),
  )
  const alignedOrchestrationIds = input.orchestrations
    .filter((row) => leadIds.has(row.leadId))
    .map((row) => row.orchestrationId)

  return {
    readOnly: true,
    topRecommendationIds: input.topRecommendations.map((rec) => rec.id),
    alignedOrchestrationIds,
    summary:
      alignedOrchestrationIds.length > 0
        ? `${alignedOrchestrationIds.length} Revenue Operator orchestration(s) align with top Meta-Recommender priorities.`
        : "Top Meta-Recommender priorities are operator-attention items — no lead orchestration overlap in top set.",
  }
}

export function synthesizeGrowthMetaRecommenderReadModel(
  input: GrowthMetaRecommenderInput,
): GrowthMetaRecommenderReadModel {
  const topLimit = input.topLimit ?? 5
  const totalLimit = input.totalLimit ?? 50
  const sourcesIncluded: string[] = []
  const sourcesFailed: Array<{ source: string; message: string }> = []
  const collected: GrowthMetaRecommendation[] = []

  for (const collector of GROWTH_META_RECOMMENDER_SOURCE_COLLECTORS) {
    try {
      const rows = collector.collect(input).map((recommendation) => ({
        ...recommendation,
        score: computeGrowthMetaRecommendationScore({
          impact: recommendation.impact,
          urgency: recommendation.urgency,
          confidence: recommendation.confidence,
          effort: recommendation.effort,
          coefficients: input.metaCoefficients,
        }),
      }))
      collected.push(...rows)
      if (rows.length > 0) sourcesIncluded.push(collector.source)
    } catch (error) {
      sourcesFailed.push({
        source: collector.source,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const deduped = new Map<string, GrowthMetaRecommendation>()
  for (const recommendation of collected) {
    const existing = deduped.get(recommendation.id)
    if (!existing || existing.score < recommendation.score) {
      deduped.set(recommendation.id, recommendation)
    }
  }

  const ranked = rankGrowthMetaRecommendations([...deduped.values()])
  const topRecommendations = ranked.slice(0, topLimit)
  const recommendations = ranked.slice(0, totalLimit)

  const byScope: Partial<Record<GrowthMetaRecommendationScope, number>> = {}
  for (const recommendation of recommendations) {
    byScope[recommendation.scope] = (byScope[recommendation.scope] ?? 0) + 1
  }

  return {
    readOnly: true,
    qaMarker: GROWTH_META_RECOMMENDER_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_META_RECOMMENDER_RUNTIME_RULE,
    rankingFormula: GROWTH_META_RECOMMENDER_RANKING_FORMULA,
    topRecommendations,
    recommendations,
    sourcesIncluded,
    sourcesFailed,
    summary: {
      total: recommendations.length,
      requiringApproval: recommendations.filter((rec) => rec.policy.requiresHumanApproval).length,
      byScope,
    },
    revenueOperatorBinding: buildGrowthMetaRecommenderRevenueOperatorBinding({
      topRecommendations,
      orchestrations: input.commandCenter.revenueOperator.orchestrations,
    }),
    autonomyPolicySource: input.policyContext ? "growth-aios-consolidation-1e-autonomy-policy-v1" : undefined,
  }
}
