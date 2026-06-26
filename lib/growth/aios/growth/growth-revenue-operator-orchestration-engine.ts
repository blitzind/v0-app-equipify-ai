/** GE-AIOS-GROWTH-4B — Revenue Operator orchestration engine (client-safe, deterministic). */

import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  getGrowthAgentDefinition,
  resolveExecutionAgentForWorkflow,
  resolveOwningAgentForWorkflow,
} from "@/lib/growth/aios/growth/growth-agent-framework-registry"
import { isAgentSchedulerActive } from "@/lib/growth/aios/growth/growth-agent-framework-permissions"
import { isRuntimePilotWorkflow } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import type { GrowthAgentKind, GrowthAgentRequiredGate } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type {
  RevenueOperatorAgentHandoffContract,
  RevenueOperatorEscalationLevel,
  RevenueOperatorLifecycleStage,
  RevenueOperatorOrchestrationDecision,
  RevenueOperatorOrchestrationEngineResult,
  RevenueOperatorOrchestrationRecord,
  RevenueOperatorPlanStateInput,
  RevenueOperatorOrchestrationPlanContext,
} from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"

const AGENT_ORDER: GrowthAgentKind[] = [
  "research_agent",
  "qualification_agent",
  "planning_agent",
  "execution_agent",
  "meeting_agent",
  "outreach_agent",
  "revenue_operator_agent",
]

export function resolveLifecycleStage(
  input: RevenueOperatorPlanStateInput,
): RevenueOperatorLifecycleStage {
  if (input.workflowType === "close") return "closed"
  if (input.workflowType === "outreach_generation") return "outreach_blocked"
  if (input.workflowType === "meeting_preparation") return "meeting"
  if (input.workflowType === "approval") return "planning"
  if (input.workflowType === "monitoring") return "research"

  if (input.approvalStatus === "approved_for_future_execution") {
    if (input.readinessState === "ready_for_future_execution") {
      if (isRuntimePilotWorkflow(input.workflowType)) return "execution"
      return "approved_ready"
    }
    if (input.readinessState?.startsWith("blocked")) return "blocked"
    return "planning"
  }

  if (input.workflowType === "research_company") return "research"
  if (input.workflowType === "verify_email" || input.workflowType === "buying_committee") {
    return "qualification"
  }

  return "blocked"
}

export function resolveOwningAgent(input: RevenueOperatorPlanStateInput): GrowthAgentKind {
  const executionAgent = resolveExecutionAgentForWorkflow(input.workflowType)
  if (
    executionAgent &&
    input.approvalStatus === "approved_for_future_execution" &&
    input.readinessState === "ready_for_future_execution" &&
    isRuntimePilotWorkflow(input.workflowType)
  ) {
    return executionAgent
  }
  return resolveOwningAgentForWorkflow(input.workflowType)
}

export function resolveCandidateAgents(input: RevenueOperatorPlanStateInput): GrowthAgentKind[] {
  const stage = resolveLifecycleStage(input)
  const owning = resolveOwningAgent(input)
  const candidates = new Set<GrowthAgentKind>([owning, "revenue_operator_agent"])

  switch (stage) {
    case "research":
      candidates.add("research_agent")
      candidates.add("qualification_agent")
      break
    case "qualification":
      candidates.add("qualification_agent")
      candidates.add("planning_agent")
      break
    case "planning":
    case "approved_ready":
      candidates.add("planning_agent")
      candidates.add("execution_agent")
      break
    case "execution":
      candidates.add("execution_agent")
      candidates.add("research_agent")
      break
    case "meeting":
      candidates.add("meeting_agent")
      break
    case "outreach_blocked":
      candidates.add("outreach_agent")
      break
    case "closed":
      candidates.add("revenue_operator_agent")
      break
    case "blocked":
      candidates.add("planning_agent")
      break
    default:
      break
  }

  return AGENT_ORDER.filter((kind) => candidates.has(kind))
}

function baseRequiredGates(input: RevenueOperatorPlanStateInput): GrowthAgentRequiredGate[] {
  const gates: GrowthAgentRequiredGate[] = ["approval", "readiness", "handoff", "preflight", "boundary"]
  if (isRuntimePilotWorkflow(input.workflowType)) {
    gates.push("dry_run", "runtime_pilot")
  }
  if (input.workflowType === "outreach_generation") {
    gates.push("operator_approval")
  }
  return gates
}

