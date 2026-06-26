/** GE-AIOS-GROWTH-2A — Execution Runtime Boundary Audit (client-safe). */

import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import {
  GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES,
  type GrowthLeadResearchCanonicalWorkflowType,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchFutureExecutionHandoffContract } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import type { GrowthLeadResearchFutureExecutionHandoffInfrastructure } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import { requiredGuardrailsForHandoff } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"

export const GROWTH_AIOS_GROWTH_2A_PHASE = "GE-AIOS-GROWTH-2A" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_QA_MARKER =
  "growth-aios-growth-2a-execution-boundary-audit-v1" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_CLASSIFICATIONS = [
  "planning_only",
  "read_only_runtime",
  "internal_mutation_only",
  "outbound_requires_human_approval",
  "core_mutation_requires_explicit_approval",
  "not_allowed",
] as const

export type GrowthLeadResearchExecutionBoundaryClassification =
  (typeof GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_CLASSIFICATIONS)[number]

export type GrowthLeadResearchWorkflowBoundaryDefinition = {
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  classification: GrowthLeadResearchExecutionBoundaryClassification
  dependentServices: string[]
  dependentRoutes: string[]
  dependentComponents: string[]
  providerDependencies: string[]
  requiredFeatureFlags: string[]
  requiredKillSwitches: string[]
  requiredBudgetControls: string[]
  requiredApprovalGates: string[]
  requiredAuditEvents: string[]
  rollbackBehavior: string
  coreTouchRisk: "none" | "low" | "medium" | "high"
  outboundRisk: "none" | "low" | "medium" | "high"
  safeWorkOrderType: AiWorkOrderType | null
  futureExecutionAllowed: boolean
  notes: string
}

export type GrowthLeadResearchWorkflowBoundaryReport = GrowthLeadResearchWorkflowBoundaryDefinition & {
  missingGuardrails: string[]
  auditSummary: string
}

export type GrowthLeadResearchExecutionBoundarySystemSummary = {
  workflowsAudited: number
  futureExecutionAllowedCount: number
  outboundRiskWorkflows: GrowthLeadResearchCanonicalWorkflowType[]
  coreRiskWorkflows: GrowthLeadResearchCanonicalWorkflowType[]
  planningOnlyWorkflows: GrowthLeadResearchCanonicalWorkflowType[]
  notAllowedWorkflows: GrowthLeadResearchCanonicalWorkflowType[]
  missingGlobalGuardrails: string[]
  systemRiskLevel: "low" | "medium" | "high"
  headline: string
}

export type GrowthLeadResearchPlanExecutionBoundaryStatus = {
  planId: string
  leadId: string
  companyName: string | null
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  classification: GrowthLeadResearchExecutionBoundaryClassification
  futureExecutionAllowed: boolean
  outboundRisk: GrowthLeadResearchWorkflowBoundaryReport["outboundRisk"]
  coreTouchRisk: GrowthLeadResearchWorkflowBoundaryReport["coreTouchRisk"]
  missingGuardrails: string[]
  boundaryWarnings: string[]
  boundarySummary: string
  observationHref: string
}

export type GrowthLeadResearchExecutionBoundaryAuditReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_QA_MARKER
  generatedAt: string
  workflowReports: GrowthLeadResearchWorkflowBoundaryReport[]
  systemSummary: GrowthLeadResearchExecutionBoundarySystemSummary
  planBoundaries: GrowthLeadResearchPlanExecutionBoundaryStatus[]
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_BOUNDARY_AUDIT_RUNTIME_RULE =
  "Execution Boundary Audit is read-only — it maps future execution pathways and risks without invoking providers, creating Work Orders, or mutating Core." as const

export const GROWTH_LEAD_RESEARCH_WORKFLOW_BOUNDARY_CATALOG: Record<
  GrowthLeadResearchCanonicalWorkflowType,
  GrowthLeadResearchWorkflowBoundaryDefinition
