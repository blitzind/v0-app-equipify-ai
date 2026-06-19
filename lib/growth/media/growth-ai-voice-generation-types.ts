/** Growth Engine C1 — AI voice generation types (client-safe). */

export const GROWTH_AI_VOICE_GENERATION_QA_MARKER = "growth-ai-voice-generation-c1-v1" as const

export const GROWTH_AI_VOICE_GENERATION_CONFIRM = "RUN_GROWTH_AI_VOICE_GENERATION_CERTIFICATION" as const

export const GROWTH_AI_VOICE_MEDIA_SUBTYPE = "voiceover_audio" as const

export const GROWTH_AI_VOICE_DEFAULT_SETTINGS = {
  stability: 0.5,
  similarity: 0.75,
  speed: 1.0,
} as const

export type GrowthAiVoiceSettings = {
  stability: number
  similarity: number
  speed: number
}

export type GrowthAiVoiceGenerationInput = {
  videoPageId: string
  scriptVersionId?: string | null
  voiceId: string
  provider?: string | null
  settings?: Partial<GrowthAiVoiceSettings>
  dryRun?: boolean
}

export type GrowthAiVoiceProviderState = {
  enabled: boolean
  hasApiKey: boolean
  featureFlagEnabled: boolean
  dryRunOnly: boolean
  provider: "elevenlabs"
}

export type GrowthAiVoiceAiPayload = {
  voice_generation_input: GrowthAiVoiceGenerationInput
  script_version_id: string | null
  provider: string
  voice_id: string
  job_id: string | null
  media_generation_run_id: string
  output_media_asset_id: string | null
  audio_url: string | null
  sources_used: string[]
  requires_human_review: true
  autonomous_execution_enabled: false
  dry_run?: boolean
}

export type GrowthAiVoiceJobView = {
  runId: string
  aiJobId: string
  status: string
  progressPercent: number
  provider: string
  providerState: GrowthAiVoiceProviderState
  scriptVersionId: string | null
  voiceId: string | null
  settings: GrowthAiVoiceSettings
  progressTimeline: Array<{
    step: string
    progress_percent: number
    occurred_at: string
    message?: string | null
  }>
  outputMediaAssetId: string | null
  audioUrl: string | null
  downloadUrl: string | null
  aiPayload: GrowthAiVoiceAiPayload | null
  error: Record<string, unknown>
  retryCount: number
  createdAt: string
  updatedAt: string
}
