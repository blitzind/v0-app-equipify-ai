import type {
  MeetingOutcomeFollowUpRecommendation,
  MeetingOutcomeMomentumTrend,
  MeetingOutcomeScoreInputs,
} from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"

export type ComputedMeetingOutcomeIntelligenceScore = {
  meetingOutcomeScore: number
  meetingQualityScore: number
  nextStepConfidence: number
  followUpRecommendation: MeetingOutcomeFollowUpRecommendation
  buyingSignalCount: number
  objectionCount: number
  championDetected: boolean
  decisionMakerPresent: boolean
  timelineDetected: boolean
  budgetSignal: boolean
  urgencySignal: boolean
  noShowRiskPattern: boolean
  momentumTrend: MeetingOutcomeMomentumTrend
  recommendedNextStep: string
  safeSummary: string
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function detectSignals(input: MeetingOutcomeScoreInputs): {
  buyingSignalCount: number
  objectionCount: number
  championDetected: boolean
  decisionMakerPresent: boolean
  timelineDetected: boolean
  budgetSignal: boolean
  urgencySignal: boolean
  noShowRiskPattern: boolean
} {
  const buyingSignalCount = Math.max(
    input.callBuyingSignalCount,
    input.callBuyingSignalScore != null && input.callBuyingSignalScore >= 55 ? 2 : 0,
    input.replyIntent === "positive_interest" || input.replyIntent === "meeting_request" ? 1 : 0,
  )
  const objectionCount = Math.max(
    input.callObjectionCount,
    input.replyIntent === "objection" ? 1 : 0,
  )

  const championDetected =
    buyingSignalCount >= 2 &&
    (input.callNextStepScore ?? 0) >= 55 &&
    (input.engagementScore ?? 0) >= 50

  const decisionMakerPresent =
    input.attendeeCount >= 2 ||
    (input.callOverallScore ?? 0) >= 60 ||
    input.meetingOutcome?.toLowerCase().includes("decision") === true

  const timelineDetected =
    input.replyIntent === "pricing_question" ||
    input.meetingOutcome?.toLowerCase().includes("timeline") === true ||
    (input.dealCloseProbability ?? 0) >= 55

  const budgetSignal =
    input.replyIntent === "pricing_question" ||
    input.meetingOutcome?.toLowerCase().includes("budget") === true ||
    buyingSignalCount >= 2

  const urgencySignal =
    input.replyPriority === "critical" ||
    input.replyPriority === "high" ||
    (input.executionReadinessScore ?? 0) >= 75

  const noShowRiskPattern =
    input.meetingNoShow ||
    input.priorNoShowCount >= 1 ||
    (input.priorMeetingCount >= 2 && input.meetingFollowUpOverdue)

  return {
    buyingSignalCount,
    objectionCount,
    championDetected,
    decisionMakerPresent,
    timelineDetected,
    budgetSignal,
    urgencySignal,
    noShowRiskPattern,
  }
}

export function computeMeetingOutcomeIntelligenceScore(
  input: MeetingOutcomeScoreInputs,
): ComputedMeetingOutcomeIntelligenceScore {
  const signals = detectSignals(input)

  if (input.meetingNoShow || input.meetingStatus === "no_show") {
    return {
      meetingOutcomeScore: clamp(25 - input.priorNoShowCount * 5),
      meetingQualityScore: 15,
      nextStepConfidence: 35,
      followUpRecommendation: "no_show_recovery",
      ...signals,
      momentumTrend: "at_risk",
      recommendedNextStep: "Operator should attempt no-show recovery call and reschedule — no auto-send.",
      safeSummary: "No-show detected. Recovery outreach recommended for operator review.",
    }
  }

  if (input.meetingOutcomeMissing && input.meetingStatus === "completed") {
    return {
      meetingOutcomeScore: 40,
      meetingQualityScore: 35,
      nextStepConfidence: 30,
      followUpRecommendation: "needs_follow_up",
      ...signals,
      momentumTrend: "slipping",
      recommendedNextStep: "Record meeting outcome and plan operator follow-up.",
      safeSummary: "Completed meeting missing outcome — follow-up discipline needed.",
    }
  }

  let meetingQualityScore = clamp(
    (input.callOverallScore ?? 45) * 0.45 +
      (input.callNextStepScore ?? 40) * 0.25 +
      (input.callBuyingSignalScore ?? 35) * 0.2 +
      (input.engagementScore ?? 40) * 0.1,
  )

  if (signals.decisionMakerPresent) meetingQualityScore += 8
  if (signals.championDetected) meetingQualityScore += 6
  if (signals.objectionCount >= 2) meetingQualityScore -= 10
  if (input.meetingFollowUpOverdue) meetingQualityScore -= 12
  meetingQualityScore = clamp(meetingQualityScore)

  let meetingOutcomeScore = clamp(
    meetingQualityScore * 0.4 +
      (input.dealCloseProbability ?? 40) * 0.2 +
      (input.executionReadinessScore ?? 40) * 0.15 +
      (100 - (input.dealRiskScore ?? 30)) * 0.15 +
      signals.buyingSignalCount * 5,
  )

  if (signals.budgetSignal && signals.timelineDetected) meetingOutcomeScore += 8
  if (signals.noShowRiskPattern) meetingOutcomeScore -= 15
  meetingOutcomeScore = clamp(meetingOutcomeScore)

  const nextStepConfidence = clamp(
    (input.callNextStepScore ?? 40) * 0.35 +
      meetingQualityScore * 0.25 +
      (input.executionReadinessScore ?? 40) * 0.2 +
      (signals.championDetected ? 15 : 0) +
      (input.meetingFollowUpOverdue ? -15 : 0),
  )

  let momentumTrend: MeetingOutcomeMomentumTrend = "stable"
  if (meetingOutcomeScore >= 70 && signals.buyingSignalCount >= 2) momentumTrend = "building"
  else if (input.meetingFollowUpOverdue || signals.objectionCount >= 2) momentumTrend = "slipping"
  else if ((input.dealRiskScore ?? 0) >= 65 || signals.noShowRiskPattern) momentumTrend = "at_risk"

  const followUpRecommendation = resolveFollowUpRecommendation({
    input,
    signals,
    meetingOutcomeScore,
    meetingQualityScore,
    nextStepConfidence,
    momentumTrend,
  })

  const recommendedNextStep = resolveRecommendedNextStep(followUpRecommendation, signals)
  const safeSummary = buildSafeSummary(followUpRecommendation, signals, meetingOutcomeScore)

  return {
    meetingOutcomeScore,
    meetingQualityScore,
    nextStepConfidence,
    followUpRecommendation,
    ...signals,
    momentumTrend,
    recommendedNextStep,
    safeSummary,
  }
}

function resolveFollowUpRecommendation(input: {
  input: MeetingOutcomeScoreInputs
  signals: ReturnType<typeof detectSignals>
  meetingOutcomeScore: number
  meetingQualityScore: number
  nextStepConfidence: number
  momentumTrend: MeetingOutcomeMomentumTrend
}): MeetingOutcomeFollowUpRecommendation {
  if (input.input.meetingNoShow) return "no_show_recovery"
  if (input.meetingOutcomeScore >= 78 && input.signals.buyingSignalCount >= 2 && input.signals.budgetSignal) {
    return "strong_opportunity"
  }
  if (input.signals.budgetSignal && input.signals.timelineDetected && input.meetingOutcomeScore >= 65) {
    return "send_proposal_recommendation"
  }
  if (input.signals.championDetected && input.signals.decisionMakerPresent && input.nextStepConfidence >= 60) {
    return "book_next_meeting_recommendation"
  }
  if (
    input.momentumTrend === "at_risk" &&
    (input.input.dealRiskScore ?? 0) >= 60 &&
    !input.signals.championDetected
  ) {
    return "executive_escalation_recommended"
  }
  if (input.momentumTrend === "slipping" || input.input.meetingFollowUpOverdue || input.signals.objectionCount >= 2) {
    return "risk_of_stall"
  }
  return "needs_follow_up"
}

function resolveRecommendedNextStep(
  recommendation: MeetingOutcomeFollowUpRecommendation,
  signals: ReturnType<typeof detectSignals>,
): string {
  switch (recommendation) {
    case "strong_opportunity":
      return "Advance deal with operator-led follow-up and confirm next meeting — recommendation only."
    case "send_proposal_recommendation":
      return "Operator should prepare and send proposal after human review — no auto-send."
    case "book_next_meeting_recommendation":
      return "Recommend booking next meeting via operator scheduling — no auto-scheduling."
    case "executive_escalation_recommended":
      return "Consider executive sponsor involvement — operator decides escalation."
    case "no_show_recovery":
      return "Attempt recovery call and reschedule — operator controlled."
    case "risk_of_stall":
      return "Address objections and re-engage within 48 hours — operator task."
    default:
      return signals.championDetected
        ? "Send personalized follow-up — operator approval required."
        : "Standard follow-up recommended — operator controlled."
  }
}

function buildSafeSummary(
  recommendation: MeetingOutcomeFollowUpRecommendation,
  signals: ReturnType<typeof detectSignals>,
  score: number,
): string {
  return `Meeting outcome score ${score}/100. ${recommendation.replace(/_/g, " ")}. Buying signals: ${signals.buyingSignalCount}, objections: ${signals.objectionCount}.`
}
