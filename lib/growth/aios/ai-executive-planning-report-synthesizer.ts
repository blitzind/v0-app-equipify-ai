/** GE-AIOS-5A — Deterministic Executive Planning Report synthesis (client-safe). */

import {
  EXECUTIVE_MISSION_STAGE_WORK_ORDER_BINDINGS,
  type AiExecutiveWorkOrderProposal,
} from "@/lib/growth/aios/ai-executive-mission-planning-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import { buildGrowthObjectiveForecast } from "@/lib/growth/objectives/growth-objective-forecast"
import { planGrowthObjective } from "@/lib/growth/objectives/growth-objective-planner"
import {
  GROWTH_OBJECTIVE_STAGE_IDS,
  type GrowthObjective,
  type GrowthObjectiveStageId,
} from "@/lib/growth/objectives/growth-objective-types"
import type {
  AiExecutivePlanningReport,
  AiExecutivePlanningReportCostLevel,
  AiExecutivePlanningReportOpportunityLevel,
  AiExecutivePlanningReportRisk,
  AiExecutivePlanningReportRoiLevel,
  AiExecutivePlanningReportStepStatus,
  AiExecutivePlanningReportStrategyStep,
  AiExecutivePlanningReportWorkOrderPlanStep,
} from "@/lib/growth/aios/ai-executive-planning-report-types"
import { GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER } from "@/lib/growth/aios/ai-executive-planning-report-types"

const STAGE_LABELS: Record<GrowthObjectiveStageId, string> = {
  discover: "Discover",
  research: "Research",
  enrich: "Enrich",
  buying_committee: "Buying Committee",
  generate_assets: "Generate Assets",
  launch: "Launch",
  monitor: "Monitor",
  adapt: "Adapt",
  book: "Book",
  complete: "Complete",
}

const WORK_ORDER_TYPE_LABELS: Record<AiWorkOrderType, string> = {
  research_company: "Research company",
  generate_buying_committee: "Verify decision makers",
  verify_email: "Verify emails",
  generate_email: "Generate personalized outreach",
  generate_video: "Send personalized video",
  enroll_sequence: "Send email / enroll sequence",
  pause_sequence: "Pause or adapt sequence",
  analyze_reply: "Monitor engagement",
  prepare_meeting: "Phone call / prepare meeting",
  create_opportunity: "Create opportunity",
  update_memory: "Update mission memory",
  run_learning_cycle: "Run learning cycle",
  custom: "Custom Work Order",
}

const NARRATIVE_STEPS: Partial<Record<GrowthObjectiveStageId, string[]>> = {
  launch: ["Wait for engagement window"],
  monitor: ["Monitor engagement", "Escalate if buying signal detected"],
}