function resolveOrchestrationDecision(input: RevenueOperatorPlanStateInput): {
  decision: RevenueOperatorOrchestrationDecision
  recommendedNextAgent: GrowthAgentKind
  blockedReasons: string[]
  escalationLevel: RevenueOperatorEscalationLevel
  reasoning: string
  recommendedNextAction: string
} {
  const owning = resolveOwningAgent(input)
  const stage = resolveLifecycleStage(input)
  const blockedReasons: string[] = []

  if (input.workflowType === "outreach_generation") {
    return {
      decision: "blocked",
      recommendedNextAgent: "outreach_agent",
      blockedReasons: ["Outreach workflows require human approval — outbound blocked in 4B."],
      escalationLevel: "high",
      reasoning: "Outreach Agent ownership blocked until explicit operator approval.",
      recommendedNextAction: "Review outreach plan manually — no autonomous send.",
    }
  }

  if (input.workflowType === "close") {
    return {
      decision: "continue_current_agent",
      recommendedNextAgent: "revenue_operator_agent",
      blockedReasons: [],
      escalationLevel: "none",
      reasoning: "Lead closed — Revenue Operator supervises archival only.",
      recommendedNextAction: "Confirm close rationale and archive observation.",
    }
  }

  if (input.preflightStatus === "preflight_blocked" || input.readinessState?.startsWith("blocked")) {
    blockedReasons.push(
      input.readinessState?.startsWith("blocked")
        ? `Readiness blocked: ${input.readinessState.replaceAll("_", " ")}`
        : "Preflight blocked.",
    )
    return {
      decision: "human_review_required",
      recommendedNextAgent: owning,
      blockedReasons,
      escalationLevel: "medium",
      reasoning: "Execution or progression blocked — operator review required before handoff.",
      recommendedNextAction: "Resolve readiness/preflight blockers, then re-evaluate ownership.",
    }
  }

  if (
    stage === "execution" &&
    input.pilotBlockedReasons &&
    input.pilotBlockedReasons.length > 0
  ) {
    return {
      decision: "human_review_required",
      recommendedNextAgent: "execution_agent",
      blockedReasons: input.pilotBlockedReasons,
      escalationLevel: "high",
      reasoning: "Execution Agent recommended but runtime pilot gates are not satisfied.",
      recommendedNextAction: "Complete dry-run and enable pilot flags before internal runtime.",
    }
  }

  if (stage === "research") {
    return {
      decision: "handoff_to_qualification",
      recommendedNextAgent: "qualification_agent",
      blockedReasons: [],
      escalationLevel: "none",
      reasoning: "Research complete — Qualification Agent should own verification and committee mapping.",
      recommendedNextAction: "Hand off to Qualification Agent for contact verification.",
    }
  }

  if (stage === "qualification") {
    return {
      decision: "handoff_to_planning",
      recommendedNextAgent: "planning_agent",
      blockedReasons: [],
      escalationLevel: "none",
      reasoning: "Qualification in progress — Planning Agent prepares approved execution path.",
      recommendedNextAction: "Complete qualification, then route to Planning Agent.",
    }
  }

  if (stage === "planning" && input.approvalStatus !== "approved_for_future_execution") {
    return {
      decision: "continue_current_agent",
      recommendedNextAgent: "planning_agent",
      blockedReasons: [],
      escalationLevel: "low",
      reasoning: "Planning Agent owns mission planning until operator approval is recorded.",
      recommendedNextAction: "Complete mission planning review and approval.",
    }
  }

  if (stage === "approved_ready" || stage === "execution") {
    if (isRuntimePilotWorkflow(input.workflowType)) {
      const dryRunPassed = input.latestDryRunStatus === "dry_run_passed"
      if (!dryRunPassed) {
        blockedReasons.push("Dry-run must pass before Execution Agent handoff.")
      }
      return {
        decision: dryRunPassed ? "handoff_to_execution" : "human_review_required",
        recommendedNextAgent: "execution_agent",
        blockedReasons,
        escalationLevel: dryRunPassed ? "none" : "medium",
        reasoning: dryRunPassed
          ? "Approved and ready — Execution Agent owns research_company pilot runtime after gates pass."
          : "Approved and ready but dry-run gate open — human review before execution handoff.",
        recommendedNextAction: dryRunPassed
          ? "Hand off to Execution Agent for gated internal runtime."
          : "Run dry-run, then re-evaluate execution handoff.",
      }
    }
    return {
      decision: "continue_current_agent",
      recommendedNextAgent: owning,
      blockedReasons: [],
      escalationLevel: "low",
      reasoning: "Approved plan awaiting non-pilot workflow path — stay with current owning agent.",
      recommendedNextAction: "Continue with current agent until workflow-specific gates clear.",
    }
  }

  if (stage === "meeting") {
    return {
      decision: "handoff_to_meeting",
      recommendedNextAgent: "meeting_agent",
      blockedReasons: [],
      escalationLevel: "none",
      reasoning: "Meeting booked — Meeting Agent owns preparation.",
      recommendedNextAction: "Hand off to Meeting Agent for brief preparation.",
    }
  }

  if (stage === "blocked") {
    return {
      decision: "blocked",
      recommendedNextAgent: owning,
      blockedReasons: ["Lifecycle stage blocked."],
      escalationLevel: "critical",
      reasoning: "Orchestration blocked — no safe agent handoff.",
      recommendedNextAction: "Resolve blockers before agent handoff.",
    }
  }

  return {
    decision: "continue_current_agent",
    recommendedNextAgent: owning,
    blockedReasons: [],
    escalationLevel: "none",
    reasoning: "Ownership unchanged — Revenue Operator continues supervising current agent.",
    recommendedNextAction: "Monitor gates and re-evaluate on state change.",
  }
}

