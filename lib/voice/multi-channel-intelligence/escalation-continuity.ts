/** Multi-channel escalation continuity — Phase 6A. Recommendations only. */

import type {
  VoiceMultichannelRecommendation,
  VoiceUnifiedCommunicationEventPublicView,
} from "@/lib/voice/multi-channel-intelligence/types"
import {
  VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
} from "@/lib/voice/multi-channel-intelligence/types"

export type EscalationContinuitySummary = {
  escalationCount: number
  escalationLoopDetected: boolean
  repeatedUnresolvedIssues: number
  failedHandoffs: number
  repeatedContactAttempts: number
  evidence: string[]
}

export function analyzeEscalationContinuity(
  events: VoiceUnifiedCommunicationEventPublicView[],
): EscalationContinuitySummary {
  const escalationEvents = events.filter((e) => e.eventType === "escalation_triggered")
  const unresolvedEvents = events.filter((e) => e.eventType === "unresolved_issue_detected")
  const failedTransitions = events.filter(
    (e) => e.eventType === "communication_failed" || e.eventType === "channel_transition" && e.payload.success === false,
  )
  const operatorHandoffs = events.filter((e) => e.eventType === "operator_takeover")

  const escalationLoopDetected = escalationEvents.length >= 3

  return {
    escalationCount: escalationEvents.length,
    escalationLoopDetected,
    repeatedUnresolvedIssues: unresolvedEvents.length,
    failedHandoffs: failedTransitions.length,
    repeatedContactAttempts: events.filter(
      (e) =>
        e.eventType === "callback_completed" ||
        e.eventType === "voicemail_left" ||
        e.eventType === "outbound_ai_completed",
    ).length,
    evidence: [
      ...escalationEvents.slice(-3).map((e) => e.evidenceText),
      ...unresolvedEvents.slice(-2).map((e) => e.evidenceText),
    ],
  }
}

export function generateEscalationContinuityRecommendations(
  summary: EscalationContinuitySummary,
): VoiceMultichannelRecommendation[] {
  const recommendations: VoiceMultichannelRecommendation[] = []

  if (summary.escalationLoopDetected) {
    recommendations.push({
      action: "Review escalation loop — assign senior operator manually.",
      evidence: `${summary.escalationCount} escalations detected across channels.`,
      channel: "voice",
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    })
  }

  if (summary.repeatedUnresolvedIssues >= 2) {
    recommendations.push({
      action: "Unresolved issues persist — coordinate with workflow orchestration for recovery.",
      evidence: `${summary.repeatedUnresolvedIssues} unresolved issue events recorded.`,
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    })
  }

  if (summary.failedHandoffs >= 2) {
    recommendations.push({
      action: "Failed channel handoffs detected — review transition timeline before next contact.",
      evidence: `${summary.failedHandoffs} failed transitions across channels.`,
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    })
  }

  if (summary.repeatedContactAttempts >= 5) {
    recommendations.push({
      action: "High contact attempt count — review communication fatigue before additional outreach.",
      evidence: `${summary.repeatedContactAttempts} contact attempts across channels.`,
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    })
  }

  return recommendations
}

export function generateCommunicationRecoveryRecommendations(
  events: VoiceUnifiedCommunicationEventPublicView[],
): VoiceMultichannelRecommendation[] {
  const lastFailed = [...events].reverse().find((e) => e.eventType === "communication_failed")
  if (!lastFailed) return []

  return [
    {
      action: `Review failed ${lastFailed.channel} communication and plan operator-led recovery.`,
      evidence: lastFailed.evidenceText,
      channel: lastFailed.channel,
      requiresOperatorReview: true,
      autonomousExecutionDisabled: VOICE_MULTICHANNEL_AUTONOMOUS_OMNICHANNEL_DISABLED,
    },
  ]
}
