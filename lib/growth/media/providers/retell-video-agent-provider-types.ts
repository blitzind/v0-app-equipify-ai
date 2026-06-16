/** Growth Engine S2-H — Retell video agent provider contract types (foundation only). */

import type { GrowthMediaConversationalSessionStatus } from "@/lib/growth/media/media-conversational-session-types"

export const RETELL_VIDEO_AGENT_PROVIDER_NAME = "retell" as const
export const RETELL_VIDEO_AGENT_PROVIDER_QA_MARKER = "retell-video-agent-provider-s2h-v1" as const

export const RETELL_VIDEO_AGENT_PROVIDER_STATUSES = [
  "pending",
  "ready",
  "active",
  "completed",
  "failed",
  "cancelled",
] as const

export type RetellVideoAgentProviderStatus = (typeof RETELL_VIDEO_AGENT_PROVIDER_STATUSES)[number]

export type RetellVideoAgentProviderCapabilities = {
  provider: typeof RETELL_VIDEO_AGENT_PROVIDER_NAME
  executionEnabled: false
  supportsWebRtc: false
  supportsWebhooks: false
  qaMarker: typeof RETELL_VIDEO_AGENT_PROVIDER_QA_MARKER
  provider_execution_enabled: false
  autonomous_execution_enabled: false
  no_conversation_execution: true
  no_generated_media_assets: true
  no_playback: true
  no_notifications: true
  no_sequence_execution: true
}

export type RetellVideoAgentProviderSessionRequest = {
  agentId: string
  systemPrompt: string
  qualificationGoal?: string | null
}

export type RetellVideoAgentProviderSessionSnapshot = {
  providerSessionId: string
  status: RetellVideoAgentProviderStatus
  transcript: string | null
  summary: string | null
}

export type RetellVideoAgentProviderStatusMapTarget = GrowthMediaConversationalSessionStatus
