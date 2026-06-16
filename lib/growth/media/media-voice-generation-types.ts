/** Growth Engine S2-G — AI voice generation lifecycle types (foundation only, no execution). */

import type { GrowthMediaVoiceProvider } from "@/lib/growth/media/media-voice-types"

export const GROWTH_MEDIA_VOICE_GENERATION_QA_MARKER = "growth-media-voice-generation-s2g-v1" as const

export const GROWTH_MEDIA_VOICE_GENERATION_STATUSES = [
  "draft",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const

export type GrowthMediaVoiceGenerationStatus = (typeof GROWTH_MEDIA_VOICE_GENERATION_STATUSES)[number]

export const GROWTH_MEDIA_VOICE_GENERATION_SAFETY_FLAGS = {
  provider_execution_enabled: false,
  autonomous_execution_enabled: false,
  no_voice_generation_executed: true,
  no_generated_audio_assets: true,
  no_playback: true,
  no_notifications: true,
  no_sequence_execution: true,
} as const

export type GrowthMediaVoicePersonalizationContext = {
  prospectName?: string | null
  companyName?: string | null
  senderName?: string | null
  senderCompany?: string | null
  customMergeValues?: Record<string, string>
}

export type GrowthMediaVoiceGenerationRecord = {
  generationId: string
  organizationId: string
  provider: GrowthMediaVoiceProvider
  status: GrowthMediaVoiceGenerationStatus
  templateAssetId: string | null
  outputAssetId: string | null
  voiceId: string | null
  scriptTemplate: string
  mergeFieldsUsed: string[]
  personalizationContext: GrowthMediaVoicePersonalizationContext
  durationSeconds: number | null
  progress: number
  providerJobId: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthMediaVoiceGenerationCreateInput = {
  organizationId: string
  templateAssetId?: string | null
  voiceId?: string | null
  scriptTemplate: string
  personalizationContext?: GrowthMediaVoicePersonalizationContext
}

export type GrowthMediaVoiceGenerationScriptPreview = {
  scriptTemplate: string
  resolvedScript: string
  mergeFieldsUsed: string[]
  usedFallback: boolean
}