const REVENUE_PER_OUTCOME_USD: Record<GrowthObjective["objectiveType"], number> = {
  demos_booked: 180_000,
  meetings_booked: 120_000,
  opportunities_created: 95_000,
  pipeline_value: 75_000,
  customers_acquired: 240_000,
  custom: 60_000,
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function resolveStageStatus(
  stageId: GrowthObjectiveStageId,
  currentStageId: GrowthObjectiveStageId,
): AiExecutivePlanningReportStepStatus {
  const currentIndex = GROWTH_OBJECTIVE_STAGE_IDS.indexOf(currentStageId)
  const stageIndex = GROWTH_OBJECTIVE_STAGE_IDS.indexOf(stageId)
  if (stageIndex < currentIndex) return "completed"
  if (stageIndex === currentIndex) return "current"
  return "upcoming"
}

function resolveOpportunityLevel(score: number): AiExecutivePlanningReportOpportunityLevel {
  if (score >= 75) return "High"
  if (score >= 45) return "Medium"
  return "Low"
}

function resolveCostLevel(estimatedSends: number): AiExecutivePlanningReportCostLevel {
  if (estimatedSends <= 120) return "Low"
  if (estimatedSends <= 400) return "Medium"
  return "High"
}

function resolveRoiLevel(
  meetingProbability: number,
  costLevel: AiExecutivePlanningReportCostLevel,
): AiExecutivePlanningReportRoiLevel {
  const costPenalty = costLevel === "High" ? 15 : costLevel === "Medium" ? 5 : 0
  const roiScore = meetingProbability - costPenalty
  if (roiScore >= 35) return "High"
  if (roiScore >= 18) return "Medium"
  return "Low"
}

function buildEntitySignals(entityProjection: Record<string, unknown> | undefined): string[] {
  if (!entityProjection) return []
  const signals: string[] = []
  if (typeof entityProjection.relationshipStage === "string") {
    signals.push(`Relationship stage: ${entityProjection.relationshipStage}`)
  }
  if (typeof entityProjection.engagementTrend === "string") {
    signals.push(`Engagement trend: ${entityProjection.engagementTrend}`)
  }
  if (Array.isArray(entityProjection.riskFlags) && entityProjection.riskFlags.length > 0) {
    for (const flag of entityProjection.riskFlags.slice(0, 3)) {
      signals.push(`Risk flag: ${String(flag)}`)
    }
  }
  if (typeof entityProjection.snapshotCount === "number" && entityProjection.snapshotCount > 0) {
    signals.push(`Company intelligence snapshots: ${entityProjection.snapshotCount}`)
  }
  return signals
}

function buildStrategySteps(input: {
  objective: GrowthObjective
  currentStageId: GrowthObjectiveStageId
}): AiExecutivePlanningReportStrategyStep[] {
  const steps: AiExecutivePlanningReportStrategyStep[] = []
  let stepNumber = 1

  for (const stageId of GROWTH_OBJECTIVE_STAGE_IDS) {
    if (stageId === "complete") continue
    const status = resolveStageStatus(stageId, input.currentStageId)
    const bindings = EXECUTIVE_MISSION_STAGE_WORK_ORDER_BINDINGS[stageId] ?? []

    for (const workOrderType of bindings) {
      steps.push({
        stepNumber: stepNumber++,
        label: WORK_ORDER_TYPE_LABELS[workOrderType],
        stageId,
        workOrderType,
        status,
        rationale: `Constitutional binding for ${STAGE_LABELS[stageId]} stage.`,
      })
    }

    for (const narrative of NARRATIVE_STEPS[stageId] ?? []) {
      steps.push({
        stepNumber: stepNumber++,
        label: narrative,
        stageId,
        workOrderType: null,
        status,
        rationale: "Operator-visible pacing between constitutional Work Orders.",
      })
    }
  }

  return steps
}

function buildWorkOrderPlan(proposals: AiExecutiveWorkOrderProposal[]): AiExecutivePlanningReportWorkOrderPlanStep[] {
  return proposals.map((proposal, index) => ({
    sequence: index + 1,
    workOrderType: proposal.workOrderType,
    assignedAgent: proposal.assignedAgent,
    label: WORK_ORDER_TYPE_LABELS[proposal.workOrderType],
    priority: proposal.priority,
    rationale: proposal.rationale,
    duplicateSkipped: proposal.duplicate,
  }))
}

function buildRisks(input: {
  objective: GrowthObjective
  entitySignals: string[]
  executionPlanStages: ReturnType<typeof planGrowthObjective>["stages"]
}): AiExecutivePlanningReportRisk[] {
  const risks: AiExecutivePlanningReportRisk[] = []

  if (input.executionPlanStages.some((stage) => stage.id === "enrich" && stage.status === "in_progress")) {
    risks.push({
      label: "Email unavailable or unverified",
      severity: "Medium",
      mitigation: "Verify email Work Order before outreach generation.",
    })
  }

  if (input.objective.objectiveType === "demos_booked" || input.objective.objectiveType === "meetings_booked") {
    risks.push({
      label: "Small buying committee",
      severity: "Medium",
      mitigation: "Generate buying committee map and multi-thread assets before launch.",
    })
  }

  if (input.entitySignals.some((signal) => /low|declin|cold/i.test(signal))) {
    risks.push({
      label: "Low engagement",
      severity: "High",
      mitigation: "Monitor stage with analyze_reply and adapt channel mix.",
    })
  } else {
    risks.push({
      label: "Low engagement",
      severity: "Medium",
      mitigation: "Use monitor/adapt stages before escalating to voice.",
    })
  }

  if (input.objective.safetyMode === "strict") {
    risks.push({
      label: "Human approval required for outbound",
      severity: "Low",
      mitigation: "Work Orders stop at issued/awaiting_approval — no autonomous send.",
    })
  }

  return risks
}

function buildAlternativeStrategies(objective: GrowthObjective): AiExecutivePlanningReport["alternativeStrategies"] {
  const alternatives: AiExecutivePlanningReport["alternativeStrategies"] = [
    {
      name: "Single-touch email only",
      summary: "Skip research depth and launch one generic email.",
      whyRejected: "Insufficient for demo/meeting objectives — violates constitutional stage bindings.",
    },
    {
      name: "Aggressive multi-channel blitz",
      summary: "Launch voice and SMS before email verification completes.",
      whyRejected:
        objective.safetyMode === "strict"
          ? "Strict safety mode requires verified contacts and operator approval."
          : "Elevated compliance and deliverability risk without enrich stage completion.",
    },
  ]

  if (objective.autonomyLevel === "manual" || objective.autonomyLevel === "assisted") {
    alternatives.push({
      name: "Fully autonomous launch",
      summary: "Auto-enroll sequence without operator review.",
      whyRejected: `Autonomy level ${objective.autonomyLevel} keeps human approval in loop.`,
    })
  }

  return alternatives
}

function buildHumanApprovalNotes(objective: GrowthObjective): string[] {
  const notes = [
    "Work Order creation on this page remains explicit operator approval — the report does not execute.",
  ]
  if (objective.safetyMode === "strict") {
    notes.push("Strict safety mode: outbound Work Orders require human approval before send.")
  }
  if (objective.autonomyLevel === "manual" || objective.autonomyLevel === "assisted") {
    notes.push(`Autonomy ${objective.autonomyLevel}: strategy recommendations only until operator approves.`)
  }
  if (objective.emergencyStopActive) {
    notes.push("Emergency stop is active — no autonomous progression until cleared.")
  }
  return notes
}

export function synthesizeAiExecutivePlanningReport(input: {
  reportId: string
  generatedAt: string
  objective: GrowthObjective
  currentStageId: GrowthObjectiveStageId
  proposedWorkOrders: AiExecutiveWorkOrderProposal[]
  activeWorkOrderCount: number
  decisionRecordCount: number
  memoryEntryCount: number
  entityProjection?: Record<string, unknown>
  sourcesUsed: string[]
}): AiExecutivePlanningReport {
  const executionPlan = planGrowthObjective(input.objective)
  const forecast = buildGrowthObjectiveForecast(input.objective, executionPlan.icpStrategy)
  const entitySignals = buildEntitySignals(input.entityProjection)
  const currentPlanStage =
    executionPlan.stages.find((stage) => stage.id === input.currentStageId) ??
    executionPlan.stages.find((stage) => stage.status === "in_progress") ??
    executionPlan.stages[0]

  const progressPercent =
    input.objective.targetValue > 0
      ? clampScore((input.objective.currentValue / input.objective.targetValue) * 100)
      : 0

  const industryScore =
    executionPlan.icpStrategy.industries.some((industry) => /healthcare|medical|biomed/i.test(industry)) &&
    /medical|health|biomed|clinical/i.test(input.objective.title)
      ? 93
      : executionPlan.icpStrategy.keywords.length >= 2
        ? 78
        : 65

  const entityBoost =
    entitySignals.some((signal) => /high|positive|warm/i.test(signal)) ? 8 : entitySignals.length > 0 ? 3 : 0
  const companyFitScore = clampScore(industryScore + entityBoost)
  const industryOpportunity = resolveOpportunityLevel(
    executionPlan.icpStrategy.industries.some((industry) => /healthcare|software|equipment/i.test(industry))
      ? 82
      : 58,
  )

  const perOutcome = REVENUE_PER_OUTCOME_USD[input.objective.objectiveType]
  const estimatedAnnualRevenueUsd =
    input.objective.targetValue > 0 ? Math.round(perOutcome * input.objective.targetValue) : null

  const confidenceScore = clampScore(
    (currentPlanStage?.confidence ?? 70) * 0.45 +
      companyFitScore * 0.35 +
      (100 - progressPercent) * 0.2,
  )

  const conversionRate =
    input.objective.objectiveType === "demos_booked"
      ? 0.08
      : input.objective.objectiveType === "meetings_booked"
        ? 0.1
        : 0.06
  const meetingProbabilityPercent = clampScore(conversionRate * 100 * (companyFitScore / 100) * 1.15)
  const estimatedExecutionCost = resolveCostLevel(forecast.estimatedSends)
  const estimatedRoi = resolveRoiLevel(meetingProbabilityPercent, estimatedExecutionCost)

  const risks = buildRisks({
    objective: input.objective,
    entitySignals,
    executionPlanStages: executionPlan.stages,
  })
  const overallRisk = risks.some((risk) => risk.severity === "High")
    ? "High"
    : risks.some((risk) => risk.severity === "Medium")
      ? "Medium"
      : "Low"

  const strategySteps = buildStrategySteps({
    objective: input.objective,
    currentStageId: input.currentStageId,
  })

  const businessReasoning = [
    `${input.objective.title} targets ${input.objective.objectiveType.replace(/_/g, " ")} (${input.objective.currentValue}/${input.objective.targetValue}).`,
    executionPlan.icpStrategy.summary,
    `Current constitutional stage ${STAGE_LABELS[input.currentStageId]} drives Work Order proposals — not autonomous execution.`,
    forecast.assumptions[0] ?? "Forecast uses deterministic Growth objective heuristics.",
    entitySignals[0] ?? "Entity intelligence will refine confidence once lead/company context is linked.",
  ]

  return {
    reportId: input.reportId,
    missionId: input.objective.id,
    generatedAt: input.generatedAt,
    readOnly: true,
    qaMarker: GROWTH_AI_EXECUTIVE_PLANNING_REPORT_QA_MARKER,
    missionSummary: {
      missionId: input.objective.id,
      title: input.objective.title,
      description: input.objective.description,
      objectiveType: input.objective.objectiveType,
      status: input.objective.status,
      priority: input.objective.priority,
      progress: {
        current: input.objective.currentValue,
        target: input.objective.targetValue,
        percent: progressPercent,
      },
    },
    missionAnalysis: {
      companyFitScore,
      industryOpportunity,
      estimatedAnnualRevenueUsd,
      confidenceScore,
      icpSummary: executionPlan.icpStrategy.summary,
      entitySignals,
    },
    currentStage: {
      stageId: input.currentStageId,
      label: STAGE_LABELS[input.currentStageId],
      status: currentPlanStage?.status ?? "pending",
      progress: currentPlanStage?.progress ?? 0,
    },
    businessReasoning,
    recommendedStrategy: {
      summary: `Multi-stage constitutional execution from ${STAGE_LABELS[input.currentStageId]} through book — Work Orders issued only after operator approval.`,
      steps: strategySteps,
    },
    expectedOutcomes: {
      meetingProbabilityPercent,
      estimatedRoi,
      estimatedExecutionCost,
      expectedDurationDays: forecast.estimatedDays,
      summary: `Estimated ${forecast.estimatedOutcomes} outcomes over ~${forecast.estimatedDays} days with ${estimatedExecutionCost.toLowerCase()} execution cost.`,
    },
    riskAssessment: {
      overallRisk,
      risks,
    },
    confidence: confidenceScore,
    estimatedCost: estimatedExecutionCost,
    estimatedTimeline: {
      days: forecast.estimatedDays,
      summary: `${forecast.estimatedDays}-day horizon based on leads needed (${forecast.leadsNeeded}) and stage progression.`,
    },
    multiStepWorkOrderPlan: buildWorkOrderPlan(input.proposedWorkOrders),
    alternativeStrategies: buildAlternativeStrategies(input.objective),
    successCriteria: executionPlan.successMetrics,
    humanApprovalNotes: buildHumanApprovalNotes(input.objective),
    futureLearningPlaceholders: [
      "Post-execution outcomes will feed run_learning_cycle when GE-AI learning loop ships.",
      "Decision Record confidence calibration reserved for executive_reporting agent.",
      "Memory registry links will enrich future strategy revisions for this mission.",
    ],
    contextSnapshot: {
      decisionRecordCount: input.decisionRecordCount,
      memoryEntryCount: input.memoryEntryCount,
      activeWorkOrderCount: input.activeWorkOrderCount,
      sourcesUsed: input.sourcesUsed,
    },
  }
}
