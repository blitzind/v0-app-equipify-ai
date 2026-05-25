import type {
  DealIntelligenceRiskLevel,
  DealIntelligenceScoreInputs,
  DealIntelligenceSignalLabel,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"

export function detectDealRiskFactors(input: DealIntelligenceScoreInputs): DealIntelligenceSignalLabel[] {
  const factors: DealIntelligenceSignalLabel[] = []
  if (input.meetingNoShows && input.meetingNoShows > 0) {
    factors.push({ key: "meeting_no_show", label: "Recent meeting no-show" })
  }
  if (input.unansweredReplies && input.unansweredReplies > 0) {
    factors.push({ key: "unanswered_reply", label: "Unanswered high-priority reply" })
  }
  if (input.isStale) factors.push({ key: "stale_stage", label: "Stale opportunity stage" })
  if (input.stageAgeDays != null && input.stageAgeDays > 30) {
    factors.push({ key: "long_stage_age", label: "Extended time in current stage" })
  }
  if (input.overdueFollowUp) factors.push({ key: "overdue_follow_up", label: "Overdue follow-up" })
  if (!input.hasOwner) factors.push({ key: "no_owner", label: "No assigned owner" })
  if (input.competitorPressure != null && input.competitorPressure >= 40) {
    factors.push({ key: "competitor_pressure", label: "Competitor pressure detected" })
  }
  if (input.riskScore != null && input.riskScore >= 50) {
    factors.push({ key: "pipeline_risk", label: "Pipeline risk indicators present" })
  }
  if (input.closeDateOverdue) factors.push({ key: "close_date_overdue", label: "Close date overdue" })
  if (input.cadenceTasksOverdue && input.cadenceTasksOverdue > 0) {
    factors.push({ key: "cadence_overdue", label: "Overdue cadence task" })
  }
  return factors
}

export function detectDealPositiveSignals(input: DealIntelligenceScoreInputs): DealIntelligenceSignalLabel[] {
  const signals: DealIntelligenceSignalLabel[] = []
  if (input.meetingsCompleted && input.meetingsCompleted > 0) {
    signals.push({ key: "meeting_completed", label: "Completed meeting on record" })
  }
  if (input.meetingsScheduled && input.meetingsScheduled > 0) {
    signals.push({ key: "meeting_scheduled", label: "Upcoming meeting scheduled" })
  }
  if (input.repliesReceived && input.repliesReceived > 0) {
    signals.push({ key: "prospect_reply", label: "Prospect reply received" })
  }
  if (input.researchConfidence != null && input.researchConfidence >= 60) {
    signals.push({ key: "strong_research", label: "Strong research fit" })
  }
  if (input.buyingIntent === "strong" || input.buyingIntent === "urgent") {
    signals.push({ key: "buying_intent", label: "Strong buying intent" })
  }
  if (input.engagementTier === "hot") signals.push({ key: "hot_engagement", label: "Hot engagement tier" })
  if (input.probability != null && input.probability >= 65) {
    signals.push({ key: "high_probability", label: "High stage probability" })
  }
  if (
    input.researchConfidence != null &&
    input.researchConfidence >= 55 &&
    (input.engagementTier === "warm" || input.engagementTier === "hot")
  ) {
    signals.push({ key: "research_engagement_fit", label: "High research fit with engagement" })
  }
  return signals
}

export function computeDealRiskScore(input: {
  scoreInputs: DealIntelligenceScoreInputs
  riskFactors: DealIntelligenceSignalLabel[]
  stageHealthScore: number
  followupDisciplineScore: number
}): number {
  let score = 20
  score += input.riskFactors.length * 10
  if (input.scoreInputs.closeDateOverdue) score += 18
  if (input.scoreInputs.isStale) score += 12
  if (!input.scoreInputs.hasOwner) score += 15
  if (input.scoreInputs.competitorPressure != null && input.scoreInputs.competitorPressure >= 40) score += 10
  score += Math.round((100 - input.stageHealthScore) * 0.25)
  score += Math.round((100 - input.followupDisciplineScore) * 0.2)
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function mapDealRiskLevel(dealRiskScore: number, riskFactorCount: number): DealIntelligenceRiskLevel {
  if (dealRiskScore >= 75 || riskFactorCount >= 5) return "critical"
  if (dealRiskScore >= 55 || riskFactorCount >= 3) return "high"
  if (dealRiskScore >= 30 || riskFactorCount >= 1) return "medium"
  return "low"
}
