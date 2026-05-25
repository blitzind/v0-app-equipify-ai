import type {
  DealIntelligenceCloseWindow,
  DealIntelligenceOperatorAction,
  DealIntelligenceRiskLevel,
  DealIntelligenceScoreInputs,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"
import { predictDealCloseWindow } from "@/lib/growth/deal-intelligence/deal-close-window"
import { buildDealIntelligenceExplanation } from "@/lib/growth/deal-intelligence/deal-intelligence-explanation"
import {
  computeDealEngagementScore,
  computeDealFollowupDisciplineScore,
  computeDealMeetingScore,
  computeDealMomentumScore,
  computeDealReplyScore,
  computeDealResearchFitScore,
  computeDealStageHealthScore,
} from "@/lib/growth/deal-intelligence/deal-momentum-score"
import { applyCallIntelligenceToDealScoreInputs } from "@/lib/growth/call-intelligence/call-intelligence-deal-adjustments"
import { applyMeetingOutcomeToDealScoreInputs } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-deal-adjustments"
import { recommendDealOperatorAction } from "@/lib/growth/deal-intelligence/deal-recommendation-engine"
import {
  computeDealRiskScore,
  detectDealPositiveSignals,
  detectDealRiskFactors,
  mapDealRiskLevel,
} from "@/lib/growth/deal-intelligence/deal-risk-detector"

export type ComputedDealIntelligenceScore = {
  closeProbability: number
  dealRiskScore: number
  forecastConfidence: number
  momentumScore: number
  engagementScore: number
  meetingScore: number
  replyScore: number
  researchFitScore: number
  followupDisciplineScore: number
  stageHealthScore: number
  riskLevel: DealIntelligenceRiskLevel
  predictedCloseWindow: DealIntelligenceCloseWindow
  recommendedOperatorAction: DealIntelligenceOperatorAction
  riskFactors: ReturnType<typeof detectDealRiskFactors>
  positiveSignals: ReturnType<typeof detectDealPositiveSignals>
  explanation: string
  scoreInputs: DealIntelligenceScoreInputs
}

export function computeDealIntelligenceScore(input: {
  companyName: string
  scoreInputs: DealIntelligenceScoreInputs
  expectedCloseDate?: string | null
}): ComputedDealIntelligenceScore {
  const momentumScoreBase = computeDealMomentumScore(input.scoreInputs)
  const engagementScore = computeDealEngagementScore(input.scoreInputs)
  const meetingScore = computeDealMeetingScore(input.scoreInputs)
  const replyScore = computeDealReplyScore(input.scoreInputs)
  const researchFitScore = computeDealResearchFitScore(input.scoreInputs)
  const followupDisciplineScore = computeDealFollowupDisciplineScore(input.scoreInputs)
  const stageHealthScore = computeDealStageHealthScore(input.scoreInputs)

  const riskFactors = detectDealRiskFactors(input.scoreInputs)
  const positiveSignals = detectDealPositiveSignals(input.scoreInputs)

  let dealRiskScore = computeDealRiskScore({
    scoreInputs: input.scoreInputs,
    riskFactors,
    stageHealthScore,
    followupDisciplineScore,
  })

  let closeProbability = Math.round(
    engagementScore * 0.15 +
      meetingScore * 0.2 +
      replyScore * 0.15 +
      researchFitScore * 0.1 +
      stageHealthScore * 0.2 +
      followupDisciplineScore * 0.1 +
      momentumScoreBase * 0.1,
  )

  if (input.scoreInputs.probability != null) {
    closeProbability = Math.round(closeProbability * 0.6 + input.scoreInputs.probability * 0.4)
  }

  if (
    (input.scoreInputs.meetingsCompleted ?? 0) > 0 &&
    (input.scoreInputs.repliesReceived ?? 0) > 0
  ) {
    closeProbability = Math.min(100, closeProbability + 8)
  }
  if (
    (input.scoreInputs.researchConfidence ?? 0) >= 60 &&
    (input.scoreInputs.engagementTier === "warm" || input.scoreInputs.engagementTier === "hot")
  ) {
    closeProbability = Math.min(100, closeProbability + 6)
  }
  if (input.scoreInputs.meetingNoShows && input.scoreInputs.meetingNoShows > 0) {
    closeProbability = Math.max(0, closeProbability - 10)
  }
  if (input.scoreInputs.closeDateOverdue) closeProbability = Math.max(0, closeProbability - 12)
  if (input.scoreInputs.isStale) closeProbability = Math.max(0, closeProbability - 8)

  const callAdjustments = applyCallIntelligenceToDealScoreInputs(input.scoreInputs)
  closeProbability = Math.max(
    0,
    Math.min(100, closeProbability + callAdjustments.closeProbabilityBoost),
  )
  let momentumScore = Math.max(0, Math.min(100, momentumScoreBase + callAdjustments.momentumBoost))

  closeProbability = Math.max(0, Math.min(100, closeProbability))

  dealRiskScore = Math.max(
    0,
    Math.min(100, dealRiskScore + callAdjustments.riskBoost),
  )

  const riskLevel = mapDealRiskLevel(dealRiskScore, riskFactors.length)

  const forecastConfidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        closeProbability * 0.45 +
          stageHealthScore * 0.25 +
          followupDisciplineScore * 0.2 +
          (input.scoreInputs.forecastCategory === "commit" ? 15 : input.scoreInputs.forecastCategory === "best_case" ? 8 : 0),
      ) -
        Math.round(dealRiskScore * 0.15) +
        callAdjustments.confidenceBoost,
    ),
  )

  const predictedCloseWindow = predictDealCloseWindow({
    closeProbability,
    expectedCloseDate: input.expectedCloseDate ?? null,
    meetingsScheduled: input.scoreInputs.meetingsScheduled ?? 0,
  })

  const recommendedOperatorAction = recommendDealOperatorAction({
    scoreInputs: input.scoreInputs,
    riskLevel,
    closeProbability,
    unansweredReplies: input.scoreInputs.unansweredReplies ?? 0,
    meetingsScheduled: input.scoreInputs.meetingsScheduled ?? 0,
    researchConfidence: input.scoreInputs.researchConfidence ?? null,
  })

  const explanation = buildDealIntelligenceExplanation({
    companyName: input.companyName,
    closeProbability,
    riskLevel,
    recommendedOperatorAction,
    positiveSignals,
    riskFactors,
    scoreInputs: input.scoreInputs,
  })

  return {
    closeProbability,
    dealRiskScore,
    forecastConfidence,
    momentumScore,
    engagementScore,
    meetingScore,
    replyScore,
    researchFitScore,
    followupDisciplineScore,
    stageHealthScore,
    riskLevel,
    predictedCloseWindow,
    recommendedOperatorAction,
    riskFactors,
    positiveSignals,
    explanation,
    scoreInputs: sanitizeScoreInputs(input.scoreInputs),
  }
}