> = {
  verify_email: {
    workflowType: "verify_email",
    classification: "internal_mutation_only",
    dependentServices: [
      "lib/growth/aios/ai-decision-gate-service.ts",
      "lib/growth/aios/ai-context-assembly-service.ts",
      "lib/growth/aios/growth/growth-lead-research-workflow-service.ts",
    ],
    dependentRoutes: ["app/api/platform/growth/ai-os/pilot/lead-research/[leadId]/route.ts"],
    dependentComponents: ["components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx"],
    providerDependencies: ["ai_os_provider_ready", "context_assembly"],
    requiredFeatureFlags: ["GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED"],
    requiredKillSwitches: ["autonomy_enabled"],
    requiredBudgetControls: ["ai-decision-engine-cost verify_email unit cap"],
    requiredApprovalGates: ["operator_execution_plan_approval", "decision_record_gate", "mission_planning_review"],
    requiredAuditEvents: ["growth.workflow.status_changed", "growth.execution_plan.review_changed", "decision.recorded"],
    rollbackBehavior: "Pause verify Work Order, revert to assessed state, route to human review.",
    coreTouchRisk: "none",
    outboundRisk: "low",
    safeWorkOrderType: "verify_email",
    futureExecutionAllowed: true,
    notes: "Verification mutates lead contact metadata in Growth only — no outbound send.",
  },
  buying_committee: {
    workflowType: "buying_committee",
    classification: "internal_mutation_only",
    dependentServices: [
      "lib/growth/aios/ai-decision-gate-service.ts",
      "lib/growth/aios/ai-context-assembly-service.ts",
    ],
    dependentRoutes: ["app/api/platform/growth/ai-os/missions/[missionId]/planning/route.ts"],
    dependentComponents: ["components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-review-dashboard.tsx"],
    providerDependencies: ["ai_os_provider_ready", "context_assembly"],
    requiredFeatureFlags: ["GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED"],
    requiredKillSwitches: ["autonomy_enabled"],
    requiredBudgetControls: ["provider token budget per Work Order"],
    requiredApprovalGates: ["operator_execution_plan_approval", "decision_record_gate"],
    requiredAuditEvents: ["growth.workflow.status_changed", "decision.recorded", "work_order.created"],
    rollbackBehavior: "Archive draft committee map; retain research snapshot for reassessment.",
    coreTouchRisk: "none",
    outboundRisk: "none",
    safeWorkOrderType: "generate_buying_committee",
    futureExecutionAllowed: true,
    notes: "Committee research is Growth-scoped intelligence — no contact outreach.",
  },
  outreach_generation: {
    workflowType: "outreach_generation",
    classification: "outbound_requires_human_approval",
    dependentServices: [
      "lib/growth/aios/ai-decision-gate-service.ts",
      "lib/growth/aios/ai-executive-mission-planning-review-service.ts",
    ],
    dependentRoutes: [
      "app/api/platform/growth/ai-os/missions/[missionId]/planning/approve/route.ts",
      "app/api/platform/growth/ai-os/execution-plan-review/[leadId]/action/route.ts",
    ],
    dependentComponents: [
      "components/growth/ai-os/executive-planning-review/growth-ai-os-approval-action-card.tsx",
      "components/growth/ai-os/command-center/growth-ai-os-execution-plan-review-section.tsx",
    ],
    providerDependencies: ["ai_os_provider_ready", "context_assembly"],
    requiredFeatureFlags: ["GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED"],
    requiredKillSwitches: ["autonomy_enabled", "deliverability_throttle"],
    requiredBudgetControls: ["generate_email cost cap", "daily outbound budget guardrail"],
    requiredApprovalGates: [
      "operator_execution_plan_approval",
      "mission_planning_review_approve",
      "per_draft_human_approval_before_send",
    ],
    requiredAuditEvents: [
      "growth.execution_plan.review_changed",
      "executive.planning_review_approved",
      "decision.gate_passed",
    ],
    rollbackBehavior: "Discard draft outreach; never enqueue SENDR or transport without explicit operator send.",
    coreTouchRisk: "low",
    outboundRisk: "high",
    safeWorkOrderType: "generate_email",
    futureExecutionAllowed: true,
    notes: "Draft-only until operator approves — SENDR and transport paths must remain disconnected in Growth AI OS phase.",
  },
  meeting_preparation: {
    workflowType: "meeting_preparation",
    classification: "internal_mutation_only",
    dependentServices: ["lib/growth/aios/ai-context-assembly-service.ts"],
    dependentRoutes: ["app/api/platform/growth/ai-os/missions/[missionId]/planning/route.ts"],
    dependentComponents: ["components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx"],
    providerDependencies: ["ai_os_provider_ready", "context_assembly"],
    requiredFeatureFlags: ["GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED"],
    requiredKillSwitches: ["autonomy_enabled"],
    requiredBudgetControls: ["prepare_meeting provider unit cap"],
    requiredApprovalGates: ["operator_execution_plan_approval", "operator_briefing_review"],
    requiredAuditEvents: ["growth.workflow.status_changed", "decision.recorded"],
    rollbackBehavior: "Archive meeting brief; no calendar invites without operator action.",
    coreTouchRisk: "none",
    outboundRisk: "low",
    safeWorkOrderType: "prepare_meeting",
    futureExecutionAllowed: true,
    notes: "Briefing artifact only — no calendar or invite automation in current boundary.",
  },
  monitoring: {
    workflowType: "monitoring",
    classification: "read_only_runtime",
    dependentServices: ["lib/growth/aios/ai-event-service.ts"],
    dependentRoutes: ["app/api/platform/growth/ai-os/command-center/route.ts"],
    dependentComponents: ["components/growth/ai-os/command-center/growth-ai-os-approved-plan-readiness-section.tsx"],
    providerDependencies: ["event_subscription", "analyze_reply_agent"],
    requiredFeatureFlags: ["GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED"],
    requiredKillSwitches: ["autonomy_enabled"],
    requiredBudgetControls: ["monitoring tick budget cap"],
    requiredApprovalGates: ["operator_execution_plan_approval"],
    requiredAuditEvents: ["growth.workflow.status_changed", "conversation.reply_received"],
    rollbackBehavior: "Stop monitoring subscription; retain last assessed snapshot.",
    coreTouchRisk: "none",
    outboundRisk: "none",
    safeWorkOrderType: "analyze_reply",
    futureExecutionAllowed: true,
    notes: "Signal observation and reassessment trigger only — no proactive outreach.",
  },
  approval: {
    workflowType: "approval",
    classification: "planning_only",
    dependentServices: ["lib/growth/aios/growth/growth-lead-research-execution-plan-review-service.ts"],
    dependentRoutes: ["app/api/platform/growth/ai-os/execution-plan-review/[leadId]/action/route.ts"],
    dependentComponents: ["components/growth/ai-os/command-center/growth-ai-os-execution-plan-review-section.tsx"],
    providerDependencies: [],
    requiredFeatureFlags: ["GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED"],
    requiredKillSwitches: ["autonomy_enabled"],
    requiredBudgetControls: [],
    requiredApprovalGates: ["operator_execution_plan_review"],
    requiredAuditEvents: ["growth.execution_plan.review_changed"],
    rollbackBehavior: "Revert to assessed state with human review notes.",
    coreTouchRisk: "none",
    outboundRisk: "none",
    safeWorkOrderType: null,
    futureExecutionAllowed: false,
    notes: "Human review routing only — no Work Order execution path.",
  },
  close: {
    workflowType: "close",
    classification: "planning_only",
    dependentServices: ["lib/growth/aios/growth/growth-lead-research-workflow-service.ts"],
    dependentRoutes: [],
    dependentComponents: ["components/growth/ai-os/growth/growth-ai-os-lead-research-execution-plan-section.tsx"],
    providerDependencies: [],
    requiredFeatureFlags: ["GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED"],
    requiredKillSwitches: ["autonomy_enabled"],
    requiredBudgetControls: [],
    requiredApprovalGates: ["operator_abandon_confirmation"],
    requiredAuditEvents: ["growth.workflow.status_changed", "growth.execution_plan.review_changed"],
    rollbackBehavior: "Lead remains in CRM for future reconsideration — no destructive Core deletes.",
    coreTouchRisk: "low",
    outboundRisk: "none",
    safeWorkOrderType: null,
    futureExecutionAllowed: false,
    notes: "Abandon documentation only — must not mutate Equipify Core invoices/quotes/work orders.",
  },
  research_company: {
    workflowType: "research_company",
    classification: "internal_mutation_only",
    dependentServices: [
      "lib/growth/aios/pilot/lead-research-agent-executor.ts",
      "lib/growth/aios/growth/growth-lead-research-workflow-service.ts",
    ],
    dependentRoutes: ["app/api/platform/growth/ai-os/pilot/lead-research/[leadId]/route.ts"],
    dependentComponents: ["components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx"],
    providerDependencies: ["ai_os_provider_ready", "context_assembly"],
    requiredFeatureFlags: [
      "GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED",
      "GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLE_AI_EVIDENCE",
    ],
    requiredKillSwitches: ["autonomy_enabled"],
    requiredBudgetControls: ["research_company provider token cap", "pilot budget guardrail"],
    requiredApprovalGates: ["decision_record_gate"],
    requiredAuditEvents: [
      "pilot.lead_research_started",
      "growth.workflow.status_changed",
      "decision.recorded",
    ],
    rollbackBehavior: "Cancel in-flight research Work Order; preserve partial research run for audit.",
    coreTouchRisk: "none",
    outboundRisk: "none",
    safeWorkOrderType: "research_company",
    futureExecutionAllowed: true,
    notes: "Only existing pilot executor path — bounded to Growth lead research.",
  },
}

