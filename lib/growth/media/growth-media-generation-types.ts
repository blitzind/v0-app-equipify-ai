/** Growth Engine C3 — Persistent media generation job types (client-safe). */

export const GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER = "growth-media-generation-jobs-c3-v1" as const

export const GROWTH_MEDIA_GENERATION_JOBS_CONFIRM = "RUN_GROWTH_MEDIA_GENERATION_JOBS_CERTIFICATION" as const

export const GROWTH_MEDIA_GENERATION_JOBS_MIGRATION =
  "20270828180000_growth_media_generation_jobs_c3.sql" as const

export const GROWTH_MEDIA_GENERATION_TYPES = [
  "voice_generation",
  "avatar_generation",
  "text_to_video",
  "image_generation",
  "video_render",
  "media_transformation",
] as const

export type GrowthMediaGenerationType = (typeof GROWTH_MEDIA_GENERATION_TYPES)[number]

export const GROWTH_MEDIA_GENERATION_STATUSES = [
  "queued",
  "preparing",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const

export type GrowthMediaGenerationStatus = (typeof GROWTH_MEDIA_GENERATION_STATUSES)[number]

export const GROWTH_MEDIA_GENERATION_PROVIDERS = [
  "elevenlabs",
  "retell",
  "internal_stub",
  "future_provider",
] as const

export type GrowthMediaGenerationProvider = (typeof GROWTH_MEDIA_GENERATION_PROVIDERS)[number]

export type GrowthMediaGenerationMetadataHooks = {
  video_page_id?: string | null
  video_asset_id?: string | null
  lead_id?: string | null
  company_candidate_id?: string | null
  person_candidate_id?: string | null
  personalization_profile_id?: string | null
  sequence_candidate_id?: string | null
  script_version_id?: string | null
  voice_media_asset_id?: string | null
}

export type GrowthMediaGenerationProgressEvent = {
  step: string
  progress_percent: number
  occurred_at: string
  message?: string | null
}

export type GrowthMediaGenerationRunInput = {
  metadata_hooks?: GrowthMediaGenerationMetadataHooks
  provider_request?: Record<string, unknown>
  writeback_target?: "media_asset" | "video_asset" | null
  notes?: string | null
}

export type GrowthMediaGenerationRunOutput = {
  progress_timeline?: GrowthMediaGenerationProgressEvent[]
  storage_writeback?: {
    target?: "media_asset" | "video_asset" | null
    storage_path?: string | null
    asset_id?: string | null
    mime_type?: string | null
  } | null
  analytics_hooks?: Record<string, unknown> | null
  ai_payload?: Record<string, unknown> | null
}

export type GrowthMediaGenerationRun = {
  id: string
  organizationId: string
  aiJobId: string
  generationType: GrowthMediaGenerationType
  provider: string
  status: GrowthMediaGenerationStatus
  progressPercent: number
  input: GrowthMediaGenerationRunInput
  output: GrowthMediaGenerationRunOutput
  error: Record<string, unknown>
  retryCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthMediaGenerationJobSummary = {
  queued: number
  processing: number
  completed: number
  failed: number
  cancelled: number
}

export type GrowthMediaGenerationSafetyFlags = {
  requires_human_review: true
  autonomous_execution_enabled: false
  provider_execution_enabled: false
  no_media_generation_executed: true
}

export const GROWTH_MEDIA_GENERATION_SAFETY_FLAGS: GrowthMediaGenerationSafetyFlags = {
  requires_human_review: true,
  autonomous_execution_enabled: false,
  provider_execution_enabled: false,
  no_media_generation_executed: true,
}
