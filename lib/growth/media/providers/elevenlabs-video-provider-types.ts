/** Growth Engine S2-F — ElevenLabs video provider contract (foundation only). */

import { GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS } from "@/lib/growth/media/media-video-generation-types"

export const ELEVENLABS_VIDEO_PROVIDER_QA_MARKER = "growth-elevenlabs-video-provider-s2f-v1" as const

export const ELEVENLABS_VIDEO_PROVIDER_NAME = "elevenlabs" as const

export const ELEVENLABS_VIDEO_PROVIDER_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const

export type ElevenLabsVideoProviderStatus = (typeof ELEVENLABS_VIDEO_PROVIDER_STATUSES)[number]

export type ElevenLabsVideoProviderJobRequest = {
  avatarId: string
  script: string
  resolution?: string
  voiceId?: string
}

export type ElevenLabsVideoProviderJobSnapshot = {
  providerJobId: string
  status: ElevenLabsVideoProviderStatus
  progress: number
  outputUrl: string | null
  error: string | null
}

export type ElevenLabsVideoProviderCapabilities = {
  provider: typeof ELEVENLABS_VIDEO_PROVIDER_NAME
  executionEnabled: boolean
  supportsPolling: boolean
  supportsWebhooks: boolean
  qaMarker: typeof ELEVENLABS_VIDEO_PROVIDER_QA_MARKER
} & typeof GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS
