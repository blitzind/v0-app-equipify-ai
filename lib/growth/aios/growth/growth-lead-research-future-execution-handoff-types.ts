/** GE-AIOS-GROWTH-1F — Future Execution Handoff Contract (client-safe). */

import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchEvidenceSummary } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type {
  GrowthLeadResearchApprovedPlanReadinessState,
  GrowthLeadResearchExecutionPlanAuditTrail,
} from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"

export const GROWTH_AIOS_GROWTH_1F_PHASE = "GE-AIOS-GROWTH-1F" as const

export const GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_QA_MARKER =
  "growth-aios-growth-1f-future-execution-handoff-v1" as const

export const GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_STATES = [
  "handoff_ready",
  "handoff_blocked_missing_approval",
  "handoff_blocked_missing_prerequisites",
  "handoff_blocked_low_confidence",
  "handoff_blocked_provider_unavailable",
  "handoff_not_applicable",
] as const

export type GrowthLeadResearchFutureExecutionHandoffState =
  (typeof GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_STATES)[number]

export type GrowthLeadResearchFutureExecutionHandoffInfrastructure = {
  providerReady: boolean
  availableProviderIds: string[]
  autonomyEnabled: boolean
  emergencyStopActive: boolean
  workflowFeatureEnabled: boolean
}

export type GrowthLeadResearchFutureExecutionHandoffContract = {
  planId: string
  leadId: string
  companyName: string | null
  recommendedWorkflow: string
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState
  handoffState: GrowthLeadResearchFutureExecutionHandoffState
  futureExecutionEligible: boolean
  requiredInputs: string[]
  requiredEvidence: string[]
  requiredApprovals: string[]
  requiredProviderCapabilities: string[]
  requiredGuardrails: string[]
  expectedWorkOrderType: AiWorkOrderType | null
  blockedReasons: string[]
  rollbackRequirements: string
  auditReferences: string[]
  generatedAt: string
  handoffSummary: string
  observationHref: string
}

export const GROWTH_LEAD_RESEARCH_FUTURE_EXECUTION_HANDOFF_RUNTIME_RULE =
  "Future Execution Handoff is a read-only contract — it specifies what a future execution phase would require without creating Work Orders, invoking providers, or sending outbound." as const

export function requiredProviderCapabilitiesForWorkflow(
  workflowType: GrowthLeadResearchExecutionPlan["workflowType"],
): string[] {
  switch (workflowType) {
    case "verify_email":
    case "buying_committee":
    case "outreach_generation":
    case "research_company":
      return ["ai_os_provider_ready", "context_assembly", "decision_record_gate"]
    case "meeting_preparation":
      return ["ai_os_provider_ready", "context_assembly", "operator_briefing_review"]
    case "monitoring":
      return ["event_subscription", "analyze_reply_agent", "reassessment_trigger"]
    case "approval":
      return ["operator_review_only"]
    case "close":
      return ["operator_review_only", "abandon_documentation"]
    default:
      return ["operator_review_only"]
  }
}

export function requiredGuardrailsForHandoff(): string[] {
  return [
    "growth_lead_research_workflow_enabled",
    "autonomy_enabled",
    "emergency_stop_inactive",
    "explicit_operator_work_order_approval",
    "decision_gate_before_execution",
    "no_autonomous_outbound",
  ]
}

export function resolveHandoffInfrastructureBlockedReasons(
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure,
): string[] {
  const blocked: string[] = []
  if (!infrastructure.workflowFeatureEnabled) {
    blocked.push("Growth Lead Research workflow feature is disabled.")
  }
  if (!infrastructure.autonomyEnabled) {
    blocked.push("Autonomy kill switch is off — future execution handoff blocked.")
  }
  if (infrastructure.emergencyStopActive) {
    blocked.push("Emergency stop is active — future execution handoff blocked.")
  }
  if (!infrastructure.providerReady) {
    blocked.push("AI OS provider runtime is not ready.")
  }
  if (infrastructure.availableProviderIds.length === 0) {
    blocked.push("No AI provider credentials are available.")
  }
  return blocked
}

export function resolveFutureExecutionHandoffState(input: {
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure
}): GrowthLeadResearchFutureExecutionHandoffState {
  if (input.readinessState === "not_applicable") {
    return "handoff_not_applicable"
  }
  if (input.approvalState !== "approved_for_future_execution") {
    return "handoff_blocked_missing_approval"
  }
  if (input.readinessState === "blocked_missing_prerequisites") {
    return "handoff_blocked_missing_prerequisites"
  }
  if (input.readinessState === "blocked_low_confidence") {
    return "handoff_blocked_low_confidence"
  }
  const infrastructureBlocked = resolveHandoffInfrastructureBlockedReasons(input.infrastructure)
  if (infrastructureBlocked.length > 0) {
    return "handoff_blocked_provider_unavailable"
  }
  if (input.readinessState === "ready_for_future_execution") {
    return "handoff_ready"
  }
  return "handoff_blocked_missing_approval"
}

export function buildHandoffRequiredInputs(plan: GrowthLeadResearchExecutionPlan): string[] {
  return [
    ...plan.prerequisites,
    "Lead id and organization context",
    "Latest assessed workflow snapshot",
    "Operator-approved execution plan id",
  ]
}

