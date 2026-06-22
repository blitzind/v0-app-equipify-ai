/** Growth Engine C2 — AI avatar generation types (client-safe). */

import type { GeV13ProspectGenerationInput } from "@/lib/growth/media/ge-v1-3-types"

export const GROWTH_AI_AVATAR_GENERATION_QA_MARKER = "growth-ai-avatar-generation-c2-v1" as const

export const GROWTH_AI_AVATAR_GENERATION_CONFIRM = "RUN_GROWTH_AI_AVATAR_GENERATION_CERTIFICATION" as const

export const GROWTH_AI_AVATAR_MEDIA_SUBTYPE = "generated_avatar_video" as const

export const GROWTH_AI_AVATAR_DEFAULT_RESOLUTION = "1280x720" as const

export const GROWTH_AI_AVATAR_DEFAULT_BACKGROUND = "branded" as const

export const GROWTH_AI_AVATAR_DEFAULT_THEME = "inherit_page_branding" as const

export const GROWTH_AI_AVATAR_PROVIDERS = ["elevenlabs", "retell"] as const

export type GrowthAiAvatarProvider = (typeof GROWTH_AI_AVATAR_PROVIDERS)[number]

export type GrowthAiAvatarSettings = {
  resolution: string
  background: string
  theme: string
}

export const GROWTH_AI_AVATAR_DEFAULT_SETTINGS: GrowthAiAvatarSettings = {
  resolution: GROWTH_AI_AVATAR_DEFAULT_RESOLUTION,
  background: GROWTH_AI_AVATAR_DEFAULT_BACKGROUND,
  theme: GROWTH_AI_AVATAR_DEFAULT_THEME,
}

export type GrowthAiAvatarGenerationInput = {
  videoPageId: string
  scriptVersionId?: string | null
  avatarId: string
  provider?: GrowthAiAvatarProvider | null
  voiceMediaAssetId?: string | null
  settings?: Partial<GrowthAiAvatarSettings>
  dryRun?: boolean
  prospect?: GeV13ProspectGenerationInput | null
  attachToPageOnComplete?: boolean
}

export type GrowthAiAvatarProviderState = {
  provider: GrowthAiAvatarProvider
  enabled: boolean
  hasApiKey: boolean
  featureFlagEnabled: boolean
  dryRunOnly: boolean
}

export type GrowthAiAvatarProviderStates = {
  elevenlabs: GrowthAiAvatarProviderState
  retell: GrowthAiAvatarProviderState
}

export type GrowthAiAvatarAiPayload = {
  avatar_generation_input: GrowthAiAvatarGenerationInput
  script_version_id: string | null
  voice_media_asset_id: string | null
  provider: string
  avatar_id: string
  job_id: string | null
  media_generation_run_id: string
  output_media_asset_id: string | null
  video_url: string | null
  sources_used: string[]
  requires_human_review: true
  autonomous_execution_enabled: false
  dry_run?: boolean
}

export type GrowthAiAvatarJobView = {
  runId: string
  aiJobId: string
  status: string
  progressPercent: number
  provider: string
  providerStates: GrowthAiAvatarProviderStates
  scriptVersionId: string | null
  avatarId: string | null
  voiceMediaAssetId: string | null
  settings: GrowthAiAvatarSettings
  progressTimeline: Array<{
    step: string
    progress_percent: number
    occurred_at: string
    message?: string | null
  }>
  outputMediaAssetId: string | null
  videoUrl: string | null
  downloadUrl: string | null
  aiPayload: GrowthAiAvatarAiPayload | null
  error: Record<string, unknown>
  retryCount: number
  createdAt: string
  updatedAt: string
}

export type GrowthAiAvatarVoiceAssetOption = {
  mediaAssetId: string
  runId: string
  title: string | null
  dryRun: boolean
}
