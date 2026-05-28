/** Multi-channel coordination visibility — Phase 5C. No automatic channel triggers. */

import type { VoiceWorkflowChannel } from "@/lib/voice/workflow-orchestration/types"

export type ChannelTransitionRecord = {
  fromChannel: VoiceWorkflowChannel | null
  toChannel: VoiceWorkflowChannel
  success: boolean
  evidence: string
  timestamp: string
}

export type MultiChannelJourneySummary = {
  channelsVisited: VoiceWorkflowChannel[]
  transitionCount: number
  failedTransitions: number
  repeatedContactAttempts: number
  unresolved: boolean
  evidence: string[]
}

export function summarizeMultiChannelJourney(
  transitions: ChannelTransitionRecord[],
  contactAttemptCount: number,
  workflowResolved: boolean,
): MultiChannelJourneySummary {
  const channelsVisited = [...new Set(transitions.map((t) => t.toChannel))]
  const failedTransitions = transitions.filter((t) => !t.success).length

  return {
    channelsVisited,
    transitionCount: transitions.length,
    failedTransitions,
    repeatedContactAttempts: contactAttemptCount,
    unresolved: !workflowResolved && contactAttemptCount >= 3,
    evidence: transitions.slice(-5).map((t) => t.evidence),
  }
}

export function mapOrchestrationTypeToChannel(type: string): VoiceWorkflowChannel {
  if (type.includes("receptionist")) return "ai_receptionist"
  if (type.includes("outbound")) return "outbound_ai"
  if (type.includes("voicemail")) return "voicemail"
  if (type.includes("scheduling") || type.includes("appointment")) return "scheduling"
  if (type.includes("callback")) return "callback"
  return "voice"
}
