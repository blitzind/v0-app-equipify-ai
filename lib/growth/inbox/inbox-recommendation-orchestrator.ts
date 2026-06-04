/** Client-safe inbox recommendation orchestrator (Phase 3B). */

import { GROWTH_NEXT_BEST_ACTION_LABELS, type GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthBookingRecommendation } from "@/lib/growth/booking-intelligence/booking-types"
import type { GrowthOpportunityRecommendation } from "@/lib/growth/opportunity-intelligence/opportunity-types"
import type { GrowthReplyCopilotAssist } from "@/lib/growth/reply-intelligence/reply-intent-types"
import type { GrowthReplyWorkflowActionRecord } from "@/lib/growth/reply-intelligence/workflow-actions-types"
import {
  type GrowthRevenueCommandCenterLead,
  type GrowthRevenueForecastEvidence,
  type GrowthRevenuePlaybook,
  type GrowthSalesExecutionPlan,
} from "@/lib/growth/revenue-execution/revenue-execution-types"
import type { GrowthRevenueReadinessSnapshot } from "@/lib/growth/revenue-workflow/revenue-workflow-types"
import type { GrowthLead } from "@/lib/growth/types"
import { executionPlanProgress } from "@/lib/growth/inbox/inbox-revenue-context"

export type GrowthInboxRecommendedActionSource =
  | "workflow_action"
  | "revenue_execution"
  | "execution_plan"
  | "playbook"
  | "booking_recommendation"
  | "opportunity_recommendation"
  | "revenue_readiness"
  | "reply_copilot"
  | "next_best_action"

