/** GE-AIOS-GROWTH-1A — Growth Lead Research workflow types (client-safe). */

import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import type { GrowthLeadResearchResult, GrowthLeadResearchRunStatus } from "@/lib/growth/research-types"
import type {
  LeadResearchPilotStepId,
  LeadResearchPilotStepRecord,
} from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"

export const GROWTH_AIOS_GROWTH_1A_PHASE = "GE-AIOS-GROWTH-1A" as const

export const GROWTH_LEAD_RESEARCH_WORKFLOW_QA_MARKER =
  "growth-aios-growth-1a-lead-research-workflow-v1" as const

/** Canonical AI OS Growth workflow key — Lead Research Pilot is an alias implementation. */
export const GROWTH_LEAD_RESEARCH_WORKFLOW_KEY = "growth_lead_research" as const

export const GROWTH_LEAD_RESEARCH_WORKFLOW_STATUSES = [
  "not_started",
  "scheduled",
  "researching",
  "research_complete",
  "qualified",
  "assessed",
  "blocked",
  "failed",
] as const

export type GrowthLeadResearchWorkflowStatus = (typeof GROWTH_LEAD_RESEARCH_WORKFLOW_STATUSES)[number]

export type GrowthLeadResearchQualificationOutput = {
  fitScore: number
  recommendedNextAction: string
  recommendedWorkOrderType: AiWorkOrderType | null
  confidence: number
  reason: string
  missingEvidence: string[]
}

export type GrowthLeadResearchWorkflowSnapshot = {
  workflowKey: typeof GROWTH_LEAD_RESEARCH_WORKFLOW_KEY
  workflowStatus: GrowthLeadResearchWorkflowStatus
  leadId: string
  missionId: string | null
  workOrderId: string | null
  researchRunId: string | null
  qualification: GrowthLeadResearchQualificationOutput | null
  opportunityAssessment: GrowthLeadResearchOpportunityAssessment | null
  nextBestAction: GrowthLeadResearchNextBestAction | null
  evidenceSummary: GrowthLeadResearchEvidenceSummary | null
  executionPlan: GrowthLeadResearchExecutionPlan | null
  updatedAt: string | null
}

export type {
  GrowthLeadResearchEvidenceSummary,
  GrowthLeadResearchIntelligenceOutput,
  GrowthLeadResearchNextBestAction,
  GrowthLeadResearchOpportunityAssessment,
} from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"

export type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"

export const GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT =
  "growth.workflow.status_changed" as const

export const GROWTH_LEAD_RESEARCH_WORKFLOW_RUNTIME_RULE =
  "Growth Lead Research workflow is human-supervised — it researches and qualifies leads via AI OS Work Orders without outbound, enrollment, or Core execution." as const

const RESEARCHING_STEPS: LeadResearchPilotStepId[] = [
  "executive_planning_tick",
  "work_order_created",
  "decision_preparation",
  "agent_claim",
  "context_assembly",
  "ai_provider",
  "company_research",
  "save_research",
]

function stepIsDone(step: LeadResearchPilotStepRecord): boolean {
  return step.status === "completed" || step.status === "skipped"
}

function stepFailed(step: LeadResearchPilotStepRecord): boolean {
  return step.status === "failed"
}

function findStep(steps: LeadResearchPilotStepRecord[], stepId: LeadResearchPilotStepId) {
  return steps.find((step) => step.stepId === stepId)
}

