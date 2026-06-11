/** Opportunity Draft readiness scoring (M1-D). Client-safe. */

import type {
  OpportunityDraftGeneratorInput,
  OpportunityDraftReadinessResult,
  OpportunityDraftReadinessStatus,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function resolveReadinessStatus(score: number): OpportunityDraftReadinessStatus {
  if (score >= 75) return "Opportunity Ready"
  if (score >= 55) return "Qualified"
  if (score >= 35) return "Developing"
  return "Weak"
}

export function computeOpportunityDraftReadinessScore(
  input: OpportunityDraftGeneratorInput,
): OpportunityDraftReadinessResult {
  let score = 0
  const factors: string[] = []

  const qualificationScore = input.qualification?.score ?? 0
  if (qualificationScore >= 60) {
    score += 20
    factors.push("qualification_ready")
  } else if (qualificationScore >= 40) {
    score += 10
  }

  const meetingReadiness = input.meeting_readiness?.score ?? 0
  if (meetingReadiness >= 70) {
    score += 20
    factors.push("meeting_readiness_strong")
  } else if (meetingReadiness >= 50) {
    score += 12
  }

  const committeeCoverage = input.account_playbook_context?.committeeCoverageScore ?? 0
  if (committeeCoverage >= 60) {
    score += 15
    factors.push("committee_coverage_sufficient")
  } else if (committeeCoverage >= 40) {
    score += 8
  }

  const outcome = input.meeting_outcome_intelligence
  if (outcome) {
    score += Math.min(20, Math.round(outcome.meetingOutcomeScore * 0.2))
    if (outcome.buyingSignalCount > 0) {
      score += Math.min(10, outcome.buyingSignalCount * 3)
      factors.push("buying_signals_detected")
    }
    if (outcome.decisionMakerPresent) {
      score += 8
      factors.push("decision_maker_present")
    }
    if (outcome.timelineDetected) {
      score += 6
      factors.push("timeline_detected")
    }
    if (outcome.budgetSignal) {
      score += 6
      factors.push("budget_signal")
    }
  }

  const engagementBoost =
    input.conversation_intelligence?.momentum_summary ||
    input.reply_intelligence?.intent === "positive_interest" ||
    input.reply_intelligence?.intent === "meeting_request" ||
    input.reply_intelligence?.intent === "demo_request"
      ? 8
      : 0
  if (engagementBoost > 0) factors.push("engagement_signal")

  score += engagementBoost

  if ((input.decision_makers?.length ?? 0) >= 2) {
    score += 5
    factors.push("multi_stakeholder")
  }

  const opportunityReadinessScore = clampScore(score)
  return {
    opportunity_readiness_score: opportunityReadinessScore,
    readiness_status: resolveReadinessStatus(opportunityReadinessScore),
    factors,
  }
}