export type GrowthInboxOrchestratedRecommendation = {
  source: GrowthInboxRecommendedActionSource
  title: string
  recommendation: string
  confidence: string
  whyThisExists: string
  recommendedNextStep: string
  evidence: string[]
  sourceId?: string
  rankScore: number
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const CONFIDENCE_RANK: Record<string, number> = {
  verified: 4,
  high: 3,
  medium: 2,
  low: 1,
  uncertain: 0,
}

const READINESS_RANK: Record<string, number> = {
  revenue_ready: 5,
  sales_ready: 4,
  qualified: 3,
  warming: 2,
  cold: 1,
}

function confidenceLabel(score: number): string {
  if (score >= 4) return "Verified"
  if (score >= 3) return "High"
  if (score >= 2) return "Medium"
  return "Low"
}

function buildCandidates(input: {
  workflowActions: GrowthReplyWorkflowActionRecord[]
  opportunityRecommendations: GrowthOpportunityRecommendation[]
  bookingRecommendations: GrowthBookingRecommendation[]
  copilot: GrowthReplyCopilotAssist | null
  lead: GrowthLead | null
  revenueReadiness: GrowthRevenueReadinessSnapshot | null
  forecastEvidence: GrowthRevenueForecastEvidence | null
  executionPlan: GrowthSalesExecutionPlan | null
  playbook: GrowthRevenuePlaybook | null
  commandCenterLead: GrowthRevenueCommandCenterLead | null
}): GrowthInboxOrchestratedRecommendation[] {
  const candidates: GrowthInboxOrchestratedRecommendation[] = []

  for (const workflow of input.workflowActions) {
    const severityScore = SEVERITY_RANK[workflow.severity] ?? 2
    candidates.push({
      source: "workflow_action",
      sourceId: workflow.id,
      title: "Workflow action",
      recommendation: workflow.title,
      confidence: confidenceLabel(severityScore),
      whyThisExists: workflow.summary,
      recommendedNextStep: workflow.replyNextAction?.replace(/_/g, " ") ?? "Review and confirm workflow action.",
      evidence: [workflow.replyBodyPreview, workflow.replyIntent ? `Intent: ${workflow.replyIntent}` : ""].filter(
        Boolean,
      ) as string[],
      rankScore: 100 + severityScore * 10,
    })
  }

  if (input.commandCenterLead?.pendingRecommendationId) {
    candidates.push({
      source: "revenue_execution",
      sourceId: input.commandCenterLead.pendingRecommendationId,
      title: "Revenue execution",
      recommendation: input.commandCenterLead.primaryReason,
      confidence: confidenceLabel(
        input.commandCenterLead.opportunityConfidence != null
          ? Math.min(4, Math.ceil(input.commandCenterLead.opportunityConfidence / 25))
          : 3,
      ),
      whyThisExists: `Lead appears in ${input.commandCenterLead.view.replace(/_/g, " ")} queue with revenue readiness ${input.commandCenterLead.revenueReadinessScore}.`,
      recommendedNextStep: "Open revenue execution review and confirm next pipeline step.",
      evidence: [
        `Readiness: ${input.commandCenterLead.revenueReadinessScore} (${input.commandCenterLead.revenueReadinessTier})`,
        input.commandCenterLead.opportunityScore != null
          ? `Opportunity score: ${input.commandCenterLead.opportunityScore}`
          : "",
        input.commandCenterLead.nextBestAction ? `NBA: ${input.commandCenterLead.nextBestAction}` : "",
      ].filter(Boolean),
      rankScore: 98,
    })
  }

  const planProgress = executionPlanProgress(input.executionPlan)
  if (input.executionPlan && planProgress.nextStep) {
    candidates.push({
      source: "execution_plan",
      sourceId: input.executionPlan.leadId,
      title: "Execution plan",
      recommendation: planProgress.nextStep,
      confidence: "High",
      whyThisExists: input.executionPlan.summary,
      recommendedNextStep: planProgress.nextStep,
      evidence: [
        `${planProgress.completed}/${planProgress.total} steps completed`,
        ...input.executionPlan.steps
          .filter((step) => !step.completed)
          .slice(0, 2)
          .map((step) => step.description),
      ],
      rankScore: 92,
    })
  }

  if (input.playbook) {
    candidates.push({
      source: "playbook",
      sourceId: input.playbook.key,
      title: "Revenue playbook",
      recommendation: input.playbook.title,
      confidence: "High",
      whyThisExists: input.playbook.summary,
      recommendedNextStep: input.playbook.recommendedNextStep,
      evidence: input.playbook.recommendedMessaging.slice(0, 3),
      rankScore: 88,
    })
  }

  for (const booking of input.bookingRecommendations) {
    const score = Math.max(...(booking.evidence.map((entry) => CONFIDENCE_RANK[entry.confidence ?? "medium"] ?? 2)), 2)
    candidates.push({
      source: "booking_recommendation",
      sourceId: booking.id,
      title: "Booking recommendation",
      recommendation: booking.title,
      confidence: confidenceLabel(score),
      whyThisExists: booking.description,
      recommendedNextStep: "Review meeting routing and approve or dismiss manually.",
      evidence: booking.evidence.map((entry) => entry.snippet).slice(0, 3),
      rankScore: 82 + score,
    })
  }

  for (const opportunity of input.opportunityRecommendations) {
    const score = Math.max(
      ...(opportunity.evidence.map((entry) => CONFIDENCE_RANK[entry.confidence ?? "medium"] ?? 2)),
      2,
    )
    candidates.push({
      source: "opportunity_recommendation",
      sourceId: opportunity.id,
      title: "Opportunity recommendation",
      recommendation: opportunity.title,
      confidence: confidenceLabel(score),
      whyThisExists: opportunity.description,
      recommendedNextStep: "Accept or dismiss opportunity recommendation with human approval.",
      evidence: opportunity.evidence.map((entry) => entry.snippet).slice(0, 3),
      rankScore: 78 + score,
    })
  }

  if (input.revenueReadiness && (input.revenueReadiness.tier === "sales_ready" || input.revenueReadiness.tier === "revenue_ready")) {
    const readinessRank = READINESS_RANK[input.revenueReadiness.tier] ?? 2
    candidates.push({
      source: "revenue_readiness",
      title: "Revenue readiness",
      recommendation: `${input.revenueReadiness.score} · ${input.revenueReadiness.tier.replace(/_/g, " ")}`,
      confidence: confidenceLabel(readinessRank),
      whyThisExists: input.revenueReadiness.summary,
      recommendedNextStep: "Advance pipeline manually when operator confirms fit.",
      evidence: [
        ...input.revenueReadiness.topPositiveSignals.map((signal) => `${signal.label} (+${signal.points})`),
        ...input.revenueReadiness.topRisks.map((risk) => `Risk: ${risk.label}`),
      ].slice(0, 4),
      rankScore: 72 + readinessRank * 2,
    })
  }

  if (input.forecastEvidence?.summary && input.commandCenterLead) {
    candidates.push({
      source: "revenue_execution",
      title: "Revenue forecast evidence",
      recommendation: input.forecastEvidence.summary,
      confidence: confidenceLabel(
        input.forecastEvidence.opportunityConfidence != null
          ? Math.min(4, Math.ceil(input.forecastEvidence.opportunityConfidence / 25))
          : 2,
      ),
      whyThisExists: "Sprint 4–5 forecast evidence synthesized for this lead.",
      recommendedNextStep: "Use evidence to inform manual pipeline and outreach decisions.",
      evidence: [
        ...input.forecastEvidence.buyingSignals.slice(0, 2),
        ...input.forecastEvidence.objections.slice(0, 2),
      ],
      rankScore: 70,
    })
  }

  if (input.copilot?.suggestedNextStep?.trim()) {
    const score = CONFIDENCE_RANK[input.copilot.confidenceTier] ?? 2
    candidates.push({
      source: "reply_copilot",
      title: "Reply copilot",
      recommendation: input.copilot.suggestedNextStep,
      confidence: confidenceLabel(score),
      whyThisExists: input.copilot.summary,
      recommendedNextStep: input.copilot.suggestedNextStep,
      evidence: input.copilot.evidenceExcerpts.slice(0, 3),
      rankScore: 65 + score,
    })
  }

  const action = input.lead?.nextBestAction as GrowthNextBestAction | null | undefined
  if (action) {
    candidates.push({
      source: "next_best_action",
      title: "Next best action",
      recommendation: GROWTH_NEXT_BEST_ACTION_LABELS[action],
      confidence: "Medium",
      whyThisExists: input.lead?.nextBestActionReason ?? "Based on current lead workflow signals.",
      recommendedNextStep: GROWTH_NEXT_BEST_ACTION_LABELS[action],
      evidence: input.lead?.decisionMakerStatus
        ? [`Decision maker: ${input.lead.decisionMakerStatus.replace(/_/g, " ")}`]
        : [],
      rankScore: 60,
    })
  }

  return candidates.sort((a, b) => b.rankScore - a.rankScore)
}

export function orchestrateGrowthInboxRecommendations(
  input: Parameters<typeof buildCandidates>[0],
): {
  top: GrowthInboxOrchestratedRecommendation | null
  ranked: GrowthInboxOrchestratedRecommendation[]
} {
  const ranked = buildCandidates(input)
  return { top: ranked[0] ?? null, ranked }
}

/** @deprecated Use orchestrateGrowthInboxRecommendations — kept for Phase 2 tests. */
export function resolveGrowthInboxRecommendedAction(
  input: Parameters<typeof buildCandidates>[0],
): GrowthInboxOrchestratedRecommendation | null {
  return orchestrateGrowthInboxRecommendations(input).top
}
