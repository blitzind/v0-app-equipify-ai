/** GE-AIOS-GROWTH-1C — Next Best Action Workflow Planner (client-safe). */

import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import {
  GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
} from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"
import type {
  GrowthLeadResearchEvidenceSummary,
  GrowthLeadResearchNextBestAction,
  GrowthLeadResearchOpportunityAssessment,
  GrowthLeadResearchQualificationOutput,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"

export const GROWTH_AIOS_GROWTH_1C_PHASE = "GE-AIOS-GROWTH-1C" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_QA_MARKER =
  "growth-aios-growth-1c-execution-plan-v1" as const

export const GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES = [
  "verify_email",
  "buying_committee",
  "outreach_generation",
  "meeting_preparation",
  "monitoring",
  "approval",
  "close",
  "research_company",
] as const

export type GrowthLeadResearchCanonicalWorkflowType =
  (typeof GROWTH_LEAD_RESEARCH_CANONICAL_WORKFLOW_TYPES)[number]

export type GrowthLeadResearchExecutionReadiness =
  | "ready"
  | "blocked"
  | "needs_approval"
  | "not_applicable"

export type GrowthLeadResearchExecutionPlanStep = {
  stepId: string
  label: string
  workOrderType: AiWorkOrderType | null
}

export type GrowthLeadResearchExecutionPlan = {
  nextBestAction: string
  nextBestActionKind: GrowthLeadResearchNextBestAction["kind"]
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  estimatedSteps: GrowthLeadResearchExecutionPlanStep[]
  requiredWorkOrders: AiWorkOrderType[]
  prerequisites: string[]
  requiredEvidence: string[]
  approvalRequired: boolean
  estimatedDuration: string
  estimatedCost: "high" | "medium" | "low"
  expectedOutcome: string
  successCriteria: string[]
  failureConditions: string[]
  rollbackStrategy: string
  executionReadiness: GrowthLeadResearchExecutionReadiness
  missingPrerequisites: string[]
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_RUNTIME_RULE =
  "Execution Plan is planning-only — it maps Next Best Action to canonical workflows without creating Work Orders or sending outbound." as const

function mapKindToWorkflowType(
  kind: GrowthLeadResearchNextBestAction["kind"],
): GrowthLeadResearchCanonicalWorkflowType {
  switch (kind) {
    case "verify_email":
      return "verify_email"
    case "research_buying_committee":
      return "buying_committee"
    case "generate_outreach_draft":
      return "outreach_generation"
    case "wait_for_buying_signal":
      return "monitoring"
    case "request_human_review":
      return "approval"
    case "abandon_lead":
      return "close"
    case "continue_research":
      return "research_company"
    default:
      return "approval"
  }
}

function buildStepsForWorkflow(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
): GrowthLeadResearchExecutionPlanStep[] {
  switch (workflowType) {
    case "verify_email":
      return [
        { stepId: "assemble_context", label: "Assemble lead context", workOrderType: null },
        { stepId: "verify_email", label: "Verify contact email", workOrderType: "verify_email" },
        { stepId: "record_decision", label: "Record verification decision", workOrderType: null },
      ]
    case "buying_committee":
      return [
        { stepId: "assemble_context", label: "Assemble company context", workOrderType: null },
        { stepId: "generate_committee", label: "Research buying committee", workOrderType: "generate_buying_committee" },
        { stepId: "operator_review", label: "Operator reviews committee map", workOrderType: null },
      ]
    case "outreach_generation":
      return [
        { stepId: "assemble_context", label: "Assemble outreach context", workOrderType: null },
        { stepId: "draft_outreach", label: "Draft personalized outreach", workOrderType: "generate_email" },
        { stepId: "operator_review", label: "Operator approves draft before any send", workOrderType: null },
      ]
    case "meeting_preparation":
      return [
        { stepId: "assemble_context", label: "Assemble meeting context", workOrderType: null },
        { stepId: "prepare_meeting", label: "Prepare meeting brief", workOrderType: "prepare_meeting" },
      ]
    case "monitoring":
      return [
        { stepId: "watch_signals", label: "Monitor engagement signals", workOrderType: "analyze_reply" },
        { stepId: "reassess", label: "Re-run opportunity assessment on signal", workOrderType: null },
      ]
    case "approval":
      return [
        { stepId: "human_review", label: "Operator reviews assessment and evidence", workOrderType: null },
        { stepId: "select_next_workflow", label: "Select follow-on workflow manually", workOrderType: null },
      ]
    case "close":
      return [
        { stepId: "archive_lead", label: "Mark lead as not pursued", workOrderType: null },
        { stepId: "document_reason", label: "Document abandon rationale", workOrderType: null },
      ]
    case "research_company":
      return [
        { stepId: "plan_research", label: "Plan supplemental research", workOrderType: null },
        { stepId: "research_company", label: "Run research company Work Order", workOrderType: "research_company" },
        { stepId: "requalify", label: "Re-qualify and re-assess", workOrderType: null },
      ]
    default:
      return [{ stepId: "review", label: "Operator review required", workOrderType: null }]
  }
}

function requiredWorkOrdersForWorkflow(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
): AiWorkOrderType[] {
  switch (workflowType) {
    case "verify_email":
      return ["verify_email"]
    case "buying_committee":
      return ["generate_buying_committee"]
    case "outreach_generation":
      return ["generate_email"]
    case "meeting_preparation":
      return ["prepare_meeting"]
    case "monitoring":
      return ["analyze_reply"]
    case "research_company":
      return ["research_company"]
    case "approval":
    case "close":
      return []
    default:
      return []
  }
}

function prerequisitesForWorkflow(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
  qualification: GrowthLeadResearchQualificationOutput,
): string[] {
  const base = ["Lead research completed", "Qualification recorded", "Opportunity assessment published"]
  switch (workflowType) {
    case "verify_email":
      return [...base, "At least one contact candidate identified"]
    case "buying_committee":
      return [...base, "Company summary available", "Verified company domain or website"]
    case "outreach_generation":
      return [...base, "One likely contact identified", "Outreach angle selected"]
    case "meeting_preparation":
      return [...base, "Engagement signal or meeting intent detected"]
    case "monitoring":
      return [...base, "No urgent operator action required"]
    case "approval":
      return [...base, "Material evidence gaps or low confidence flagged"]
    case "close":
      return [...base, "Abandon recommendation accepted by operator"]
    case "research_company":
      return [...base, `Prior research confidence below threshold (${Math.round(qualification.confidence * 100)}%)`]
    default:
      return base
  }
}

function resolveMissingPrerequisites(
  prerequisites: string[],
  evidenceSummary: GrowthLeadResearchEvidenceSummary,
  qualification: GrowthLeadResearchQualificationOutput,
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
): string[] {
  const missing: string[] = []

  if (qualification.missingEvidence.length > 0) {
    missing.push(...qualification.missingEvidence)
  }

  if (workflowType === "verify_email" && evidenceSummary.verifiedEvidence.every((item) => !item.toLowerCase().includes("contact"))) {
    missing.push("No verified contact on file")
  }

  if (
    workflowType === "buying_committee" &&
    evidenceSummary.verifiedEvidence.every((item) => !item.toLowerCase().includes("decision"))
  ) {
    missing.push("Decision maker evidence not verified")
  }

  if (
    workflowType === "outreach_generation" &&
    evidenceSummary.verifiedEvidence.every((item) => !item.toLowerCase().includes("decision")) &&
    qualification.confidence < GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE
  ) {
    missing.push("Decision maker evidence not verified")
  }

  if (missing.length === 0 && prerequisites.length > basePrerequisiteCount(workflowType)) {
    return []
  }

  return [...new Set(missing)]
}

function basePrerequisiteCount(_workflowType: GrowthLeadResearchCanonicalWorkflowType): number {
  return 3
}

function resolveDuration(workflowType: GrowthLeadResearchCanonicalWorkflowType): string {
  switch (workflowType) {
    case "verify_email":
      return "1–2 business days"
    case "buying_committee":
      return "2–4 business days"
    case "outreach_generation":
      return "1–3 business days"
    case "meeting_preparation":
      return "1–2 business days"
    case "monitoring":
      return "7–14 days"
    case "research_company":
      return "1–2 business days"
    case "approval":
      return "Same day (operator dependent)"
    case "close":
      return "Same day"
    default:
      return "TBD"
  }
}

function resolveCost(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
  assessment: GrowthLeadResearchOpportunityAssessment,
): "high" | "medium" | "low" {
  if (workflowType === "close" || workflowType === "monitoring" || workflowType === "approval") return "low"
  if (workflowType === "buying_committee" || workflowType === "outreach_generation") {
    return assessment.effort === "high" ? "high" : "medium"
  }
  return assessment.effort
}

function resolveReadiness(input: {
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  approvalRequired: boolean
  missingPrerequisites: string[]
}): GrowthLeadResearchExecutionReadiness {
  if (input.workflowType === "close") return "not_applicable"
  if (input.missingPrerequisites.length > 0) return "blocked"
  if (input.approvalRequired) return "needs_approval"
  return "ready"
}

export function planGrowthLeadResearchExecution(input: {
  nextBestAction: GrowthLeadResearchNextBestAction
  opportunityAssessment: GrowthLeadResearchOpportunityAssessment
  evidenceSummary: GrowthLeadResearchEvidenceSummary
  qualification: GrowthLeadResearchQualificationOutput
}): GrowthLeadResearchExecutionPlan {
  const workflowType = mapKindToWorkflowType(input.nextBestAction.kind)
  const estimatedSteps = buildStepsForWorkflow(workflowType)
  const requiredWorkOrders = requiredWorkOrdersForWorkflow(workflowType)
  const prerequisites = prerequisitesForWorkflow(workflowType, input.qualification)
  const requiredEvidence = [
    ...input.evidenceSummary.verifiedEvidence.slice(0, 4),
    ...input.qualification.missingEvidence.map((item) => `Resolve: ${item}`),
  ].slice(0, 6)
  const approvalRequired =
    workflowType === "outreach_generation" ||
    workflowType === "buying_committee" ||
    workflowType === "verify_email" ||
    workflowType === "meeting_preparation" ||
    workflowType === "approval"
  const missingPrerequisites = resolveMissingPrerequisites(
    prerequisites,
    input.evidenceSummary,
    input.qualification,
    workflowType,
  )
  const executionReadiness = resolveReadiness({
    workflowType,
    approvalRequired,
    missingPrerequisites,
  })

  const expectedOutcome =
    workflowType === "close"
      ? "Lead archived with documented abandon reason — no further autonomous steps."
      : workflowType === "monitoring"
        ? "Buying signals tracked; reassessment triggered when engagement changes."
        : `Successful ${workflowType.replaceAll("_", " ")} workflow completion with operator approval at each gate.`

  const successCriteria =
    workflowType === "close"
      ? ["Abandon rationale recorded", "No Work Orders queued"]
      : [
          "Required Work Orders completed or approved",
          "Success criteria met without outbound until operator approves",
          "Decision record captured for audit",
        ]

  const failureConditions = [
    ...input.evidenceSummary.potentialRisks,
    "Operator rejects plan or withdraws approval",
    "Provider or agent runtime unavailable",
  ]

  const rollbackStrategy =
    workflowType === "close"
      ? "No rollback — lead remains in CRM for future reconsideration."
      : "Pause proposed Work Orders, revert to assessed state, and route to human review."

  return {
    nextBestAction: input.nextBestAction.label,
    nextBestActionKind: input.nextBestAction.kind,
    workflowType,
    estimatedSteps,
    requiredWorkOrders,
    prerequisites,
    requiredEvidence,
    approvalRequired,
    estimatedDuration: resolveDuration(workflowType),
    estimatedCost: resolveCost(workflowType, input.opportunityAssessment),
    expectedOutcome,
    successCriteria,
    failureConditions,
    rollbackStrategy,
    executionReadiness,
    missingPrerequisites,
  }
}
