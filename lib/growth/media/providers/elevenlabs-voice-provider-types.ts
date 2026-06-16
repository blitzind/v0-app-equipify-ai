/** Growth Engine S2-G — ElevenLabs voice provider contract (foundation only). */

import { GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS } from "@/lib/growth/media/media-voice-generation-types"

export const ELEVENLABS_VOICE_PROVIDER_QA_MARKER = "growth-elevenlabs-voice-provider-s2g-v1" as const

export const ELEVENLABS_VOICE_PROVIDER_NAME = "elevenlabs" as const

export const ELEVENLABS_VOICE_PROVIDER_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const

export type ElevenLabsVoiceProviderStatus = (typeof ELEVENLABS_VOICE_PROVIDER_STATUSES)[number]

export type ElevenLabsVoiceProviderJobRequest = {
  voiceId: string
  script: string
  modelId?: string
}

export type ElevenLabsVoiceProviderJobSnapshot = {
  providerJobId: string
  status: ElevenLabsVoiceProviderStatus
  progress: number
  outputUrl: string | null
  error: string | null
}

export type ElevenLabsVoiceProviderCapabilities = {
  provider: typeof ELEVENLABS_VOICE_PROVIDER_NAME
  executionEnabled: boolean
  supportsPolling: boolean
  supportsWebhooks: boolean
  qaMarker: typeof ELEVENLABS_VOICE_PROVIDER_QA_MARKER
} & typeof GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS
