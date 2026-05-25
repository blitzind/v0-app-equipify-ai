import type {
  CallIntelligenceExtractedSignals,
  CallIntelligenceMetrics,
  CallIntelligenceOutcome,
  CallIntelligenceRiskLevel,
  CallIntelligenceScoreInputs,
} from "@/lib/growth/call-intelligence/call-intelligence-types"
import { computeCompetitorRiskScore } from "@/lib/growth/call-intelligence/competitor-risk-score"
import { computeDiscoveryScore } from "@/lib/growth/call-intelligence/discovery-score"
import { computeNextStepScore } from "@/lib/growth/call-intelligence/next-step-score"
import { computeObjectionHandlingScore } from "@/lib/growth/call-intelligence/objection-score"
import { computeTalkListenBalanceScore } from "@/lib/growth/call-intelligence/talk-listen-score"

export type ComputedCallIntelligenceScore = {
  overallScore: number
  conversationQualityScore: number
  discoveryScore: number
  objectionHandlingScore: number
  buyingSignalScore: number
  nextStepScore: number
  talkListenBalanceScore: number
  competitorRiskScore: number
  confidenceScore: number
  riskLevel: CallIntelligenceRiskLevel
  outcome: CallIntelligenceOutcome
  recommendedNextAction: string
  metrics: CallIntelligenceMetrics
}

export function computeCallIntelligenceScore(input: {
  scoreInputs: CallIntelligenceScoreInputs
  signals: CallIntelligenceExtractedSignals
  insufficientData: boolean
}): ComputedCallIntelligenceScore {
  if (input.insufficientData) {
    return {
      overallScore: 0,
      conversationQualityScore: 0,
      discoveryScore: 0,
      objectionHandlingScore: 0,
      buyingSignalScore: 0,
      nextStepScore: 0,
      talkListenBalanceScore: 0,
      competitorRiskScore: 0,
      confidenceScore: 0,
      riskLevel: "medium",
      outcome: "unknown",
      recommendedNextAction: "Complete a scored call session before recompute.",
      metrics: {
        incomplete: true,
        transcriptFinalizedCount: input.scoreInputs.transcriptFinalizedCount,
      },
    }
  }

  const talkListenBalanceScore = computeTalkListenBalanceScore(input.scoreInputs)
  const discoveryScore = computeDiscoveryScore(input.scoreInputs)
  const objectionHandlingScore = computeObjectionHandlingScore(input.scoreInputs)
  const nextStepScore = computeNextStepScore(input.scoreInputs)
  const competitorRiskScore = computeCompetitorRiskScore(input.scoreInputs)

  let buyingSignalScore = Math.min(100, 35 + input.scoreInputs.buyingSignalCount * 18)
  if (input.signals.buyingSignals.length >= 2) buyingSignalScore = Math.min(100, buyingSignalScore + 10)

  let conversationQualityScore = Math.round(
    talkListenBalanceScore * 0.25 +
      discoveryScore * 0.25 +
      objectionHandlingScore * 0.2 +
      buyingSignalScore * 0.15 +
      nextStepScore * 0.15,
  )

  if (input.scoreInputs.sessionHealthScore >= 70) conversationQualityScore += 5
  if (input.scoreInputs.providerInterruptions >= 3) conversationQualityScore -= 8
  if (input.scoreInputs.meetingNoShow) conversationQualityScore -= 15
  conversationQualityScore = clamp(conversationQualityScore)

  const overallScore = clamp(
    Math.round(
      conversationQualityScore * 0.35 +
        discoveryScore * 0.2 +
        objectionHandlingScore * 0.15 +
        buyingSignalScore * 0.15 +
        nextStepScore * 0.15,
    ) - Math.round(competitorRiskScore * 0.1),
  )

  const confidenceScore = clamp(
    Math.round(
      (input.scoreInputs.executionScore ?? overallScore) * 0.5 +
        input.scoreInputs.sessionHealthScore * 0.3 +
        (input.scoreInputs.transcriptFinalizedCount >= 5 ? 15 : 5),
    ),
  )

  const riskLevel = mapCallRiskLevel({
    overallScore,
    competitorRiskScore,
    objectionCount: input.scoreInputs.objectionCount,
    nextStepScore,
    meetingNoShow: input.scoreInputs.meetingNoShow,
    sessionHealthScore: input.scoreInputs.sessionHealthScore,
  })

  const outcome = mapCallOutcome({
    overallScore,
    buyingSignalScore,
    nextStepScore,
    meetingNoShow: input.scoreInputs.meetingNoShow,
    competitorRiskScore,
  })

  const recommendedNextAction = recommendCallNextAction({
    nextStepScore,
    objectionHandlingScore,
    competitorRiskScore,
    buyingSignalScore,
    meetingFollowUpDue: input.scoreInputs.meetingFollowUpDue,
    meetingOutcomeMissing: input.scoreInputs.meetingOutcomeMissing,
  })

  return {
    overallScore,
    conversationQualityScore,
    discoveryScore,
    objectionHandlingScore,
    buyingSignalScore,
    nextStepScore,
    talkListenBalanceScore,
    competitorRiskScore,
    confidenceScore,
    riskLevel,
    outcome,
    recommendedNextAction,
    metrics: sanitizeCallMetrics(input.scoreInputs),
  }
}

export function mapCallRiskLevel(input: {
  overallScore: number
  competitorRiskScore: number
  objectionCount: number
  nextStepScore: number
  meetingNoShow: boolean
  sessionHealthScore: number
}): CallIntelligenceRiskLevel {
  if (input.meetingNoShow || (input.overallScore < 35 && input.nextStepScore < 30)) return "critical"
  if (input.competitorRiskScore >= 60 || input.objectionCount >= 3 || input.overallScore < 45) return "high"
  if (input.competitorRiskScore >= 35 || input.objectionCount >= 1 || input.sessionHealthScore < 50) return "medium"
  return "low"
}

export function mapCallOutcome(input: {
  overallScore: number
  buyingSignalScore: number
  nextStepScore: number
  meetingNoShow: boolean
  competitorRiskScore: number
}): CallIntelligenceOutcome {
  if (input.meetingNoShow || (input.overallScore < 35 && input.competitorRiskScore >= 50)) return "negative"
  if (input.overallScore >= 65 && input.buyingSignalScore >= 55 && input.nextStepScore >= 70) return "positive"
  if (input.overallScore >= 45) return "neutral"
  return "unknown"
}

export function recommendCallNextAction(input: {
  nextStepScore: number
  objectionHandlingScore: number
  competitorRiskScore: number
  buyingSignalScore: number
  meetingFollowUpDue: boolean
  meetingOutcomeMissing: boolean
}): string {
  if (input.meetingFollowUpDue) return "Complete post-call follow-up"
  if (input.meetingOutcomeMissing) return "Record meeting outcome"
  if (input.nextStepScore < 45) return "Secure explicit next step"
  if (input.objectionHandlingScore < 50) return "Review objection handling"
  if (input.competitorRiskScore >= 50) return "Prepare competitive response"
  if (input.buyingSignalScore >= 65) return "Advance opportunity with human approval"
  return "Manual review"
}

function sanitizeCallMetrics(input: CallIntelligenceScoreInputs): CallIntelligenceMetrics {
  return {
    transcriptFinalizedCount: input.transcriptFinalizedCount,
    guidanceGeneratedCount: input.guidanceGeneratedCount,
    sessionHealthScore: input.sessionHealthScore,
    executionScore: input.executionScore ?? undefined,
    providerInterruptions: input.providerInterruptions,
    guidanceLatencyMs: input.guidanceLatencyMs,
    incomplete: false,
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