export function resolveMissingGlobalGuardrails(
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure,
): string[] {
  const missing: string[] = []
  const required = requiredGuardrailsForHandoff()

  if (!infrastructure.workflowFeatureEnabled) {
    missing.push(`${required[0]} — feature flag off`)
  }
  if (!infrastructure.autonomyEnabled) {
    missing.push(`${required[1]} — autonomy kill switch off`)
  }
  if (infrastructure.emergencyStopActive) {
    missing.push(`${required[2]} — emergency stop active`)
  }
  if (!infrastructure.providerReady) {
    missing.push("ai_os_provider_ready — provider runtime degraded")
  }

  return missing
}

export function auditWorkflowBoundary(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure,
): GrowthLeadResearchWorkflowBoundaryReport {
  const definition = GROWTH_LEAD_RESEARCH_WORKFLOW_BOUNDARY_CATALOG[workflowType]
  const missingGuardrails = [
    ...resolveMissingGlobalGuardrails(infrastructure),
    ...(definition.providerDependencies.includes("ai_os_provider_ready") && !infrastructure.providerReady
      ? [`Provider required for ${workflowType} but AI OS provider is not ready`]
      : []),
  ]

  const auditSummary =
    definition.classification === "not_allowed"
      ? `${workflowType} is not allowed for future autonomous execution.`
      : missingGuardrails.length > 0
        ? `${workflowType} boundary mapped — ${missingGuardrails.length} guardrail gap(s) before runtime.`
        : `${workflowType} boundary mapped — ${definition.classification.replaceAll("_", " ")} with ${definition.safeWorkOrderType ?? "no Work Order"}.`

  return {
    ...definition,
    missingGuardrails,
    auditSummary,
  }
}

