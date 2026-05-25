import type { DealIntelligenceScoreInputs } from "@/lib/growth/deal-intelligence/deal-intelligence-types"

export function computeDealMomentumScore(input: DealIntelligenceScoreInputs): number {
  let score = 40
  if (input.meetingsCompleted && input.meetingsCompleted > 0) score += 15
  if (input.meetingsScheduled && input.meetingsScheduled > 0) score += 10
  if (input.repliesReceived && input.repliesReceived > 0) score += 10
  if (input.engagementTier === "hot") score += 20
  else if (input.engagementTier === "warm") score += 12
  if (input.buyingIntent === "strong" || input.buyingIntent === "urgent") score += 15
  if (input.overdueFollowUp) score -= 15
  if (input.meetingNoShows && input.meetingNoShows > 0) score -= 12
  if (input.cadenceTasksOverdue && input.cadenceTasksOverdue > 0) score -= 8
  return clamp(score)
}

export function computeDealEngagementScore(input: DealIntelligenceScoreInputs): number {
  let score = input.engagementScore ?? 35
  if (input.engagementTier === "hot") score = Math.max(score, 85)
  else if (input.engagementTier === "warm") score = Math.max(score, 65)
  else if (input.engagementTier === "cool") score = Math.min(score, 45)
  if (input.repliesReceived && input.repliesReceived > 0) score += 8
  return clamp(score)
}

export function computeDealMeetingScore(input: DealIntelligenceScoreInputs): number {
  let score = 30
  if (input.meetingsCompleted && input.meetingsCompleted > 0) score += 35
  if (input.meetingsScheduled && input.meetingsScheduled > 0) score += 25
  if (input.meetingNoShows && input.meetingNoShows > 0) score -= 20
  return clamp(score)
}

export function computeDealReplyScore(input: DealIntelligenceScoreInputs): number {
  let score = 35
  if (input.repliesReceived && input.repliesReceived > 0) score += 25
  if (input.unansweredReplies && input.unansweredReplies > 0) score -= input.unansweredReplies * 12
  if (input.buyingIntent === "strong" || input.buyingIntent === "urgent") score += 15
  return clamp(score)
}

export function computeDealResearchFitScore(input: DealIntelligenceScoreInputs): number {
  let score = 35
  if (input.researchConfidence != null) score += Math.round(input.researchConfidence * 0.35)
  if (input.websiteMaturityScore != null && input.websiteMaturityScore >= 50) score += 8
  if (input.painSignalCount != null && input.painSignalCount >= 3) score += 10
  return clamp(score)
}

export function computeDealFollowupDisciplineScore(input: DealIntelligenceScoreInputs): number {
  let score = 70
  if (input.overdueFollowUp) score -= 35
  if (!input.hasOwner) score -= 25
  if (input.unansweredReplies && input.unansweredReplies > 0) score -= input.unansweredReplies * 10
  if (input.cadenceTasksOverdue && input.cadenceTasksOverdue > 0) score -= input.cadenceTasksOverdue * 8
  return clamp(score)
}

export function computeDealStageHealthScore(input: DealIntelligenceScoreInputs): number {
  let score = 60
  if (input.isStale) score -= 25
  if (input.stageAgeDays != null && input.stageAgeDays > 21) score -= 15
  if (input.riskScore != null && input.riskScore >= 40) score -= Math.min(30, input.riskScore / 2)
  if (input.probability != null && input.probability >= 60) score += 10
  if (input.closeDateOverdue) score -= 20
  return clamp(score)
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}
