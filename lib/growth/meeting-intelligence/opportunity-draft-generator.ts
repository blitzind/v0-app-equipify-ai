/** Opportunity Draft generator (M1-D). Client-safe. */

import type { GrowthOpportunityStageKey } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import type {
  OpportunityDraftGeneratedArtifacts,
  OpportunityDraftGeneratorInput,
  OpportunityDraftStakeholder,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { OPPORTUNITY_DRAFT_ENGINE_QA_MARKER } from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { computeOpportunityDraftReadinessScore } from "@/lib/growth/meeting-intelligence/opportunity-draft-readiness-scoring"

function stableHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

export function buildOpportunityDraftInputHash(input: OpportunityDraftGeneratorInput): string {
  return stableHash(
    JSON.stringify({
      qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
      meeting_id: input.meeting.id,
      meeting_status: input.meeting.status,
      outcome: input.meeting.outcome,
      outcome_score: input.meeting_outcome_intelligence?.meetingOutcomeScore ?? null,
      readiness: input.meeting_readiness?.score ?? null,
    }),
  )
}

function extractStakeholders(input: OpportunityDraftGeneratorInput): OpportunityDraftStakeholder[] {
  const stakeholders: OpportunityDraftStakeholder[] = []

  for (const focus of input.account_playbook_context?.stakeholderFocus ?? []) {
    for (const member of focus.members) {
      stakeholders.push({
        name: member.fullName,
        title: member.title,
        role_category: focus.roleCategory,
        influence: "committee",
      })
    }
  }

  for (const dm of input.decision_makers ?? []) {
    stakeholders.push({
      name: dm.name,
      title: dm.title,
      role_category: null,
      influence: dm.isPrimary ? "primary" : "unknown",
    })
  }

  const unique = new Map<string, OpportunityDraftStakeholder>()
  for (const stakeholder of stakeholders) {
    unique.set(`${stakeholder.name}:${stakeholder.title ?? ""}`, stakeholder)
  }
  return [...unique.values()].slice(0, 8)
}

function recommendStage(input: OpportunityDraftGeneratorInput): GrowthOpportunityStageKey {
  const outcome = input.meeting_outcome_intelligence
  if (outcome?.followUpRecommendation === "send_proposal_recommendation") return "proposal"
  if (outcome?.followUpRecommendation === "strong_opportunity") return "qualified"
  if (outcome?.budgetSignal && outcome.timelineDetected) return "qualified"
  if (outcome?.buyingSignalCount >= 2) return "discovery"
  if (input.reply_intelligence?.intent === "pricing_question") return "qualified"
  if (input.opportunity_readiness?.readiness_status === "Opportunity Ready") return "qualified"
  return "discovery"
}

function estimateValue(input: OpportunityDraftGeneratorInput): number {
  const base = input.qualification?.score ?? input.meeting_readiness?.score ?? 40
  const outcomeBoost = (input.meeting_outcome_intelligence?.meetingOutcomeScore ?? 0) * 100
  const committeeBoost = (input.account_playbook_context?.committeeCoverageScore ?? 0) * 50
  return Math.round(Math.max(0, base * 250 + outcomeBoost + committeeBoost))
}

export function generateOpportunityDraftFromMeeting(
  input: OpportunityDraftGeneratorInput,
): OpportunityDraftGeneratedArtifacts {
  const readiness = computeOpportunityDraftReadinessScore(input)
  const outcome = input.meeting_outcome_intelligence
  const companyName =
    input.meeting.title.replace(/^Meeting with /i, "").trim() || "Account"

  const buyingSignals: string[] = []
  if (outcome?.buyingSignalCount) {
    buyingSignals.push(`${outcome.buyingSignalCount} buying signal(s) detected in meeting outcome intelligence.`)
  }
  if (outcome?.timelineDetected) buyingSignals.push("Timeline language detected.")
  if (outcome?.budgetSignal) buyingSignals.push("Budget discussion detected.")
  if (outcome?.championDetected) buyingSignals.push("Champion behavior detected.")
  if (input.reply_intelligence?.intent === "positive_interest") {
    buyingSignals.push("Positive reply interest prior to meeting.")
  }
  if (input.conversation_intelligence?.momentum_summary) {
    buyingSignals.push(input.conversation_intelligence.momentum_summary)
  }

  const risks: string[] = []
  if (outcome?.noShowRiskPattern) risks.push("No-show risk pattern on account history.")
  if (outcome?.momentumTrend === "slipping" || outcome?.momentumTrend === "at_risk") {
    risks.push(`Momentum trend: ${outcome.momentumTrend}.`)
  }
  if (input.account_playbook_context?.coverageStatus === "Weak") {
    risks.push("Committee coverage is weak — single-thread risk.")
  }
  for (const mention of input.conversation_intelligence?.competitor_mentions ?? []) {
    risks.push(`Competitive mention: ${mention}.`)
  }
  if (outcome?.objectionCount) {
    risks.push(`${outcome.objectionCount} objection(s) surfaced in meeting intelligence.`)
  }

  const nextSteps: string[] = []
  if (outcome?.recommendedNextStep) nextSteps.push(outcome.recommendedNextStep)
  if (outcome?.followUpRecommendation === "book_next_meeting_recommendation") {
    nextSteps.push("Book follow-up meeting with expanded stakeholder group.")
  }
  if (outcome?.followUpRecommendation === "send_proposal_recommendation") {
    nextSteps.push("Prepare proposal draft for operator review.")
  }
  if (readiness.readiness_status === "Weak") {
    nextSteps.push("Validate qualification and identify economic buyer before advancing stage.")
  }
  if (nextSteps.length === 0) {
    nextSteps.push("Review draft with sales operator — human approval required before creating opportunity.")
  }

  const recommendedStage = recommendStage({ ...input, opportunity_readiness: readiness })
  const keyStakeholders = extractStakeholders(input)
  const estimatedValue = estimateValue(input)
  const confidenceBase = readiness.opportunity_readiness_score / 100
  const outcomeBoost = (outcome?.nextStepConfidence ?? 0) / 100
  const confidenceScore = Math.min(1, Math.round((confidenceBase * 0.65 + outcomeBoost * 0.35) * 100) / 100)

  const opportunityType =
    input.reply_intelligence?.intent === "demo_request"
      ? "demo_follow_up"
      : outcome?.followUpRecommendation === "strong_opportunity"
        ? "qualified_new_business"
        : recommendedStage === "proposal"
          ? "proposal_track"
          : "post_meeting_qualification"

  const opportunitySummary = [
    `${companyName}: post-meeting opportunity draft from completed meeting.`,
    input.meeting.outcome ? `Outcome: ${input.meeting.outcome}.` : null,
    input.meeting.notes ? `Notes: ${input.meeting.notes.slice(0, 240)}.` : null,
    outcome?.safeSummary ? outcome.safeSummary : null,
    `Readiness ${readiness.readiness_status} (${readiness.opportunity_readiness_score}/100).`,
  ]
    .filter(Boolean)
    .join(" ")

  return {
    opportunity_summary: opportunitySummary,
    opportunity_type: opportunityType,
    estimated_value: estimatedValue,
    confidence_score: confidenceScore,
    recommended_stage: recommendedStage,
    key_stakeholders: keyStakeholders,
    buying_signals: buyingSignals.slice(0, 6),
    risks: risks.slice(0, 6),
    next_steps: [...new Set(nextSteps)].slice(0, 5),
    reasoning: [
      `Generated from completed meeting via ${OPPORTUNITY_DRAFT_ENGINE_QA_MARKER}.`,
      `Readiness ${readiness.readiness_status} (${readiness.opportunity_readiness_score}/100).`,
      outcome
        ? `Meeting outcome score ${outcome.meetingOutcomeScore}; recommendation ${outcome.followUpRecommendation}.`
        : "Meeting outcome intelligence pending or unavailable.",
      "Recommendation-only — operator must approve draft before creating an opportunity.",
    ].join(" "),
    opportunity_readiness: readiness,
  }
}
