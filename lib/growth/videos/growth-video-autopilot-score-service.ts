/** Growth Engine F1 — Video Autopilot scoring (client-safe). */

import type {
  GrowthVideoAutopilotInputSnapshot,
  GrowthVideoAutopilotPriority,
  GrowthVideoAutopilotScoreReason,
  GrowthVideoAutopilotScores,
  GrowthVideoAutopilotVideoType,
} from "@/lib/growth/videos/growth-video-autopilot-types"

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function derivePriority(score: number): GrowthVideoAutopilotPriority {
  if (score >= 85) return "urgent"
  if (score >= 70) return "high"
  if (score >= 45) return "medium"
  return "low"
}

export function deriveGrowthVideoAutopilotVideoType(input: {
  snapshot: GrowthVideoAutopilotInputSnapshot
  reasons: GrowthVideoAutopilotScoreReason[]
}): GrowthVideoAutopilotVideoType {
  if (input.reasons.includes("reengagement_needed")) return "reengagement"
  if (input.reasons.includes("meeting_ready")) return "meeting_recap"
  if (input.snapshot.videoIntelligenceSignals.includes("video_high_intent")) return "follow_up"
  if ((input.snapshot.momentumScore ?? 0) >= 70) return "proposal_walkthrough"
  if ((input.snapshot.fitScore ?? 0) >= 75) return "quick_intro"
  return "follow_up"
}

export function scoreGrowthVideoAutopilotOpportunity(
  snapshot: GrowthVideoAutopilotInputSnapshot,
): GrowthVideoAutopilotScores {
  const reasons: GrowthVideoAutopilotScoreReason[] = []
  let opportunity = 20
  let personalization = 30

  if ((snapshot.fitScore ?? 0) >= 70) {
    opportunity += 25
    reasons.push("high_fit")
  }
  if ((snapshot.momentumScore ?? 0) >= 60) {
    opportunity += 15
  }
  if (snapshot.videoIntelligenceSignals.includes("video_high_intent")) {
    opportunity += 20
    reasons.push("high_intent")
  }
  if (snapshot.videoIntelligenceSignals.includes("video_return_visitor")) {
    opportunity += 10
    reasons.push("return_visitor")
  }
  if (
    snapshot.videoIntelligenceSignals.includes("video_calendar_clicked") ||
    snapshot.videoIntelligenceSignals.includes("video_meeting_ready")
  ) {
    opportunity += 15
    reasons.push("meeting_ready")
  }
  if ((snapshot.videoEngagementScore ?? 0) > 0 || snapshot.engagementSummary) {
    opportunity += 10
    reasons.push("recent_engagement")
  }
  if (
    snapshot.nextBestAction === "reengage" ||
    snapshot.videoIntelligenceSignals.includes("video_multiple_sessions")
  ) {
    opportunity += 12
    reasons.push("reengagement_needed")
  }

  if (snapshot.contactName) personalization += 15
  if (snapshot.companyName) personalization += 10
  if (snapshot.industry) personalization += 10
  if (snapshot.painPoints.length > 0) personalization += 15
  if (snapshot.researchSummary) personalization += 10
  if (snapshot.buyingCommitteeSummary) personalization += 10

  const videoOpportunityScore = clampScore(opportunity)
  const personalizationScore = clampScore(personalization)

  return {
    videoOpportunityScore,
    personalizationScore,
    recommendedPriority: derivePriority(videoOpportunityScore),
    reasons: [...new Set(reasons)],
  }
}

export function shouldRecommendGrowthVideoSend(scores: GrowthVideoAutopilotScores): boolean {
  return scores.videoOpportunityScore >= 40
}

export function deriveGrowthVideoAutopilotChannel(input: {
  scores: GrowthVideoAutopilotScores
  snapshot: GrowthVideoAutopilotInputSnapshot
}): "email" | "sms" | "voice_drop" {
  if (input.scores.reasons.includes("meeting_ready") || input.scores.recommendedPriority === "urgent") {
    return "email"
  }
  if (input.scores.reasons.includes("reengagement_needed")) return "sms"
  if ((input.snapshot.momentumScore ?? 0) >= 75) return "voice_drop"
  return "email"
}