/** Derive workflow status from pilot step progress when no explicit workflow event exists. */
export function deriveGrowthLeadResearchWorkflowStatus(input: {
  steps: LeadResearchPilotStepRecord[]
  explicitStatus?: GrowthLeadResearchWorkflowStatus | null
  qualification?: GrowthLeadResearchQualificationOutput | null
  hasOpportunityAssessment?: boolean
}): GrowthLeadResearchWorkflowStatus {
  if (input.explicitStatus === "assessed" || (input.hasOpportunityAssessment && input.explicitStatus === "qualified")) {
    return "assessed"
  }
  if (input.explicitStatus) return input.explicitStatus

  const steps = input.steps
  if (steps.some(stepFailed)) return "failed"

  const prospect = findStep(steps, "prospect_created")
  if (!prospect || prospect.status === "pending") return "not_started"
  if (prospect.status === "running") return "scheduled"

  if (input.hasOpportunityAssessment) return "assessed"

  const complete = findStep(steps, "work_order_complete")
  if (complete && stepIsDone(complete)) {
    if (input.qualification) {
      return input.qualification.fitScore >= 55 && input.qualification.confidence >= 0.45
        ? "qualified"
        : "blocked"
    }
    return "research_complete"
  }

  const saveResearch = findStep(steps, "save_research")
  if (saveResearch && stepIsDone(saveResearch)) {
    if (input.qualification) {
      return input.qualification.fitScore >= 55 && input.qualification.confidence >= 0.45
        ? "qualified"
        : "blocked"
    }
    return "research_complete"
  }

  if (RESEARCHING_STEPS.some((stepId) => {
    const step = findStep(steps, stepId)
    return step && (step.status === "running" || stepIsDone(step))
  })) {
    return "researching"
  }

  if (prospect && stepIsDone(prospect)) return "researching"

  return "not_started"
}

export function mapRecommendedNextWorkOrderType(recommendedNextAction: string): AiWorkOrderType | null {
  const normalized = recommendedNextAction.toLowerCase()
  if (normalized.includes("research") || normalized.includes("enrich")) return "research_company"
  if (normalized.includes("verify") && normalized.includes("email")) return "verify_email"
  if (normalized.includes("committee") || normalized.includes("decision maker")) {
    return "generate_buying_committee"
  }
  if (normalized.includes("video")) return "generate_video"
  if (normalized.includes("outreach") || normalized.includes("email")) return "generate_email"
  if (normalized.includes("sequence") || normalized.includes("enroll")) return "enroll_sequence"
  if (normalized.includes("meeting") || normalized.includes("call")) return "prepare_meeting"
  return "custom"
}

export function qualifyGrowthLeadResearch(input: {
  result: GrowthLeadResearchResult
  researchRunStatus: GrowthLeadResearchRunStatus
}): {
  qualification: GrowthLeadResearchQualificationOutput
  terminalStatus: "qualified" | "blocked" | "failed"
} {
  const missingEvidence: string[] = []

  if (!input.result.companySummary.trim()) {
    missingEvidence.push("Company summary missing")
  }
  if (input.result.sourceUrls.length === 0) {
    missingEvidence.push("No source URLs captured")
  }
  if (!input.result.websiteSummary?.trim()) {
    missingEvidence.push("Website summary unavailable")
  }
  for (const caveat of input.result.caveats) {
    if (caveat.trim()) missingEvidence.push(caveat.trim())
  }

  const fitScore = input.result.equipifyFitScore
  const confidence = input.result.researchConfidence
  const recommendedNextAction = input.result.recommendedNextAction
  const recommendedWorkOrderType = mapRecommendedNextWorkOrderType(recommendedNextAction)

  if (input.researchRunStatus === "failed") {
    return {
      qualification: {
        fitScore,
        recommendedNextAction,
        recommendedWorkOrderType,
        confidence,
        reason: "Research run failed before qualification could complete.",
        missingEvidence,
      },
      terminalStatus: "failed",
    }
  }

  const reason =
    fitScore >= 55
      ? `Fit score ${fitScore} with ${Math.round(confidence * 100)}% confidence — ${input.result.companySummary.slice(0, 160)}`
      : `Fit score ${fitScore} below qualification threshold — review before advancing.`

  const qualification: GrowthLeadResearchQualificationOutput = {
    fitScore,
    recommendedNextAction,
    recommendedWorkOrderType,
    confidence,
    reason,
    missingEvidence,
  }

  if (input.researchRunStatus === "partial" && confidence < 0.45) {
    return { qualification, terminalStatus: "blocked" }
  }

  if (missingEvidence.length >= 4 || fitScore < 40) {
    return { qualification, terminalStatus: "blocked" }
  }

  if (fitScore >= 55 && confidence >= 0.45) {
    return { qualification, terminalStatus: "qualified" }
  }

  return { qualification, terminalStatus: "blocked" }
}
