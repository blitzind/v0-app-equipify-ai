/** GE-AIOS-GROWTH-2B — Execution Guardrail Preflight Checklist (client-safe). */

import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchFutureExecutionHandoffContract } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import type { GrowthLeadResearchFutureExecutionHandoffInfrastructure } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import type {
  GrowthLeadResearchExecutionBoundaryClassification,
  GrowthLeadResearchWorkflowBoundaryReport,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"

export const GROWTH_AIOS_GROWTH_2B_PHASE = "GE-AIOS-GROWTH-2B" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_QA_MARKER =
  "growth-aios-growth-2b-execution-preflight-checklist-v1" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_STATUSES = [
  "preflight_passed",
  "preflight_blocked_missing_feature_flag",
  "preflight_blocked_missing_kill_switch",
  "preflight_blocked_missing_budget_control",
  "preflight_blocked_missing_approval_gate",
  "preflight_blocked_missing_audit_event",
  "preflight_blocked_provider_unavailable",
  "preflight_blocked_core_risk",
  "preflight_blocked_outbound_risk",
  "preflight_not_allowed",
] as const

export type GrowthLeadResearchExecutionPreflightStatus =
  (typeof GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_STATUSES)[number]

export type GrowthLeadResearchHumanConfirmationLevel =
  | "none"
  | "operator_acknowledgment"
  | "operator_execution_plan_approval"
  | "per_action_human_confirmation"
  | "explicit_core_approval"
  | "operator_review_only"

export type GrowthLeadResearchWorkflowPreflightChecklist = {
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  boundaryClassification: GrowthLeadResearchExecutionBoundaryClassification
  requiredFeatureFlags: string[]
  requiredKillSwitches: string[]
  requiredBudgetControls: string[]
  requiredApprovalGates: string[]
  requiredAuditEvents: string[]
  requiredProviderHealthCheck: boolean
  providerHealthReady: boolean
  requiredRollbackBehavior: string
  requiredOperatorVisibility: string[]
  requiredHumanConfirmationLevel: GrowthLeadResearchHumanConfirmationLevel
  coreRiskStatus: GrowthLeadResearchWorkflowBoundaryReport["coreTouchRisk"]
  outboundRiskStatus: GrowthLeadResearchWorkflowBoundaryReport["outboundRisk"]
  preflightStatus: GrowthLeadResearchExecutionPreflightStatus
  missingRequirements: string[]
  runtimeImplementationAllowed: boolean
  preflightSummary: string
}

export type GrowthLeadResearchPlanPreflightChecklist = {
  planId: string
  leadId: string
  companyName: string | null
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  preflightStatus: GrowthLeadResearchExecutionPreflightStatus
  missingRequirements: string[]
  runtimeImplementationAllowed: boolean
  preflightSummary: string
  observationHref: string
}

export type GrowthLeadResearchExecutionPreflightSystemSummary = {
  workflowsChecked: number
  preflightPassedCount: number
  blockedCount: number
  notAllowedCount: number
  blockedWorkflows: GrowthLeadResearchCanonicalWorkflowType[]
  headline: string
}

export type GrowthLeadResearchExecutionPreflightReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_QA_MARKER
  generatedAt: string
  workflowChecklists: GrowthLeadResearchWorkflowPreflightChecklist[]
  planChecklists: GrowthLeadResearchPlanPreflightChecklist[]
  systemSummary: GrowthLeadResearchExecutionPreflightSystemSummary
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_PREFLIGHT_RUNTIME_RULE =
  "Execution Preflight Checklist is audit-only — it verifies guardrail readiness without invoking providers, creating Work Orders, or mutating Core." as const

export function resolveHumanConfirmationLevel(
  classification: GrowthLeadResearchExecutionBoundaryClassification,
): GrowthLeadResearchHumanConfirmationLevel {
  switch (classification) {
    case "planning_only":
      return "operator_review_only"
    case "read_only_runtime":
      return "operator_acknowledgment"
    case "internal_mutation_only":
      return "operator_execution_plan_approval"
    case "outbound_requires_human_approval":
      return "per_action_human_confirmation"
    case "core_mutation_requires_explicit_approval":
      return "explicit_core_approval"
    case "not_allowed":
      return "none"
    default:
      return "operator_review_only"
  }
}

export function workflowRequiresProviderHealth(boundary: GrowthLeadResearchWorkflowBoundaryReport): boolean {
  return boundary.providerDependencies.some(
    (dep) => dep.includes("provider") || dep === "context_assembly" || dep.includes("analyze_reply"),
  )
}

export function resolveWorkflowPreflightStatus(input: {
  boundary: GrowthLeadResearchWorkflowBoundaryReport
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure
}): { status: GrowthLeadResearchExecutionPreflightStatus; missingRequirements: string[] } {
  const { boundary, infrastructure } = input
  const missing: string[] = []

  if (boundary.classification === "not_allowed" || !boundary.futureExecutionAllowed) {
    return {
      status: "preflight_not_allowed",
      missingRequirements: ["Workflow is not allowed for future runtime implementation."],
    }
  }

  if (boundary.requiredFeatureFlags.length > 0 && !infrastructure.workflowFeatureEnabled) {
    missing.push(`Feature flag required: ${boundary.requiredFeatureFlags.join(", ")}`)
    return { status: "preflight_blocked_missing_feature_flag", missingRequirements: missing }
  }

  if (boundary.requiredKillSwitches.includes("autonomy_enabled") && !infrastructure.autonomyEnabled) {
    missing.push("Kill switch required: autonomy_enabled")
    return { status: "preflight_blocked_missing_kill_switch", missingRequirements: missing }
  }

  if (infrastructure.emergencyStopActive) {
    missing.push("Emergency stop must be inactive")
    return { status: "preflight_blocked_missing_kill_switch", missingRequirements: missing }
  }

  const needsProvider = workflowRequiresProviderHealth(boundary)
  if (needsProvider && !infrastructure.providerReady) {
    missing.push("AI OS provider health check failed")
    return { status: "preflight_blocked_provider_unavailable", missingRequirements: missing }
  }

  if (
    boundary.classification !== "planning_only" &&
    boundary.classification !== "read_only_runtime" &&
    boundary.requiredBudgetControls.length === 0
  ) {
    missing.push("Budget control definition missing from boundary catalog")
    return { status: "preflight_blocked_missing_budget_control", missingRequirements: missing }
  }

  if (boundary.requiredApprovalGates.length === 0) {
    missing.push("Approval gate definition missing from boundary catalog")
    return { status: "preflight_blocked_missing_approval_gate", missingRequirements: missing }
  }

  if (boundary.requiredAuditEvents.length === 0) {
    missing.push("Audit event coverage missing from boundary catalog")
    return { status: "preflight_blocked_missing_audit_event", missingRequirements: missing }
  }

  if (
    (boundary.coreTouchRisk === "high" || boundary.coreTouchRisk === "medium") &&
    boundary.classification === "core_mutation_requires_explicit_approval" &&
    !boundary.requiredApprovalGates.some((gate) => gate.includes("core") || gate.includes("explicit"))
  ) {
    missing.push(`Core risk ${boundary.coreTouchRisk} requires explicit Core approval gate`)
    return { status: "preflight_blocked_core_risk", missingRequirements: missing }
  }

  if (
    (boundary.outboundRisk === "high" || boundary.outboundRisk === "medium") &&
    !boundary.requiredApprovalGates.some(
      (gate) =>
        gate.includes("human") ||
        gate.includes("outbound") ||
        gate.includes("draft") ||
        gate.includes("operator"),
    )
  ) {
    missing.push(`Outbound risk ${boundary.outboundRisk} requires human approval gate`)
    return { status: "preflight_blocked_outbound_risk", missingRequirements: missing }
  }

  if (boundary.missingGuardrails.length > 0) {
    missing.push(...boundary.missingGuardrails)
    if (needsProvider && !infrastructure.providerReady) {
      return { status: "preflight_blocked_provider_unavailable", missingRequirements: missing }
    }
    if (!infrastructure.workflowFeatureEnabled) {
      return { status: "preflight_blocked_missing_feature_flag", missingRequirements: missing }
    }
  }

  return { status: "preflight_passed", missingRequirements: [] }
}

export function buildWorkflowPreflightChecklist(input: {
  boundary: GrowthLeadResearchWorkflowBoundaryReport
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure
}): GrowthLeadResearchWorkflowPreflightChecklist {
  const { boundary, infrastructure } = input
  const needsProvider = workflowRequiresProviderHealth(boundary)
  const { status, missingRequirements } = resolveWorkflowPreflightStatus({ boundary, infrastructure })

  const operatorVisibility = [
    ...boundary.dependentComponents.slice(0, 2),
    ...boundary.dependentRoutes.slice(0, 2),
  ]

  const runtimeImplementationAllowed = status === "preflight_passed"

  const preflightSummary =
    status === "preflight_passed"
      ? `${boundary.workflowType.replaceAll("_", " ")} preflight passed — eligible for future runtime design.`
      : `${boundary.workflowType.replaceAll("_", " ")} preflight blocked (${status.replaceAll("_", " ")}) — ${missingRequirements[0] ?? "resolve requirements"}.`

  return {
    workflowType: boundary.workflowType,
    boundaryClassification: boundary.classification,
    requiredFeatureFlags: boundary.requiredFeatureFlags,
    requiredKillSwitches: boundary.requiredKillSwitches,
    requiredBudgetControls: boundary.requiredBudgetControls,
    requiredApprovalGates: boundary.requiredApprovalGates,
    requiredAuditEvents: boundary.requiredAuditEvents,
    requiredProviderHealthCheck: needsProvider,
    providerHealthReady: !needsProvider || infrastructure.providerReady,
    requiredRollbackBehavior: boundary.rollbackBehavior,
    requiredOperatorVisibility: operatorVisibility,
    requiredHumanConfirmationLevel: resolveHumanConfirmationLevel(boundary.classification),
    coreRiskStatus: boundary.coreTouchRisk,
    outboundRiskStatus: boundary.outboundRisk,
    preflightStatus: status,
    missingRequirements,
    runtimeImplementationAllowed,
    preflightSummary,
  }
}

export function buildAllWorkflowPreflightChecklists(input: {
  boundaries: GrowthLeadResearchWorkflowBoundaryReport[]
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure
}): GrowthLeadResearchWorkflowPreflightChecklist[] {
  return input.boundaries.map((boundary) =>
    buildWorkflowPreflightChecklist({ boundary, infrastructure: input.infrastructure }),
  )
}

export function buildPlanPreflightChecklist(input: {
  handoff: GrowthLeadResearchFutureExecutionHandoffContract
  workflowChecklist: GrowthLeadResearchWorkflowPreflightChecklist
}): GrowthLeadResearchPlanPreflightChecklist {
  const missingRequirements = [...input.workflowChecklist.missingRequirements]

  if (input.handoff.handoffState !== "handoff_ready") {
    missingRequirements.push(`Handoff state: ${input.handoff.handoffState.replaceAll("_", " ")}`)
  }
  if (input.handoff.approvalState !== "approved_for_future_execution") {
    missingRequirements.push(`Approval state: ${input.handoff.approvalState.replaceAll("_", " ")}`)
  }
  missingRequirements.push(...input.handoff.blockedReasons)

  let preflightStatus = input.workflowChecklist.preflightStatus
  if (preflightStatus === "preflight_passed") {
    if (input.handoff.handoffState !== "handoff_ready") {
      preflightStatus = "preflight_blocked_missing_approval_gate"
    }
  }

  const runtimeImplementationAllowed =
    preflightStatus === "preflight_passed" &&
    input.handoff.handoffState === "handoff_ready" &&
    input.workflowChecklist.runtimeImplementationAllowed

  const uniqueMissing = [...new Set(missingRequirements)]

  return {
    planId: input.handoff.planId,
    leadId: input.handoff.leadId,
    companyName: input.handoff.companyName,
    workflowType: input.workflowChecklist.workflowType,
    preflightStatus,
    missingRequirements: uniqueMissing,
    runtimeImplementationAllowed,
    preflightSummary: runtimeImplementationAllowed
      ? `Plan preflight passed — ${input.handoff.recommendedWorkflow.replaceAll("_", " ")} ready for future runtime design.`
      : `Plan preflight blocked — ${uniqueMissing[0] ?? "resolve checklist items"}.`,
    observationHref: input.handoff.observationHref,
  }
}

export function buildExecutionPreflightSystemSummary(input: {
  workflowChecklists: GrowthLeadResearchWorkflowPreflightChecklist[]
}): GrowthLeadResearchExecutionPreflightSystemSummary {
  const preflightPassedCount = input.workflowChecklists.filter(
    (row) => row.preflightStatus === "preflight_passed",
  ).length
  const notAllowedCount = input.workflowChecklists.filter(
    (row) => row.preflightStatus === "preflight_not_allowed",
  ).length
  const blockedCount = input.workflowChecklists.length - preflightPassedCount - notAllowedCount
  const blockedWorkflows = input.workflowChecklists
    .filter((row) => row.preflightStatus !== "preflight_passed" && row.preflightStatus !== "preflight_not_allowed")
    .map((row) => row.workflowType)

  return {
    workflowsChecked: input.workflowChecklists.length,
    preflightPassedCount,
    blockedCount,
    notAllowedCount,
    blockedWorkflows,
    headline: `${input.workflowChecklists.length} workflow preflight checklists — ${preflightPassedCount} passed, ${blockedCount} blocked, ${notAllowedCount} not allowed.`,
  }
}

export function summarizePlanPreflightChecklist(
  checklist: Pick<GrowthLeadResearchPlanPreflightChecklist, "preflightStatus" | "preflightSummary" | "runtimeImplementationAllowed">,
): string {
  return checklist.runtimeImplementationAllowed
    ? "Preflight passed"
    : checklist.preflightSummary
}
