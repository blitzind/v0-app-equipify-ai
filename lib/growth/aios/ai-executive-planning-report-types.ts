/** GE-AIOS-5A — Executive Planning Report types (client-safe). */

import type { GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_5A_PHASE = "GE-AIOS-5A" as const

export const GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER =
  "growth-aios-5a-executive-planning-report-v1" as const

export type AiExecutivePlanningReportOpportunityLevel = "High" | "Medium" | "Low"

export type AiExecutivePlanningReportCostLevel = "Low" | "Medium" | "High"

export type AiExecutivePlanningReportRoiLevel = "High" | "Medium" | "Low"

export type AiExecutivePlanningReportStepStatus = "completed" | "current" | "upcoming" | "skipped"

export type AiExecutivePlanningReportMissionSummary = {
  missionId: string
  title: string
  description: string | null
  objectiveType: string
  status: string
  priority: string
  progress: {
    current: number
    target: number
    percent: number
  }
}

export type AiExecutivePlanningReportMissionAnalysis = {
  companyFitScore: number
  industryOpportunity: AiExecutivePlanningReportOpportunityLevel
  estimatedAnnualRevenueUsd: number | null
  confidenceScore: number
  icpSummary: string
  entitySignals: string[]
}

export type AiExecutivePlanningReportCurrentStage = {
  stageId: GrowthObjectiveStageId
  label: string
  status: string
  progress: number
}

export type AiExecutivePlanningReportStrategyStep = {
  stepNumber: number
  label: string
  stageId: GrowthObjectiveStageId
  workOrderType: AiWorkOrderType | null
  status: AiExecutivePlanningReportStepStatus
  rationale: string
}

export type AiExecutivePlanningReportExpectedOutcomes = {
  meetingProbabilityPercent: number
  estimatedRoi: AiExecutivePlanningReportRoiLevel
  estimatedExecutionCost: AiExecutivePlanningReportCostLevel
  expectedDurationDays: number
  summary: string
}

export type AiExecutivePlanningReportRisk = {
  label: string
  severity: AiExecutivePlanningReportOpportunityLevel
  mitigation: string
}

export type AiExecutivePlanningReportWorkOrderPlanStep = {
  sequence: number
  workOrderType: AiWorkOrderType
  assignedAgent: string
  label: string
  priority: number
  rationale: string
  duplicateSkipped: boolean
}

export type AiExecutivePlanningReportAlternativeStrategy = {
  name: string
  summary: string
  whyRejected: string
}

export type AiExecutivePlanningReportContextSnapshot = {
  decisionRecordCount: number
  memoryEntryCount: number
  activeWorkOrderCount: number
  sourcesUsed: string[]
}

export type AiExecutivePlanningReport = {
  reportId: string
  missionId: string
  generatedAt: string
  readOnly: true
  qaMarker: typeof GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER
  missionSummary: AiExecutivePlanningReportMissionSummary
  missionAnalysis: AiExecutivePlanningReportMissionAnalysis
  currentStage: AiExecutivePlanningReportCurrentStage
  businessReasoning: string[]
  recommendedStrategy: {
    summary: string
    steps: AiExecutivePlanningReportStrategyStep[]
  }
  expectedOutcomes: AiExecutivePlanningReportExpectedOutcomes
  riskAssessment: {
    overallRisk: AiExecutivePlanningReportOpportunityLevel
    risks: AiExecutivePlanningReportRisk[]
  }
  confidence: number
  estimatedCost: AiExecutivePlanningReportCostLevel
  estimatedTimeline: {
    days: number
    summary: string
  }
  multiStepWorkOrderPlan: AiExecutivePlanningReportWorkOrderPlanStep[]
  alternativeStrategies: AiExecutivePlanningReportAlternativeStrategy[]
  successCriteria: string[]
  humanApprovalNotes: string[]
  futureLearningPlaceholders: string[]
  contextSnapshot: AiExecutivePlanningReportContextSnapshot
}

/** Executive Planning Report is read-only strategy intelligence — it never executes, sends outbound, or calls providers. */
export const AI_EXECUTIVE_PLANNING_REPORT_RUNTIME_RULE =
  "The Executive Planning Report synthesizes mission intelligence and constitutional Work Order strategy for operator review — it never executes Work Orders, sends outbound, enrolls sequences, claims agents, or invokes providers." as const
