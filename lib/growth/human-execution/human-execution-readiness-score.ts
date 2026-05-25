import type {
  HumanExecutionReadinessBand,
  HumanExecutionReadinessInput,
  HumanExecutionReadinessResult,
  HumanExecutionReadinessSignal,
  HumanExecutionReadinessSignalKey,
} from "@/lib/growth/human-execution/human-execution-types"

export const HUMAN_EXECUTION_READINESS_WEIGHTS: Record<HumanExecutionReadinessSignalKey, number> = {
  deal_intelligence: 14,
  revenue_execution_score: 12,
  call_intelligence: 11,
  engagement_score: 10,
  reply_sentiment: 13,
  meeting_outcomes: 12,
  research_maturity: 8,
  opportunity_value: 10,
  inactivity_risk: 11,
  expansion_potential: 9,
}

export const HUMAN_EXECUTION_READINESS_LABELS: Record<HumanExecutionReadinessSignalKey, string> = {
  deal_intelligence: "Deal intelligence",
  revenue_execution_score: "Revenue execution score",
  call_intelligence: "Call intelligence",
  engagement_score: "Engagement score",
  reply_sentiment: "Reply sentiment",
  meeting_outcomes: "Meeting outcomes",
  research_maturity: "Research maturity",
  opportunity_value: "Opportunity value",
  inactivity_risk: "Inactivity risk",
  expansion_potential: "Expansion potential",
}

export function resolveHumanExecutionReadinessBand(score: number): HumanExecutionReadinessBand {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 40) return "normal"
  return "low"
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreDealIntelligence(input: HumanExecutionReadinessInput): number {
  const close = input.dealCloseProbability ?? 0
  const risk = input.dealRiskScore ?? 0
  return clampScore(close * 0.55 + risk * 0.45)
}

function scoreCallIntelligence(input: HumanExecutionReadinessInput): number {
  const overall = input.callOverallScore ?? 50
  const nextStep = input.callNextStepScore ?? 50
  const gap = 100 - Math.min(overall, nextStep)
  return clampScore(gap)
}

function scoreReplySentiment(input: HumanExecutionReadinessInput): number {
  const intent = input.replyIntent ?? ""
  if (intent === "positive_interest" || intent === "meeting_request") return 90
  if (intent === "pricing_question" || intent === "competitor_mention") return 75
  if (intent === "objection" || intent === "not_interested") return 55
  if (intent === "out_of_office" || intent === "timing_delay") return 35
  if (input.replyPriority === "critical" || input.replyPriority === "high") return 70
  return 20
}

function scoreMeetingOutcomes(input: HumanExecutionReadinessInput): number {
  if (input.meetingFollowUpOverdue) return 85
  const outcome = input.meetingOutcome ?? ""
  if (outcome === "no_show") return 80
  if (outcome === "completed_positive" || outcome === "completed") return 65
  if (outcome === "scheduled") return 50
  return 25
}

function scoreOpportunityValue(input: HumanExecutionReadinessInput): number {
  const amount = input.opportunityAmount ?? 0
  if (amount >= 100000) return 90
  if (amount >= 50000) return 75
  if (amount >= 25000) return 60
  if (amount >= 10000) return 45
  return 25
}

function scoreInactivityRisk(input: HumanExecutionReadinessInput): number {
  const days = input.daysSinceLastTouch ?? 0
  if (days >= 21) return 90
  if (days >= 14) return 75
  if (days >= 7) return 55
  if (days >= 3) return 35
  return 15
}

function scoreExpansionPotential(input: HumanExecutionReadinessInput): number {
  return input.expansionCandidate ? 75 : 15
}

function scoreResearchMaturity(input: HumanExecutionReadinessInput): number {
  return clampScore(input.researchMaturityScore ?? 0)
}

function scoreEngagement(input: HumanExecutionReadinessInput): number {
  return clampScore(input.engagementScore ?? 0)
}

function scoreRevenueExecution(input: HumanExecutionReadinessInput): number {
  return clampScore(input.revenueExecutionScore ?? 0)
}

export function computeHumanExecutionReadiness(
  input: HumanExecutionReadinessInput,
): HumanExecutionReadinessResult {
  const contributions: Array<{ key: HumanExecutionReadinessSignalKey; contribution: number }> = [
    { key: "deal_intelligence", contribution: scoreDealIntelligence(input) },
    { key: "revenue_execution_score", contribution: scoreRevenueExecution(input) },
    { key: "call_intelligence", contribution: scoreCallIntelligence(input) },
    { key: "engagement_score", contribution: scoreEngagement(input) },
    { key: "reply_sentiment", contribution: scoreReplySentiment(input) },
    { key: "meeting_outcomes", contribution: scoreMeetingOutcomes(input) },
    { key: "research_maturity", contribution: scoreResearchMaturity(input) },
    { key: "opportunity_value", contribution: scoreOpportunityValue(input) },
    { key: "inactivity_risk", contribution: scoreInactivityRisk(input) },
    { key: "expansion_potential", contribution: scoreExpansionPotential(input) },
  ]

  const signals: HumanExecutionReadinessSignal[] = contributions
    .map(({ key, contribution }) => ({
      key,
      label: HUMAN_EXECUTION_READINESS_LABELS[key],
      weight: HUMAN_EXECUTION_READINESS_WEIGHTS[key],
      contribution,
    }))
    .filter((signal) => signal.contribution >= 30)
    .sort((a, b) => b.contribution * b.weight - a.contribution * a.weight)

  const weightedSum = contributions.reduce(
    (sum, item) => sum + item.contribution * (HUMAN_EXECUTION_READINESS_WEIGHTS[item.key] / 100),
    0,
  )
  const totalWeight =
    Object.values(HUMAN_EXECUTION_READINESS_WEIGHTS).reduce((sum, weight) => sum + weight, 0) / 100
  const readinessScore = clampScore(weightedSum / totalWeight)

  const callNowRecommended =
    readinessScore >= 75 &&
    (scoreReplySentiment(input) >= 70 ||
      scoreInactivityRisk(input) >= 75 ||
      (input.dealCloseProbability ?? 0) >= 60)

  return {
    readinessScore,
    readinessBand: resolveHumanExecutionReadinessBand(readinessScore),
    signals,
    callNowRecommended,
  }
}

export function humanExecutionReadinessBandTone(
  band: HumanExecutionReadinessBand,
): "critical" | "attention" | "medium" | "neutral" {
  if (band === "critical") return "critical"
  if (band === "high") return "attention"
  if (band === "normal") return "medium"
  return "neutral"
}
