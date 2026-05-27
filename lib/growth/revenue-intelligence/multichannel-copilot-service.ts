import type { ChannelAwareMomentumResult } from "@/lib/growth/revenue-intelligence/channel-aware-momentum-engine"
import type { CallMeetingIntelligenceSummary } from "@/lib/growth/revenue-intelligence/call-meeting-intelligence-bridge"
import {
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthMultichannelCopilotAssist,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"
import type { GrowthMultichannelActivityEntry } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"
import type { GrowthWebsiteIntentCorrelation } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

/** Deterministic multi-channel copilot — labeled AI-assisted, recommendation-only. */
export function buildMultichannelRevenueCopilot(input: {
  companyLabel: string
  momentum: ChannelAwareMomentumResult
  timelineEntries: GrowthMultichannelActivityEntry[]
  callMeeting: CallMeetingIntelligenceSummary
  intentCorrelation: GrowthWebsiteIntentCorrelation
  bestNextTouchpoint: string
  engagementGaps: string[]
}): GrowthMultichannelCopilotAssist {
  const evidenceExcerpts = [
    ...input.momentum.evidence,
    ...input.callMeeting.evidence,
    ...input.intentCorrelation.evidence,
    ...input.timelineEntries.map((e) => e.evidenceExcerpt).filter(Boolean) as string[],
  ]
    .filter(Boolean)
    .slice(0, 8)

  const channelCounts = new Map<string, number>()
  for (const entry of input.timelineEntries) {
    channelCounts.set(entry.channel, (channelCounts.get(entry.channel) ?? 0) + 1)
  }
  const channelSummary =
    channelCounts.size > 0
      ? [...channelCounts.entries()].map(([ch, count]) => `${ch}: ${count}`).join(", ")
      : "No multi-channel timeline evidence yet."

  const operatorPriorities: string[] = []
  if (input.momentum.momentumTrend === "stalled") operatorPriorities.push("Review stalled account — confirm human follow-up plan.")
  if (input.callMeeting.meetingsBooked > 0 && input.callMeeting.meetingsAttended === 0) {
    operatorPriorities.push("Meeting booked but not yet attended — confirm attendance.")
  }
  if (input.intentCorrelation.correlationStrength === "strong") {
    operatorPriorities.push("Strong website + outbound correlation — prioritize operator review.")
  }
  if (input.engagementGaps.length > 0) {
    operatorPriorities.push(`Close engagement gap: ${input.engagementGaps[0]}`)
  }
  if (operatorPriorities.length === 0) {
    operatorPriorities.push("Monitor channel mix — no high-confidence priority without operator judgment.")
  }

  const meetingCallOutcomeSummary =
    input.callMeeting.meetingsAttended > 0 || input.callMeeting.connectedCallCount > 0
      ? `Calls connected: ${input.callMeeting.connectedCallCount}. Meetings attended: ${input.callMeeting.meetingsAttended}. Follow-ups: ${input.callMeeting.followUpCommitments.slice(0, 2).join("; ") || "none recorded"}.`
      : "Limited call/meeting outcome evidence — do not infer sentiment without operator notes."

  return {
    qaMarker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    assistedLabel: "AI-assisted",
    accountActivitySummary: `${input.companyLabel}: channel-aware momentum ${input.momentum.compositeMomentumScore}/100 (${input.momentum.momentumTrend}). ${input.timelineEntries.length} timeline event(s).`,
    channelEngagementSummary: channelSummary,
    suggestedNextTouchpoint: input.bestNextTouchpoint,
    engagementGaps: input.engagementGaps,
    operatorPriorities,
    meetingCallOutcomeSummary,
    evidenceExcerpts,
    confidenceNote:
      input.timelineEntries.length >= 3 && input.momentum.compositeMomentumScore >= 50
        ? "Moderate confidence from multi-channel evidence — operator must verify before action."
        : "Low confidence — insufficient cross-channel evidence for strong conclusions.",
  }
}
