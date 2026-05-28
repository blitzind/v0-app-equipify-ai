/** Bounded multichannel recommendations — Phase 6A. No autonomous execution. */

import type {
  VoiceMultichannelRecommendation,
  VoicePreferredChannelInsight,
  VoiceUnifiedCommunicationEventPublicView,
} from "@/lib/voice/multi-channel-intelligence/types"
import {
  VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
  VOICE_MULTICHANNEL_AUTO_CHANNEL_SWITCH_DISABLED,
} from "@/lib/voice/multi-channel-intelligence/types"
import { detectCommunicationFatigue } from "@/lib/voice/multi-channel-intelligence/communication-health"
import {
  generateCommunicationRecoveryRecommendations,
  generateEscalationContinuityRecommendations,
  analyzeEscalationContinuity,
} from "@/lib/voice/multi-channel-intelligence/escalation-continuity"

export function generateMultichannelRecommendations(input: {
  events: VoiceUnifiedCommunicationEventPublicView[]
  preferredChannelInsights: VoicePreferredChannelInsight[]
}): VoiceMultichannelRecommendation[] {
  const recommendations: VoiceMultichannelRecommendation[] = []

  const escalationSummary = analyzeEscalationContinuity(input.events)
  recommendations.push(...generateEscalationContinuityRecommendations(escalationSummary))
  recommendations.push(...generateCommunicationRecoveryRecommendations(input.events))

  if (detectCommunicationFatigue(input.events)) {
    recommendations.push({
      action: "Communication fatigue detected — pause outreach and review with operator.",
      evidence: "Contact attempt threshold exceeded across channels.",
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    })
  }

  const topPreferred = input.preferredChannelInsights[0]
  if (topPreferred) {
    recommendations.push({
      action: `Preferred channel suggestion: ${topPreferred.channel.replace(/_/g, " ")} — operator confirmation required.`,
      evidence: topPreferred.reason,
      channel: topPreferred.channel,
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    })
  }

  if (VOICE_MULTICHANNEL_AUTO_CHANNEL_SWITCH_DISABLED) {
    recommendations.push({
      action: "Auto channel switch disabled — all channel changes require operator action.",
      evidence: "Platform policy: no autonomous channel switching.",
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    })
  }

  const unique = recommendations.filter(
    (r, i, arr) => arr.findIndex((x) => x.action === r.action) === i,
  )

  return unique.slice(0, 8)
}

export function generateFollowUpTimingRecommendation(
  events: VoiceUnifiedCommunicationEventPublicView[],
): VoiceMultichannelRecommendation | null {
  const lastInteraction = events[events.length - 1]
  if (!lastInteraction) return null

  const hoursSince = (Date.now() - new Date(lastInteraction.createdAt).getTime()) / (1000 * 60 * 60)

  if (hoursSince > 24 && lastInteraction.eventType !== "communication_resolved") {
    return {
      action: "Follow-up timing suggestion — review if operator outreach is appropriate.",
      evidence: `Last interaction ${Math.round(hoursSince)}h ago via ${lastInteraction.channel}.`,
      channel: lastInteraction.channel,
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    }
  }

  return null
}