export function buildExecutionBoundarySystemSummary(input: {
  workflowReports: GrowthLeadResearchWorkflowBoundaryReport[]
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure
}): GrowthLeadResearchExecutionBoundarySystemSummary {
  const outboundRiskWorkflows = input.workflowReports
    .filter((report) => report.outboundRisk === "high" || report.outboundRisk === "medium")
    .map((report) => report.workflowType)

  const coreRiskWorkflows = input.workflowReports
    .filter((report) => report.coreTouchRisk === "high" || report.coreTouchRisk === "medium")
    .map((report) => report.workflowType)

  const planningOnlyWorkflows = input.workflowReports
    .filter((report) => report.classification === "planning_only")
    .map((report) => report.workflowType)

  const notAllowedWorkflows = input.workflowReports
    .filter((report) => report.classification === "not_allowed" || !report.futureExecutionAllowed)
    .map((report) => report.workflowType)

  const missingGlobalGuardrails = resolveMissingGlobalGuardrails(input.infrastructure)

  const futureExecutionAllowedCount = input.workflowReports.filter(
    (report) => report.futureExecutionAllowed && report.classification !== "not_allowed",
  ).length

  const systemRiskLevel: GrowthLeadResearchExecutionBoundarySystemSummary["systemRiskLevel"] =
    outboundRiskWorkflows.length > 0 || missingGlobalGuardrails.length > 2
      ? "high"
      : missingGlobalGuardrails.length > 0 || coreRiskWorkflows.length > 0
        ? "medium"
        : "low"

  return {
    workflowsAudited: input.workflowReports.length,
    futureExecutionAllowedCount,
    outboundRiskWorkflows,
    coreRiskWorkflows,
    planningOnlyWorkflows,
    notAllowedWorkflows,
    missingGlobalGuardrails,
    systemRiskLevel,
    headline: `${input.workflowReports.length} workflow boundaries audited — ${futureExecutionAllowedCount} allowed for future execution, ${outboundRiskWorkflows.length} outbound-risk pathway(s).`,
  }
}

