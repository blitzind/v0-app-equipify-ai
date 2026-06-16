/** Growth Engine S2-F — AI video generation lifecycle types (foundation only, no execution). */

import type { GrowthMediaAvatarProvider } from "@/lib/growth/media/media-avatar-types"

export const GROWTH_MEDIA_VIDEO_GENERATION_QA_MARKER = "growth-media-video-generation-s2f-v1" as const

export const GROWTH_MEDIA_VIDEO_GENERATION_STATUSES = [
  "draft",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const

export type GrowthMediaVideoGenerationStatus = (typeof GROWTH_MEDIA_VIDEO_GENERATION_STATUSES)[number]

export const GROWTH_MEDIA_VIDEO_GENERATION_SAFETY_FLAGS = {
  provider_execution_enabled: false,
  autonomous_execution_enabled: false,
  no_video_generation_executed: true,
} as const

export type GrowthMediaVideoPersonalizationContext = {
  prospectName?: string | null
  companyName?: string | null
  senderName?: string | null
  senderCompany?: string | null
  customMergeValues?: Record<string, string>
}

export type GrowthMediaVideoGenerationRecord = {
  generationId: string
  organizationId: string
  provider: GrowthMediaAvatarProvider
  status: GrowthMediaVideoGenerationStatus
  templateAssetId: string | null
  outputAssetId: string | null
  avatarId: string | null
  scriptTemplate: string
  mergeFieldsUsed: string[]
  personalizationContext: GrowthMediaVideoPersonalizationContext
  durationSeconds: number | null
  progress: number
  providerJobId: string | null
  error: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthMediaVideoGenerationCreateInput = {
  organizationId: string
  templateAssetId?: string | null
  avatarId?: string | null
  scriptTemplate: string
  personalizationContext?: GrowthMediaVideoPersonalizationContext
}

export type GrowthMediaVideoGenerationScriptPreview = {
  scriptTemplate: string
  resolvedScript: string
  mergeFieldsUsed: string[]
  usedFallback: boolean
}