export function sanitizeScoreInputs(input: DealIntelligenceScoreInputs): DealIntelligenceScoreInputs {
  return {
    stageKey: input.stageKey,
    stageAgeDays: input.stageAgeDays,
    amount: input.amount,
    probability: input.probability,
    forecastCategory: input.forecastCategory,
    isStale: input.isStale,
    riskScore: input.riskScore,
    engagementTier: input.engagementTier,
    engagementScore: input.engagementScore,
    meetingsCompleted: input.meetingsCompleted,
    meetingsScheduled: input.meetingsScheduled,
    meetingNoShows: input.meetingNoShows,
    repliesReceived: input.repliesReceived,
    unansweredReplies: input.unansweredReplies,
    researchConfidence: input.researchConfidence,
    websiteMaturityScore: input.websiteMaturityScore,
    painSignalCount: input.painSignalCount,
    hasOwner: input.hasOwner,
    overdueFollowUp: input.overdueFollowUp,
    competitorPressure: input.competitorPressure,
    buyingIntent: input.buyingIntent,
    closeDateOverdue: input.closeDateOverdue,
    cadenceTasksOverdue: input.cadenceTasksOverdue,
    callOverallScore: input.callOverallScore,
    callBuyingSignalScore: input.callBuyingSignalScore,
    callCompetitorRiskScore: input.callCompetitorRiskScore,
    callNextStepScore: input.callNextStepScore,
    callOutcome: input.callOutcome,
    meetingCompletedWithHighScore: input.meetingCompletedWithHighScore,
    meetingOutcomeScore: input.meetingOutcomeScore,
    meetingQualityScore: input.meetingQualityScore,
    meetingNextStepConfidence: input.meetingNextStepConfidence,
    meetingFollowUpRecommendation: input.meetingFollowUpRecommendation,
    meetingBuyingSignalCount: input.meetingBuyingSignalCount,
    meetingNoShowRiskPattern: input.meetingNoShowRiskPattern,
  }
}
