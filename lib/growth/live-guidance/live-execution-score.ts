import type {
  GrowthLiveCoachingState,
  GrowthLiveExecutionBadge,
  GrowthLiveExecutionScore,
} from "@/lib/growth/live-guidance/live-guidance-types"
import type {
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import { detectNextStepLanguage } from "@/lib/growth/realtime/realtime-risk-detection"

const DISCOVERY_AREAS = 5

export function computeCallExecutionScore(input: {
  snapshot: GrowthRealtimeLiveSnapshot
  events: Pick<GrowthRealtimeTranscriptEvent, "content">[]
  acceptedGuidanceCount?: number
}): GrowthLiveExecutionScore {
  const { snapshot, events } = input
  const discoveryCoverage = Math.round((snapshot.discovery.covered.length / DISCOVERY_AREAS) * 100)
  const talkRatioScore =
    snapshot.talkRatio.inGoalRange ? 100 : snapshot.talkRatio.repTalkPercent > 65 ? 35 : 70
  const objectionsHandled = Math.max(0, 100 - snapshot.objections.length * 15)
  const buyingSignalsCaptured = Math.min(100, snapshot.buyingSignals.length * 25)
  const timelineDiscovered = snapshot.discovery.covered.includes("timeline_asked")
  const decisionMakerIdentified = snapshot.discovery.covered.includes("decision_maker_confirmed")
  const nextStepSecured = events.some((event) => detectNextStepLanguage(event.content))

  let score = Math.round(
    talkRatioScore * 0.2 +
      discoveryCoverage * 0.25 +
      objectionsHandled * 0.15 +
      buyingSignalsCaptured * 0.2 +
      (timelineDiscovered ? 10 : 0) +
      (decisionMakerIdentified ? 10 : 0) +
      (nextStepSecured ? 10 : 0),
  )

  if (snapshot.riskFlags.includes("executive_account_risk")) score -= 8
  if (snapshot.riskFlags.includes("multiple_objections_stacking")) score -= 10
  score += Math.min(10, (input.acceptedGuidanceCount ?? 0) * 2)
  score = Math.max(0, Math.min(100, score))

  const badge = executionBadgeForScore(score)

  return {
    score,
    badge,
    badgeLabel: badgeLabel(badge),
    factors: {
      talkRatio: talkRatioScore,
      discoveryCoverage,
      objectionsHandled,
      buyingSignalsCaptured,
      timelineDiscovered,
      decisionMakerIdentified,
      nextStepSecured,
    },
  }
}

function executionBadgeForScore(score: number): GrowthLiveExecutionBadge {
  if (score >= 95) return "elite_operator"
  if (score >= 85) return "strong"
  if (score >= 70) return "good"
  if (score >= 50) return "recoverable"
  return "at_risk"
}

function badgeLabel(badge: GrowthLiveExecutionBadge): string {
  const labels: Record<GrowthLiveExecutionBadge, string> = {
    elite_operator: "Elite Operator",
    strong: "Strong",
    good: "Good",
    recoverable: "Recoverable",
    at_risk: "At Risk",
  }
  return labels[badge]
}

export function computeLiveRiskLevel(snapshot: GrowthRealtimeLiveSnapshot): "low" | "medium" | "high" {
  if (snapshot.riskFlags.includes("executive_account_risk") || snapshot.riskFlags.length >= 4) return "high"
  if (snapshot.riskFlags.length >= 2) return "medium"
  return "low"
}

export function computeLiveMomentum(snapshot: GrowthRealtimeLiveSnapshot): GrowthLiveCoachingState["momentum"] {
  if (snapshot.riskFlags.includes("call_momentum_slowing") || snapshot.riskFlags.includes("multiple_objections_stacking")) {
    return "at_risk"
  }
  if (snapshot.riskFlags.includes("negative_sentiment_shift")) return "slowing"
  if (snapshot.buyingSignals.length >= 2 && snapshot.discovery.covered.length >= 3) return "building"
  return "stable"
}