export function buildAllWorkflowBoundaryReports(
  infrastructure: GrowthLeadResearchFutureExecutionHandoffInfrastructure,
): GrowthLeadResearchWorkflowBoundaryReport[] {
  return GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES.map((workflowType) =>
    auditWorkflowBoundary(workflowType, infrastructure),
  )
}

export function buildPlanExecutionBoundaryStatus(input: {
  handoff: GrowthLeadResearchFutureExecutionHandoffContract
  workflowReport: GrowthLeadResearchWorkflowBoundaryReport
}): GrowthLeadResearchPlanExecutionBoundaryStatus {
  const boundaryWarnings: string[] = []

  if (input.workflowReport.classification === "not_allowed") {
    boundaryWarnings.push("Workflow classification is not_allowed for future execution.")
  }
  if (!input.workflowReport.futureExecutionAllowed) {
    boundaryWarnings.push("Workflow catalog marks future execution as disallowed.")
  }
  if (input.workflowReport.outboundRisk === "high") {
    boundaryWarnings.push("High outbound risk — human approval required before any send path.")
  }
  if (input.workflowReport.coreTouchRisk !== "none") {
    boundaryWarnings.push(`Core touch risk: ${input.workflowReport.coreTouchRisk}.`)
  }
  if (input.handoff.handoffState !== "handoff_ready") {
    boundaryWarnings.push(`Handoff not ready (${input.handoff.handoffState.replaceAll("_", " ")}).`)
  }
  boundaryWarnings.push(...input.workflowReport.missingGuardrails)
  boundaryWarnings.push(...input.handoff.blockedReasons)

  const futureExecutionAllowed =
    input.workflowReport.futureExecutionAllowed &&
    input.workflowReport.classification !== "not_allowed" &&
    input.handoff.handoffState === "handoff_ready" &&
    input.workflowReport.missingGuardrails.length === 0

  const boundarySummary = futureExecutionAllowed
    ? `Boundary clear for ${input.handoff.recommendedWorkflow.replaceAll("_", " ")} (${input.workflowReport.classification.replaceAll("_", " ")}).`
    : `Boundary blocked — ${boundaryWarnings[0] ?? "resolve guardrails before runtime."}`

  return {
    planId: input.handoff.planId,
    leadId: input.handoff.leadId,
    companyName: input.handoff.companyName,
    workflowType: input.workflowReport.workflowType,
    classification: input.workflowReport.classification,
    futureExecutionAllowed,
    outboundRisk: input.workflowReport.outboundRisk,
    coreTouchRisk: input.workflowReport.coreTouchRisk,
    missingGuardrails: [...new Set([...input.workflowReport.missingGuardrails, ...input.handoff.blockedReasons])],
    boundaryWarnings: [...new Set(boundaryWarnings)],
    boundarySummary,
    observationHref: input.handoff.observationHref,
  }
}

export function summarizePlanBoundaryStatus(
  status: Pick<GrowthLeadResearchPlanExecutionBoundaryStatus, "futureExecutionAllowed" | "boundarySummary" | "classification">,
): string {
  return status.futureExecutionAllowed
    ? `Boundary OK · ${status.classification.replaceAll("_", " ")}`
    : status.boundarySummary
}