export function buildAgentHandoff(input: {
  sourceAgent: GrowthAgentKind
  destinationAgent: GrowthAgentKind
  planState: RevenueOperatorPlanStateInput
  reason: string
  generatedAt?: string
}): RevenueOperatorAgentHandoffContract {
  const source = getGrowthAgentDefinition(input.sourceAgent)
  const destination = getGrowthAgentDefinition(input.destinationAgent)
  return {
    handoffId: `ro-handoff:${input.planState.leadId}:${input.sourceAgent}:${input.destinationAgent}`,
    sourceAgent: input.sourceAgent,
    destinationAgent: input.destinationAgent,
    reason: input.reason,
    requiredContext: [
      `lead:${input.planState.leadId}`,
      `workflow:${input.planState.workflowType}`,
      `approval:${input.planState.approvalStatus}`,
      input.planState.planId ? `plan:${input.planState.planId}` : "plan:unknown",
    ],
    requiredGates: baseRequiredGates(input.planState),
    expectedOutputs: [
      `${destination?.agentName ?? input.destinationAgent} recommendation for ${input.planState.workflowType.replaceAll("_", " ")}`,
    ],
    readOnly: true,
  }
}

export function buildRevenueOperatorOrchestration(
  input: RevenueOperatorPlanStateInput,
): RevenueOperatorOrchestrationEngineResult {
  const generatedAt = input.generatedAt ?? new Date(0).toISOString()
  const owningAgent = resolveOwningAgent(input)
  const candidateAgents = resolveCandidateAgents(input)
  const stage = resolveLifecycleStage(input)
  const decisionResult = resolveOrchestrationDecision(input)

  const handoffPreview =
    decisionResult.decision.startsWith("handoff_") &&
    decisionResult.recommendedNextAgent !== owningAgent
      ? buildAgentHandoff({
          sourceAgent: owningAgent,
          destinationAgent: decisionResult.recommendedNextAgent,
          planState: input,
          reason: decisionResult.reasoning,
          generatedAt,
        })
      : null

  const confidence =
    input.confidence ??
    (decisionResult.blockedReasons.length === 0
      ? stage === "execution" && input.latestDryRunStatus === "dry_run_passed"
        ? 0.86
        : 0.72
      : 0.45)

  const record: RevenueOperatorOrchestrationRecord = {
    orchestrationId: `ro-orchestration:${input.leadId}:${generatedAt}`,
    evaluationTimestamp: generatedAt,
    leadId: input.leadId,
    companyId: input.companyId ?? input.leadId,
    companyName: input.companyName ?? null,
    currentLifecycleStage: stage,
    owningAgent,
    candidateAgents,
    orchestrationDecision: decisionResult.decision,
    recommendedNextAgent: decisionResult.recommendedNextAgent,
    confidence,
    reasoning: decisionResult.reasoning,
    requiredGates: baseRequiredGates(input),
    blockedReasons: decisionResult.blockedReasons,
    escalationLevel: decisionResult.escalationLevel,
    recommendedNextAction: decisionResult.recommendedNextAction,
    handoffPreview,
  }

  const planContext: RevenueOperatorOrchestrationPlanContext = {
    currentOwner: owningAgent,
    nextOwner: decisionResult.recommendedNextAgent,
    handoffSummary: handoffPreview
      ? `${handoffPreview.sourceAgent.replaceAll("_", " ")} → ${handoffPreview.destinationAgent.replaceAll("_", " ")}: ${handoffPreview.reason}`
      : null,
    orchestrationReasoning: decisionResult.reasoning,
    orchestrationDecision: decisionResult.decision,
    escalationLevel: decisionResult.escalationLevel,
    blockedReasons: decisionResult.blockedReasons,
  }

  return { record, planContext }
}

export function isRevenueOperatorSchedulerActive(): false {
  return isAgentSchedulerActive()
}

export function workflowSupportsOrchestration(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
): boolean {
  return workflowType !== "monitoring" || true
}
