/** GE-AIOS-GROWTH-2C — Execution Simulation Engine (client-safe). */

import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import {
  GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES,
  type GrowthLeadResearchCanonicalWorkflowType,
  type GrowthLeadResearchExecutionPlan,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import type {
  GrowthLeadResearchExecutionBoundaryClassification,
  GrowthLeadResearchWorkflowBoundaryReport,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchFutureExecutionHandoffContract } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import type {
  GrowthLeadResearchExecutionPreflightStatus,
  GrowthLeadResearchPlanPreflightChecklist,
  GrowthLeadResearchWorkflowPreflightChecklist,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import { requiredProviderCapabilitiesForWorkflow } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"

export const GROWTH_AIOS_GROWTH_2C_PHASE = "GE-AIOS-GROWTH-2C" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_QA_MARKER =
  "growth-aios-growth-2c-execution-simulation-v1" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_STATUSES = [
  "simulation_ready",
  "simulation_blocked",
  "simulation_success",
  "simulation_partial_success",
  "simulation_failed_preflight",
  "simulation_not_allowed",
] as const

export type GrowthLeadResearchExecutionSimulationStatus =
  (typeof GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_STATUSES)[number]

export type GrowthLeadResearchExecutionSimulationTimelineStep = {
  stepId: string
  label: string
  phase: "planning" | "gate" | "work_order" | "operator" | "audit" | "rollback"
  offsetMinutes: number
}

export type GrowthLeadResearchExecutionSimulationReport = {
  simulationId: string
  planId: string | null
  leadId: string | null
  companyName: string | null
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus | "not_applicable"
  readinessState: GrowthLeadResearchApprovedPlanReadinessState | "not_applicable"
  boundaryClassification: GrowthLeadResearchExecutionBoundaryClassification
  preflightStatus: GrowthLeadResearchExecutionPreflightStatus | "not_evaluated"
  simulatedExecutionStatus: GrowthLeadResearchExecutionSimulationStatus
  predictedTimeline: GrowthLeadResearchExecutionSimulationTimelineStep[]
  predictedProviderUsage: string[]
  predictedWorkOrders: AiWorkOrderType[]
  predictedApprovals: string[]
  predictedOperatorInteractions: string[]
  predictedOutboundActions: string[]
  predictedRollbackPath: string
  predictedAuditEvents: string[]
  predictedCosts: { band: GrowthLeadResearchExecutionPlan["estimatedCost"]; label: string }
  predictedFailurePoints: string[]
  confidence: number
  simulationSummary: string
  observationHref: string | null
}

export type GrowthLeadResearchExecutionSimulationSystemSummary = {
  simulationsGenerated: number
  successCount: number
  partialSuccessCount: number
  readyCount: number
  blockedCount: number
  failedPreflightCount: number
  notAllowedCount: number
  headline: string
}

export type GrowthLeadResearchExecutionSimulationReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_QA_MARKER
  generatedAt: string
  workflowSimulations: GrowthLeadResearchExecutionSimulationReport[]
  planSimulations: GrowthLeadResearchExecutionSimulationReport[]
  systemSummary: GrowthLeadResearchExecutionSimulationSystemSummary
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_SIMULATION_RUNTIME_RULE =
  "Execution Simulation is in-memory planning only — it predicts execution outcomes without creating Work Orders, calling providers, publishing runtime events, or mutating Core." as const

const MINUTES_PER_SIMULATED_STEP = 20 as const

export function buildExecutionSimulationId(input: {
  planId?: string | null
  workflowType: GrowthLeadResearchCanonicalWorkflowType
}): string {
  if (input.planId) return `glr-exec-sim:${input.planId}`
  return `glr-exec-sim:wf:${input.workflowType}`
}

function predictedOutboundForWorkflow(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
  boundary: GrowthLeadResearchWorkflowBoundaryReport,
): string[] {
  if (!boundary.futureExecutionAllowed) return ["none — workflow not allowed"]
  switch (workflowType) {
    case "outreach_generation":
      return ["draft_email_only", "no_sendr_enrollment", "no_transport_until_operator_approves"]
    case "monitoring":
      return ["none — passive signal observation only"]
    case "close":
    case "approval":
      return ["none — operator documentation only"]
    default:
      return boundary.outboundRisk === "none" ? ["none"] : ["none — Growth-scoped mutation only"]
  }
}

function predictedOperatorInteractionsForPlan(input: {
  plan: GrowthLeadResearchExecutionPlan
  boundary: GrowthLeadResearchWorkflowBoundaryReport
  workflowPreflight: GrowthLeadResearchWorkflowPreflightChecklist
}): string[] {
  const interactions: string[] = []
  if (input.plan.approvalRequired) {
    interactions.push("Operator execution plan approval (already recorded for approved plans)")
  }
  for (const step of input.plan.estimatedSteps) {
    if (step.stepId.includes("operator") || step.stepId.includes("review")) {
      interactions.push(step.label)
    }
  }
  if (input.workflowPreflight.requiredHumanConfirmationLevel !== "none") {
    interactions.push(
      `Human confirmation: ${input.workflowPreflight.requiredHumanConfirmationLevel.replaceAll("_", " ")}`,
    )
  }
  if (input.boundary.classification === "outbound_requires_human_approval") {
    interactions.push("Per-draft human approval before any outbound send")
  }
  return [...new Set(interactions)]
}

export function buildPredictedExecutionTimeline(input: {
  plan: GrowthLeadResearchExecutionPlan
  boundary: GrowthLeadResearchWorkflowBoundaryReport
}): GrowthLeadResearchExecutionSimulationTimelineStep[] {
  const timeline: GrowthLeadResearchExecutionSimulationTimelineStep[] = [
    {
      stepId: "sim_start",
      label: "Simulation start — guardrails verified in memory",
      phase: "planning",
      offsetMinutes: 0,
    },
  ]

  for (const [index, step] of input.plan.estimatedSteps.entries()) {
    const offsetMinutes = (index + 1) * MINUTES_PER_SIMULATED_STEP
    let phase: GrowthLeadResearchExecutionSimulationTimelineStep["phase"] = "planning"
    if (step.workOrderType) phase = "work_order"
    else if (step.stepId.includes("operator") || step.stepId.includes("review")) phase = "operator"
    else if (step.stepId.includes("record") || step.stepId.includes("audit")) phase = "audit"

    timeline.push({
      stepId: step.stepId,
      label: step.label,
      phase,
      offsetMinutes,
    })
  }

  for (const gate of input.boundary.requiredApprovalGates.slice(0, 2)) {
    timeline.push({
      stepId: `gate_${gate}`,
      label: `Approval gate: ${gate.replaceAll("_", " ")}`,
      phase: "gate",
      offsetMinutes: timeline[timeline.length - 1]!.offsetMinutes + MINUTES_PER_SIMULATED_STEP,
    })
  }

  timeline.push({
    stepId: "sim_complete",
    label: "Simulated execution complete — no side effects",
    phase: "audit",
    offsetMinutes: timeline[timeline.length - 1]!.offsetMinutes + MINUTES_PER_SIMULATED_STEP,
  })

  return timeline
}

export function resolvePredictedFailurePoints(input: {
  plan: GrowthLeadResearchExecutionPlan
  handoff?: GrowthLeadResearchFutureExecutionHandoffContract | null
  workflowPreflight: GrowthLeadResearchWorkflowPreflightChecklist
  boundary: GrowthLeadResearchWorkflowBoundaryReport
}): string[] {
  const failures: string[] = []
  failures.push(...input.plan.missingPrerequisites)
  failures.push(...input.plan.failureConditions.slice(0, 2))
  failures.push(...input.boundary.missingGuardrails)
  failures.push(...input.workflowPreflight.missingRequirements)
  if (input.handoff) failures.push(...input.handoff.blockedReasons)
  return [...new Set(failures.filter(Boolean))].slice(0, 8)
}

export function resolveSimulationConfidence(input: {
  status: GrowthLeadResearchExecutionSimulationStatus
  plan: GrowthLeadResearchExecutionPlan
  failurePointCount: number
  preflightStatus: GrowthLeadResearchExecutionPreflightStatus | "not_evaluated"
}): number {
  if (input.status === "simulation_not_allowed") return 0
  if (input.status === "simulation_failed_preflight") return 0.15
  if (input.status === "simulation_blocked") return 0.25

  let confidence = 0.88
  if (input.status === "simulation_partial_success") confidence = 0.62
  if (input.status === "simulation_ready") confidence = 0.72
  if (input.status === "simulation_success") confidence = 0.91

  confidence -= input.failurePointCount * 0.06
  confidence -= input.plan.missingPrerequisites.length * 0.05
  if (input.preflightStatus !== "not_evaluated" && input.preflightStatus !== "preflight_passed") {
    confidence -= 0.2
  }
  if (input.plan.estimatedCost === "high") confidence -= 0.04

  return Math.max(0, Math.min(1, Math.round(confidence * 100) / 100))
}

export function resolveSimulatedExecutionStatus(input: {
  plan: GrowthLeadResearchExecutionPlan
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus | "not_applicable"
  readinessState: GrowthLeadResearchApprovedPlanReadinessState | "not_applicable"
  boundary: GrowthLeadResearchWorkflowBoundaryReport
  workflowPreflight: GrowthLeadResearchWorkflowPreflightChecklist
  planPreflight?: GrowthLeadResearchPlanPreflightChecklist | null
  handoff?: GrowthLeadResearchFutureExecutionHandoffContract | null
  failurePointCount: number
}): GrowthLeadResearchExecutionSimulationStatus {
  if (!input.boundary.futureExecutionAllowed || input.workflowPreflight.preflightStatus === "preflight_not_allowed") {
    return "simulation_not_allowed"
  }

  const preflightStatus =
    input.planPreflight?.preflightStatus ?? input.workflowPreflight.preflightStatus

  if (preflightStatus !== "not_evaluated" && preflightStatus !== "preflight_passed") {
    return "simulation_failed_preflight"
  }

  if (
    input.approvalState !== "not_applicable" &&
    input.approvalState !== "approved_for_future_execution"
  ) {
    return "simulation_blocked"
  }

  if (
    input.readinessState !== "not_applicable" &&
    input.readinessState !== "ready_for_future_execution"
  ) {
    return "simulation_blocked"
  }

  if (input.handoff && input.handoff.handoffState !== "handoff_ready") {
    return "simulation_blocked"
  }

  if (input.plan.missingPrerequisites.length > 0 || input.failurePointCount >= 3) {
    return "simulation_partial_success"
  }

  if (
    input.boundary.classification === "outbound_requires_human_approval" ||
    input.boundary.classification === "core_mutation_requires_explicit_approval" ||
    input.plan.approvalRequired
  ) {
    return input.failurePointCount > 0 ? "simulation_partial_success" : "simulation_ready"
  }

  if (input.failurePointCount > 0) {
    return "simulation_partial_success"
  }

  return "simulation_success"
}

export function buildWorkflowExecutionSimulation(input: {
  boundary: GrowthLeadResearchWorkflowBoundaryReport
  workflowPreflight: GrowthLeadResearchWorkflowPreflightChecklist
  plan?: GrowthLeadResearchExecutionPlan
}): GrowthLeadResearchExecutionSimulationReport {
  const workflowType = input.boundary.workflowType
  const plan =
    input.plan ??
    ({
      workflowType,
      estimatedSteps: [{ stepId: "catalog", label: `${workflowType.replaceAll("_", " ")} catalog step`, workOrderType: input.boundary.safeWorkOrderType }],
      requiredWorkOrders: input.boundary.safeWorkOrderType ? [input.boundary.safeWorkOrderType] : [],
      missingPrerequisites: [],
      failureConditions: [],
      approvalRequired: input.boundary.requiredApprovalGates.length > 0,
      estimatedCost: "medium" as const,
      rollbackStrategy: input.boundary.rollbackBehavior,
    } satisfies Pick<
      GrowthLeadResearchExecutionPlan,
      | "workflowType"
      | "estimatedSteps"
      | "requiredWorkOrders"
      | "missingPrerequisites"
      | "failureConditions"
      | "approvalRequired"
      | "estimatedCost"
      | "rollbackStrategy"
    >)

  const failurePoints = resolvePredictedFailurePoints({
    plan: plan as GrowthLeadResearchExecutionPlan,
    workflowPreflight: input.workflowPreflight,
    boundary: input.boundary,
  })

  const status = resolveSimulatedExecutionStatus({
    plan: plan as GrowthLeadResearchExecutionPlan,
    approvalState: "not_applicable",
    readinessState: "not_applicable",
    boundary: input.boundary,
    workflowPreflight: input.workflowPreflight,
    failurePointCount: failurePoints.length,
  })

  const preflightStatus = input.workflowPreflight.preflightStatus

  return {
    simulationId: buildExecutionSimulationId({ workflowType }),
    planId: null,
    leadId: null,
    companyName: null,
    workflowType,
    approvalState: "not_applicable",
    readinessState: "not_applicable",
    boundaryClassification: input.boundary.classification,
    preflightStatus,
    simulatedExecutionStatus: status,
    predictedTimeline: buildPredictedExecutionTimeline({ plan: plan as GrowthLeadResearchExecutionPlan, boundary: input.boundary }),
    predictedProviderUsage: [
      ...requiredProviderCapabilitiesForWorkflow(workflowType),
      ...input.boundary.providerDependencies,
    ],
    predictedWorkOrders: plan.requiredWorkOrders,
    predictedApprovals: input.boundary.requiredApprovalGates,
    predictedOperatorInteractions: predictedOperatorInteractionsForPlan({
      plan: plan as GrowthLeadResearchExecutionPlan,
      boundary: input.boundary,
      workflowPreflight: input.workflowPreflight,
    }),
    predictedOutboundActions: predictedOutboundForWorkflow(workflowType, input.boundary),
    predictedRollbackPath: input.boundary.rollbackBehavior,
    predictedAuditEvents: input.boundary.requiredAuditEvents,
    predictedCosts: { band: plan.estimatedCost, label: `${plan.estimatedCost} simulated cost band` },
    predictedFailurePoints: failurePoints,
    confidence: resolveSimulationConfidence({
      status,
      plan: plan as GrowthLeadResearchExecutionPlan,
      failurePointCount: failurePoints.length,
      preflightStatus,
    }),
    simulationSummary: summarizeExecutionSimulation({
      status,
      workflowType,
      failurePointCount: failurePoints.length,
    }),
    observationHref: null,
  }
}

export function buildPlanExecutionSimulation(input: {
  plan: GrowthLeadResearchExecutionPlan
  planId: string
  leadId: string
  companyName: string | null
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState
  boundary: GrowthLeadResearchWorkflowBoundaryReport
  workflowPreflight: GrowthLeadResearchWorkflowPreflightChecklist
  planPreflight: GrowthLeadResearchPlanPreflightChecklist
  handoff: GrowthLeadResearchFutureExecutionHandoffContract
  observationHref: string
}): GrowthLeadResearchExecutionSimulationReport {
  const failurePoints = resolvePredictedFailurePoints({
    plan: input.plan,
    handoff: input.handoff,
    workflowPreflight: input.workflowPreflight,
    boundary: input.boundary,
  })

  const status = resolveSimulatedExecutionStatus({
    plan: input.plan,
    approvalState: input.approvalState,
    readinessState: input.readinessState,
    boundary: input.boundary,
    workflowPreflight: input.workflowPreflight,
    planPreflight: input.planPreflight,
    handoff: input.handoff,
    failurePointCount: failurePoints.length,
  })

  const preflightStatus = input.planPreflight.preflightStatus

  return {
    simulationId: buildExecutionSimulationId({ planId: input.planId, workflowType: input.plan.workflowType }),
    planId: input.planId,
    leadId: input.leadId,
    companyName: input.companyName,
    workflowType: input.plan.workflowType,
    approvalState: input.approvalState,
    readinessState: input.readinessState,
    boundaryClassification: input.boundary.classification,
    preflightStatus,
    simulatedExecutionStatus: status,
    predictedTimeline: buildPredictedExecutionTimeline({ plan: input.plan, boundary: input.boundary }),
    predictedProviderUsage: [
      ...input.handoff.requiredProviderCapabilities,
      ...input.boundary.providerDependencies,
    ],
    predictedWorkOrders: input.plan.requiredWorkOrders,
    predictedApprovals: [...new Set([...input.boundary.requiredApprovalGates, ...input.handoff.requiredApprovals])],
    predictedOperatorInteractions: predictedOperatorInteractionsForPlan({
      plan: input.plan,
      boundary: input.boundary,
      workflowPreflight: input.workflowPreflight,
    }),
    predictedOutboundActions: predictedOutboundForWorkflow(input.plan.workflowType, input.boundary),
    predictedRollbackPath: input.handoff.rollbackRequirements || input.boundary.rollbackBehavior,
    predictedAuditEvents: [...new Set([...input.boundary.requiredAuditEvents, ...input.handoff.auditReferences])],
    predictedCosts: {
      band: input.plan.estimatedCost,
      label: `${input.plan.estimatedCost} — ${input.plan.estimatedDuration}`,
    },
    predictedFailurePoints: failurePoints,
    confidence: resolveSimulationConfidence({
      status,
      plan: input.plan,
      failurePointCount: failurePoints.length,
      preflightStatus,
    }),
    simulationSummary: summarizeExecutionSimulation({
      status,
      workflowType: input.plan.workflowType,
      failurePointCount: failurePoints.length,
      companyName: input.companyName,
    }),
    observationHref: input.observationHref,
  }
}

export function buildAllWorkflowExecutionSimulations(input: {
  boundaries: GrowthLeadResearchWorkflowBoundaryReport[]
  workflowPreflights: GrowthLeadResearchWorkflowPreflightChecklist[]
}): GrowthLeadResearchExecutionSimulationReport[] {
  const preflightByWorkflow = new Map(
    input.workflowPreflights.map((row) => [row.workflowType, row]),
  )

  return GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES.map((workflowType) => {
    const boundary = input.boundaries.find((row) => row.workflowType === workflowType)
    const workflowPreflight = preflightByWorkflow.get(workflowType)
    if (!boundary || !workflowPreflight) {
      throw new Error(`missing simulation inputs for ${workflowType}`)
    }
    return buildWorkflowExecutionSimulation({ boundary, workflowPreflight })
  })
}

export function buildExecutionSimulationSystemSummary(input: {
  simulations: GrowthLeadResearchExecutionSimulationReport[]
}): GrowthLeadResearchExecutionSimulationSystemSummary {
  const successCount = input.simulations.filter((s) => s.simulatedExecutionStatus === "simulation_success").length
  const partialSuccessCount = input.simulations.filter(
    (s) => s.simulatedExecutionStatus === "simulation_partial_success",
  ).length
  const readyCount = input.simulations.filter((s) => s.simulatedExecutionStatus === "simulation_ready").length
  const blockedCount = input.simulations.filter((s) => s.simulatedExecutionStatus === "simulation_blocked").length
  const failedPreflightCount = input.simulations.filter(
    (s) => s.simulatedExecutionStatus === "simulation_failed_preflight",
  ).length
  const notAllowedCount = input.simulations.filter(
    (s) => s.simulatedExecutionStatus === "simulation_not_allowed",
  ).length

  return {
    simulationsGenerated: input.simulations.length,
    successCount,
    partialSuccessCount,
    readyCount,
    blockedCount,
    failedPreflightCount,
    notAllowedCount,
    headline: `${input.simulations.length} execution simulations — ${successCount} success, ${partialSuccessCount} partial, ${readyCount} ready, ${blockedCount + failedPreflightCount + notAllowedCount} blocked.`,
  }
}

export function summarizeExecutionSimulation(input: {
  status: GrowthLeadResearchExecutionSimulationStatus
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  failurePointCount: number
  companyName?: string | null
}): string {
  const label = input.workflowType.replaceAll("_", " ")
  const subject = input.companyName ? `${input.companyName} (${label})` : label

  switch (input.status) {
    case "simulation_success":
      return `${subject} — simulated full success with ${input.failurePointCount} predicted failure points.`
    case "simulation_partial_success":
      return `${subject} — simulated partial success; ${input.failurePointCount} failure point(s) require operator attention.`
    case "simulation_ready":
      return `${subject} — simulation ready; operator gates remain before autonomous steps.`
    case "simulation_blocked":
      return `${subject} — simulation blocked by approval, readiness, or handoff state.`
    case "simulation_failed_preflight":
      return `${subject} — simulation blocked by preflight guardrail failures.`
    case "simulation_not_allowed":
      return `${subject} — workflow not allowed for future execution simulation.`
    default:
      return `${subject} — simulation ${input.status.replaceAll("_", " ")}.`
  }
}

export function summarizePlanExecutionSimulation(
  report: Pick<GrowthLeadResearchExecutionSimulationReport, "simulatedExecutionStatus" | "simulationSummary" | "confidence">,
): string {
  const pct = Math.round(report.confidence * 100)
  return report.simulatedExecutionStatus === "simulation_success"
    ? `Simulated success (${pct}% confidence)`
    : `${report.simulationSummary} (${pct}% confidence)`
}