export function buildHandoffRequiredEvidence(
  plan: GrowthLeadResearchExecutionPlan,
  evidenceSummary: GrowthLeadResearchEvidenceSummary | null,
): string[] {
  const fromPlan = plan.requiredEvidence
  const fromSummary = evidenceSummary
    ? [
        ...evidenceSummary.verifiedEvidence.map((item) => `Verified: ${item}`),
        ...evidenceSummary.missingEvidence.map((item) => `Resolve: ${item}`),
      ]
    : []
  return [...new Set([...fromPlan, ...fromSummary])].slice(0, 8)
}

export function buildHandoffRequiredApprovals(
  plan: GrowthLeadResearchExecutionPlan,
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus,
): string[] {
  const approvals = [
    "Operator approval for future execution (recorded)",
    "Decision Record gate before Work Order execution",
  ]
  if (plan.approvalRequired) {
    approvals.push("Per-step operator approval before any outbound action")
  }
  if (approvalState !== "approved_for_future_execution") {
    approvals.push("Pending: operator approval for future execution")
  }
  if (plan.requiredWorkOrders.length > 0) {
    approvals.push(`Mission Planning Review approval before ${plan.requiredWorkOrders[0].replaceAll("_", " ")} Work Order`)
  }
  return approvals
}

export function resolveExpectedWorkOrderType(
  plan: GrowthLeadResearchExecutionPlan,
  handoffState: GrowthLeadResearchFutureExecutionHandoffState,
): AiWorkOrderType | null {
  if (handoffState !== "handoff_ready") return null
  return plan.requiredWorkOrders[0] ?? null
}

export function buildFutureExecutionHandoffContract(input: {
  planId: string
  leadId: string
  companyName: string | null
  plan: GrowthLeadResearchExecutionPlan
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState
  readinessReason: string
  futureExecutionEligible: boolean
  evidenceSummary: GrowthLeadResearchEvidenceSummary | null
  auditTrail: GrowthLeadResearchExecutionPlanAuditTrail
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure
  generatedAt: string
  observationHref: string
}): GrowthLeadResearchFutureExecutionHandoffContract {
  const handoffState = resolveFutureExecutionHandoffState({
    approvalState: input.approvalState,
    readinessState: input.readinessState,
    infrastructure: input.infrastructure,
  })

  const infrastructureBlocked = resolveHandoffInfrastructureBlockedReasons(input.infrastructure)
  const blockedReasons: string[] = []

  if (handoffState === "handoff_blocked_missing_approval") {
    blockedReasons.push(`Approval state is "${input.approvalState.replaceAll("_", " ")}" — operator approval required.`)
  }
  if (handoffState === "handoff_blocked_missing_prerequisites") {
    blockedReasons.push(...input.plan.missingPrerequisites.map((item) => `Missing prerequisite: ${item}`))
  }
  if (handoffState === "handoff_blocked_low_confidence") {
    blockedReasons.push(input.readinessReason)
  }
  if (handoffState === "handoff_blocked_provider_unavailable") {
    blockedReasons.push(...infrastructureBlocked)
  }
  if (handoffState === "handoff_not_applicable") {
    blockedReasons.push(input.readinessReason)
  }

  const requiredProviderCapabilities = requiredProviderCapabilitiesForWorkflow(input.plan.workflowType)
  const requiredGuardrails = requiredGuardrailsForHandoff()
  const expectedWorkOrderType = resolveExpectedWorkOrderType(input.plan, handoffState)

  const handoffSummary =
    handoffState === "handoff_ready"
      ? `Handoff contract ready — future phase may request ${expectedWorkOrderType?.replaceAll("_", " ") ?? "operator review"} with all guardrails satisfied.`
      : `Handoff blocked (${handoffState.replaceAll("_", " ")}) — ${blockedReasons[0] ?? "resolve blockers before future execution."}`

  return {
    planId: input.planId,
    leadId: input.leadId,
    companyName: input.companyName,
    recommendedWorkflow: input.plan.workflowType,
    approvalState: input.approvalState,
    readinessState: input.readinessState,
    handoffState,
    futureExecutionEligible: handoffState === "handoff_ready",
    requiredInputs: buildHandoffRequiredInputs(input.plan),
    requiredEvidence: buildHandoffRequiredEvidence(input.plan, input.evidenceSummary),
    requiredApprovals: buildHandoffRequiredApprovals(input.plan, input.approvalState),
    requiredProviderCapabilities,
    requiredGuardrails,
    expectedWorkOrderType,
    blockedReasons,
    rollbackRequirements: input.plan.rollbackStrategy,
    auditReferences: input.auditTrail.entries.map((entry) => entry.eventId),
    generatedAt: input.generatedAt,
    handoffSummary,
    observationHref: input.observationHref,
  }
}

export function summarizeFutureExecutionHandoffContract(
  contract: Pick<GrowthLeadResearchFutureExecutionHandoffContract, "handoffState" | "handoffSummary" | "blockedReasons">,
): string {
  if (contract.handoffState === "handoff_ready") {
    return contract.handoffSummary
  }
  return `${contract.handoffSummary} ${contract.blockedReasons.length > 0 ? `Reason: ${contract.blockedReasons[0]}` : ""}`.trim()
}
