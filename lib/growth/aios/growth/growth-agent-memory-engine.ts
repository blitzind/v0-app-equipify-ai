/** GE-AIOS-GROWTH-4D — Agent Memory engine (client-safe, deterministic). */

import {
  GROWTH_AGENT_KINDS,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type {
  GrowthAgentKind,
  GrowthAgentRequiredGate,
} from "@/lib/growth/aios/growth/growth-agent-framework-types"
import {
  GROWTH_AGENT_KIND_PERMISSION_MAP,
  GROWTH_AGENT_PERMISSION_RULES,
  agentMayExecuteWorkflow,
} from "@/lib/growth/aios/growth/growth-agent-framework-permissions"
import { getGrowthAgentDefinition } from "@/lib/growth/aios/growth/growth-agent-framework-registry"
import { isRuntimePilotWorkflow } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import type {
  GrowthAgentContextView,
  GrowthAgentMemoryAggregationInput,
  GrowthAgentMemoryCompletenessState,
  GrowthAgentMemoryConflict,
  GrowthAgentMemoryConflictKind,
  GrowthAgentMemoryLeadBundle,
  GrowthAgentMemoryPlanContext,
  GrowthAgentMemoryReadModel,
  GrowthAgentSharedMemoryRecord,
} from "@/lib/growth/aios/growth/growth-agent-memory-types"
import {
  GROWTH_AGENT_MEMORY_QA_MARKER,
  GROWTH_AGENT_MEMORY_RULE,
} from "@/lib/growth/aios/growth/growth-agent-memory-types"

function baseGates(workflowType: GrowthAgentMemoryAggregationInput["workflowType"]): GrowthAgentRequiredGate[] {
  const gates: GrowthAgentRequiredGate[] = [
    "approval",
    "readiness",
    "handoff",
    "preflight",
    "boundary",
  ]
  if (workflowType && isRuntimePilotWorkflow(workflowType)) {
    gates.push("dry_run", "runtime_pilot")
  }
  if (workflowType === "outreach_generation") {
    gates.push("operator_approval")
  }
  return gates
}

export function scoreMemoryCompleteness(input: GrowthAgentMemoryAggregationInput): {
  completenessState: GrowthAgentMemoryCompletenessState
  missingFields: string[]
  recommendedRemediation: string
} {
  const missingFields: string[] = []

  if (!input.researchSummary) missingFields.push("researchSummary")
  if (!input.qualificationSummary) missingFields.push("qualificationSummary")
  if (!input.executionPlanSummary) missingFields.push("executionPlanSummary")
  if (!input.opportunityAssessment) missingFields.push("opportunityAssessment")
  if (!input.nextBestAction) missingFields.push("nextBestAction")

  if ((input.blockedReasons?.length ?? 0) > 0 || input.workflowType === "outreach_generation") {
    return {
      completenessState: "blocked",
      missingFields,
      recommendedRemediation: "Resolve blocked reasons before agents consume shared memory.",
    }
  }

  if (!input.researchSummary || input.workflowStatus === "not_started") {
    return {
      completenessState: "missing_research",
      missingFields,
      recommendedRemediation: "Complete lead research and capture company summary.",
    }
  }

  if (!input.qualificationSummary) {
    return {
      completenessState: "missing_qualification",
      missingFields,
      recommendedRemediation: "Run qualification and record fit score with evidence.",
    }
  }

  if (!input.executionPlanSummary) {
    return {
      completenessState: "missing_plan",
      missingFields,
      recommendedRemediation: "Generate execution plan from Next Best Action.",
    }
  }

  if (input.approvalState !== "approved_for_future_execution") {
    return {
      completenessState: "missing_approval",
      missingFields,
      recommendedRemediation: "Complete Mission Planning Review approval.",
    }
  }

  const needsRuntime =
    input.approvalState === "approved_for_future_execution" &&
    input.workflowType &&
    isRuntimePilotWorkflow(input.workflowType)

  if (
    needsRuntime &&
    (!input.dryRunState || input.dryRunState === "not_run") &&
    !input.runtimeState
  ) {
    missingFields.push("dryRunState", "runtimeState")
    return {
      completenessState: "missing_runtime_context",
      missingFields,
      recommendedRemediation: "Run dry-run and capture runtime observation before execution handoff.",
    }
  }

  if (missingFields.length > 0) {
    return {
      completenessState: "partial",
      missingFields,
      recommendedRemediation: "Fill missing shared context fields for downstream agents.",
    }
  }

  return {
    completenessState: "complete",
    missingFields: [],
    recommendedRemediation: "Shared memory complete for current lifecycle stage.",
  }
}

export function detectMemoryConflicts(input: GrowthAgentMemoryAggregationInput): GrowthAgentMemoryConflict[] {
  const conflicts: GrowthAgentMemoryConflict[] = []
  const leadKey = input.leadId

  if (
    input.approvalState === "approved_for_future_execution" &&
    input.readinessState?.startsWith("blocked")
  ) {
    conflicts.push({
      conflictId: `memory-conflict:${leadKey}:approved_but_readiness_blocked`,
      kind: "approved_but_readiness_blocked",
      summary: "Plan approved but readiness is blocked.",
      severity: "high",
    })
  }

  if (
    input.handoffState === "handoff_ready" &&
    (input.preflightStatus === "preflight_blocked" ||
      (input.preflightMissingRequirements?.length ?? 0) > 0)
  ) {
    conflicts.push({
      conflictId: `memory-conflict:${leadKey}:handoff_preflight`,
      kind: "handoff_ready_but_preflight_blocked",
      summary: "Handoff ready while preflight guardrails are incomplete.",
      severity: "high",
    })
  }

  if (
    input.futureExecutionEligible &&
    (!input.dryRunState || input.dryRunState === "not_run" || input.dryRunState === "dry_run_failed")
  ) {
    conflicts.push({
      conflictId: `memory-conflict:${leadKey}:runtime_dry_run`,
      kind: "runtime_eligible_but_dry_run_missing",
      summary: "Future execution eligible but dry-run has not passed.",
      severity: "medium",
    })
  }

  if (
    input.orchestrationDecision === "handoff_to_execution" &&
    input.pilotEligible === false &&
    (input.pilotBlockedReasons?.length ?? 0) > 0
  ) {
    conflicts.push({
      conflictId: `memory-conflict:${leadKey}:pilot_blocked`,
      kind: "execution_recommended_but_pilot_blocked",
      summary: "Revenue Operator recommends execution but pilot gates block runtime.",
      severity: "high",
    })
  }

  if (
    (input.outboundRecommended ||
      input.workflowType === "outreach_generation" ||
      input.nextBestAction?.toLowerCase().includes("outreach")) &&
    input.workflowType === "outreach_generation"
  ) {
    conflicts.push({
      conflictId: `memory-conflict:${leadKey}:outreach_blocked`,
      kind: "outbound_recommended_while_outreach_blocked",
      summary: "Outbound workflow present while Outreach Agent remains blocked in 4D.",
      severity: "critical",
    })
  }

  if (input.coreTouchRiskPresent && input.approvalState !== "approved_for_future_execution") {
    conflicts.push({
      conflictId: `memory-conflict:${leadKey}:core_risk`,
      kind: "core_mutation_risk_without_approval",
      summary: "Core mutation risk detected without explicit operator approval.",
      severity: "critical",
    })
  }

  return conflicts
}

export function buildSharedAgentMemoryRecord(
  input: GrowthAgentMemoryAggregationInput,
): GrowthAgentSharedMemoryRecord {
  const completeness = scoreMemoryCompleteness(input)
  const conflicts = detectMemoryConflicts(input)
  const generatedAt = input.generatedAt ?? new Date(0).toISOString()

  return {
    memoryId: `agent-memory:${input.leadId}:${generatedAt}`,
    leadId: input.leadId,
    companyId: input.companyId ?? input.leadId,
    companyName: input.companyName ?? null,
    companySummary: input.companySummary ?? null,
    researchSummary: input.researchSummary ?? null,
    qualificationSummary: input.qualificationSummary ?? null,
    opportunityAssessment: input.opportunityAssessment ?? null,
    nextBestAction: input.nextBestAction ?? null,
    executionPlanSummary: input.executionPlanSummary ?? null,
    workflowType: input.workflowType ?? null,
    approvalState: input.approvalState ?? null,
    readinessState: input.readinessState ?? null,
    handoffState: input.handoffState ?? null,
    boundaryStatus: input.boundaryStatus ?? null,
    preflightStatus: input.preflightStatus ?? null,
    simulationSummary: input.simulationSummary ?? null,
    runtimeState: input.runtimeState ?? null,
    dryRunState: input.dryRunState ?? null,
    pilotState: input.pilotState ?? null,
    owningAgent: input.owningAgent,
    routedEvents: input.routedEvents ?? [],
    revenueOperatorRecommendation: input.revenueOperatorRecommendation ?? null,
    blockedReasons: input.blockedReasons ?? [],
    humanReviewRequirements: input.humanReviewRequirements ?? [],
    confidence: input.confidence ?? null,
    lastUpdatedAt: input.lastUpdatedAt,
    completenessState: completeness.completenessState,
    missingFields: completeness.missingFields,
    recommendedRemediation: completeness.recommendedRemediation,
    conflicts,
  }
}

function agentWhatToKnow(agentKind: GrowthAgentKind, memory: GrowthAgentSharedMemoryRecord): string[] {
  const common = [
    memory.companyName ? `Company: ${memory.companyName}` : null,
    memory.completenessState ? `Completeness: ${memory.completenessState.replaceAll("_", " ")}` : null,
  ].filter((row): row is string => Boolean(row))

  switch (agentKind) {
    case "research_agent":
      return [
        ...common,
        memory.companySummary ? `Company summary: ${memory.companySummary}` : "Missing company summary.",
        memory.researchSummary ?? "Missing research summary.",
      ]
    case "qualification_agent":
      return [
        ...common,
        memory.qualificationSummary ?? "Missing qualification summary.",
        memory.opportunityAssessment ?? "Missing opportunity assessment.",
      ]
    case "planning_agent":
      return [
        ...common,
        memory.executionPlanSummary ?? "Missing execution plan summary.",
        memory.nextBestAction ? `Next best action: ${memory.nextBestAction}` : "Missing next best action.",
      ]
    case "execution_agent":
      return [
        ...common,
        memory.approvalState ? `Approval: ${memory.approvalState.replaceAll("_", " ")}` : "Missing approval state.",
        memory.dryRunState ? `Dry-run: ${memory.dryRunState.replaceAll("_", " ")}` : "Missing dry-run state.",
        memory.runtimeState ? `Runtime: ${memory.runtimeState.replaceAll("_", " ")}` : "Missing runtime state.",
      ]
    case "outreach_agent":
      return [
        ...common,
        memory.nextBestAction ?? "Missing next best action.",
        "Outbound remains blocked until explicit operator approval.",
      ]
    case "meeting_agent":
      return [
        ...common,
        memory.handoffState ? `Handoff: ${memory.handoffState.replaceAll("_", " ")}` : "Missing handoff state.",
      ]
    case "revenue_operator_agent":
      return [
        ...common,
        memory.revenueOperatorRecommendation ?? "Missing Revenue Operator recommendation.",
        memory.routedEvents.length > 0
          ? `Routed events: ${memory.routedEvents.join(", ")}`
          : "No routed events indexed.",
      ]
    default:
      return common
  }
}

export function buildAgentContextView(
  agentKind: GrowthAgentKind,
  memory: GrowthAgentSharedMemoryRecord,
): GrowthAgentContextView {
  const definition = getGrowthAgentDefinition(agentKind)
  const permissionProfile = GROWTH_AGENT_KIND_PERMISSION_MAP[agentKind]
  const permission = GROWTH_AGENT_PERMISSION_RULES[permissionProfile]
  const workflowType = memory.workflowType ?? "research_company"
  const executionCheck = agentMayExecuteWorkflow({ agentKind, workflowType })

  const missingContext = memory.missingFields.filter((field) => {
    if (agentKind === "research_agent") {
      return ["researchSummary", "companySummary", "opportunityAssessment"].includes(field)
    }
    if (agentKind === "qualification_agent") {
      return ["qualificationSummary", "opportunityAssessment"].includes(field)
    }
    if (agentKind === "planning_agent") {
      return ["executionPlanSummary", "nextBestAction"].includes(field)
    }
    if (agentKind === "execution_agent") {
      return ["dryRunState", "runtimeState", "executionPlanSummary"].includes(field)
    }
    if (agentKind === "revenue_operator_agent") {
      return memory.missingFields
    }
    return false
  })

  let recommendedNextAction = memory.recommendedRemediation
  if (agentKind === memory.owningAgent && memory.revenueOperatorRecommendation) {
    recommendedNextAction = memory.revenueOperatorRecommendation
  } else if (memory.nextBestAction) {
    recommendedNextAction = memory.nextBestAction
  }

  return {
    agentKind,
    agentName: definition?.agentName ?? agentKind.replaceAll("_", " "),
    whatToKnow: agentWhatToKnow(agentKind, memory),
    allowedActions: [permission.summary],
    requiredGates: baseGates(memory.workflowType),
    blockedCapabilities: executionCheck.blockedReasons,
    recommendedNextAction,
    missingContext,
    confidence: memory.confidence,
    permissionProfile,
  }
}

export function buildAllAgentContextViews(
  memory: GrowthAgentSharedMemoryRecord,
): GrowthAgentContextView[] {
  return GROWTH_AGENT_KINDS.map((agentKind) => buildAgentContextView(agentKind, memory))
}

export function buildAgentMemoryLeadBundle(
  input: GrowthAgentMemoryAggregationInput,
): GrowthAgentMemoryLeadBundle {
  const sharedMemory = buildSharedAgentMemoryRecord(input)
  return {
    sharedMemory,
    agentViews: buildAllAgentContextViews(sharedMemory),
  }
}

export function buildAgentMemoryReadModel(input: {
  bundles: GrowthAgentMemoryLeadBundle[]
  generatedAt: string
}): GrowthAgentMemoryReadModel {
  const conflictCount = input.bundles.reduce(
    (sum, bundle) => sum + bundle.sharedMemory.conflicts.length,
    0,
  )

  return {
    qaMarker: GROWTH_AGENT_MEMORY_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_AGENT_MEMORY_RULE,
    summary: {
      leadsIndexed: input.bundles.length,
      complete: input.bundles.filter((b) => b.sharedMemory.completenessState === "complete").length,
      partial: input.bundles.filter((b) => b.sharedMemory.completenessState === "partial").length,
      blocked: input.bundles.filter((b) => b.sharedMemory.completenessState === "blocked").length,
      conflictsDetected: conflictCount,
    },
    leads: input.bundles,
  }
}

export function buildAgentMemoryPlanContext(
  bundle: GrowthAgentMemoryLeadBundle | null,
): GrowthAgentMemoryPlanContext | null {
  if (!bundle) return null
  const memory = bundle.sharedMemory
  const owningView = bundle.agentViews.find((view) => view.agentKind === memory.owningAgent)
  return {
    completenessState: memory.completenessState,
    owningAgent: memory.owningAgent,
    missingContext: owningView?.missingContext.length
      ? owningView.missingContext
      : memory.missingFields,
    conflicts: memory.conflicts,
    recommendedRemediation: memory.recommendedRemediation,
    confidence: memory.confidence,
  }
}

export function isAgentMemorySchedulerActive(): false {
  return false
}
