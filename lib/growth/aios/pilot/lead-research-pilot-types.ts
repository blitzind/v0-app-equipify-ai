/** GE-AIOS-4A — Lead Research Pilot types (client-safe). */

import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import type {
  GrowthLeadResearchQualificationOutput,
  GrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type {
  GrowthLeadResearchEvidenceSummary,
  GrowthLeadResearchNextBestAction,
  GrowthLeadResearchOpportunityAssessment,
} from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
  type GrowthLeadResearchQualificationOutput,
  type GrowthLeadResearchWorkflowStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"

export const GROWTH_AIOS_4A_PHASE = "GE-AIOS-4A" as const

export const GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER =
  "growth-aios-4a-lead-research-pilot-v1" as const

export const LEAD_RESEARCH_PILOT_MISSION_TITLE =
  "AI OS Lead Research Pilot (GE-AIOS-4A)" as const

export const LEAD_RESEARCH_PILOT_EXECUTIVE_INSTANCE_ID =
  "ge-aios-4a-lead-research-pilot" as const

export const LEAD_RESEARCH_PILOT_RESEARCH_AGENT_INSTANCE_ID =
  "ge-aios-4a-research-agent" as const

export const LEAD_RESEARCH_PILOT_PROVIDER_PURPOSE = "research_company" as const

export const LEAD_RESEARCH_PILOT_STEPS = [
  "prospect_created",
  "executive_planning_tick",
  "work_order_created",
  "decision_preparation",
  "agent_claim",
  "context_assembly",
  "ai_provider",
  "company_research",
  "save_research",
  "work_order_complete",
] as const

export type LeadResearchPilotStepId = (typeof LEAD_RESEARCH_PILOT_STEPS)[number]

export type LeadResearchPilotStepStatus = "pending" | "running" | "completed" | "failed" | "skipped"

export type LeadResearchPilotStepRecord = {
  stepId: LeadResearchPilotStepId
  label: string
  status: LeadResearchPilotStepStatus
  occurredAt: string | null
  detail: string | null
  metadata: Record<string, unknown>
}

export type LeadResearchPilotObservation = {
  leadId: string
  companyName: string | null
  missionId: string | null
  workOrderId: string | null
  researchRunId: string | null
  pilotEnabled: boolean
  enableAiEvidence: boolean
  correlationId: string
  steps: LeadResearchPilotStepRecord[]
  lastError: string | null
  updatedAt: string | null
  /** GE-AIOS-GROWTH-1A — normalized Growth workflow snapshot fields. */
  workflowKey: typeof GROWTH_LEAD_RESEARCH_WORKFLOW_KEY
  workflowStatus: GrowthLeadResearchWorkflowStatus
  qualification: GrowthLeadResearchQualificationOutput | null
  recommendedWorkOrderType: AiWorkOrderType | null
  opportunityAssessment: GrowthLeadResearchOpportunityAssessment | null
  nextBestAction: GrowthLeadResearchNextBestAction | null
  evidenceSummary: GrowthLeadResearchEvidenceSummary | null
  executionPlan: GrowthLeadResearchExecutionPlan | null
}

export const LEAD_RESEARCH_PILOT_STEP_LABELS: Record<LeadResearchPilotStepId, string> = {
  prospect_created: "Prospect created",
  executive_planning_tick: "Executive planning tick",
  work_order_created: "Research company Work Order created",
  decision_preparation: "Decision preparation",
  agent_claim: "Research agent claim",
  context_assembly: "AI context assembly",
  ai_provider: "AI provider invocation",
  company_research: "Company research",
  save_research: "Save research",
  work_order_complete: "Work Order complete",
}

/** Lead Research Pilot wires the full AI OS stack — no outbound, enroll, or Core execution. */
export const LEAD_RESEARCH_PILOT_RUNTIME_RULE =
  "Lead Research Pilot orchestrates Executive Planning, Work Orders, Decision Preparation, Context Assembly, and Provider Gateway for research_company only — gated by feature flag with operator-visible steps." as const
