/** Growth Engine S1.5 — Media asset types (client-safe). */

export const GROWTH_MEDIA_ASSETS_QA_MARKER = "growth-media-assets-s1-5-v1" as const

export const GROWTH_MEDIA_ASSETS_CONFIRM = "RUN_GROWTH_MEDIA_ASSETS_CERTIFICATION" as const

export const GROWTH_MEDIA_ASSETS_MIGRATION = "20270827120700_growth_media_assets_s1_5.sql" as const

export const GROWTH_MEDIA_ASSETS_BUCKET = "growth-media-assets" as const

export const GROWTH_MEDIA_ASSET_TYPES = [
  "video",
  "audio",
  "image",
  "thumbnail",
  "waveform",
  "avatar_video",
  "voice_clone",
  "generated_video",
  "generated_audio",
  "other",
] as const

export type GrowthMediaAssetType = (typeof GROWTH_MEDIA_ASSET_TYPES)[number]

export const GROWTH_MEDIA_ASSET_PROVIDERS = [
  "local_stub",
  "supabase_storage",
  "future_s3",
  "future_cloudflare_r2",
] as const

export type GrowthMediaAssetProvider = (typeof GROWTH_MEDIA_ASSET_PROVIDERS)[number]

export const GROWTH_MEDIA_ASSET_STATUSES = [
  "draft",
  "upload_pending",
  "uploaded",
  "processing",
  "ready",
  "archived",
  "failed",
] as const

export type GrowthMediaAssetStatus = (typeof GROWTH_MEDIA_ASSET_STATUSES)[number]

export const GROWTH_MEDIA_ASSET_SOURCES = ["manual", "upload", "generated", "import", "other"] as const

export type GrowthMediaAssetSource = (typeof GROWTH_MEDIA_ASSET_SOURCES)[number]

export const GROWTH_MEDIA_ASSET_RELATIONSHIP_TYPES = [
  "share_page_template",
  "share_page",
  "campaign",
  "lead",
  "sequence",
  "booking",
  "email_asset",
  "sms_asset",
  "voice_drop",
  "other",
] as const

export type GrowthMediaAssetRelationshipType = (typeof GROWTH_MEDIA_ASSET_RELATIONSHIP_TYPES)[number]

export const DEFAULT_MEDIA_SIGNED_URL_TTL_SECONDS = 3600 as const

export type GrowthMediaAssetUploadSession = {
  sessionId: string
  assetId: string
  provider: GrowthMediaAssetProvider
  storageKey: string
  writeUrl: string | null
  readUrl: string | null
  expiresAt: string
  metadata: Record<string, unknown>
}

export type GrowthMediaAsset = {
  id: string
  organizationId: string
  createdBy: string | null
  assetType: GrowthMediaAssetType
  provider: GrowthMediaAssetProvider
  status: GrowthMediaAssetStatus
  title: string
  description: string
  storageKey: string | null
  originalFilename: string | null
  mimeType: string | null
  extension: string | null
  fileSizeBytes: number | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  thumbnailStorageKey: string | null
  waveformStorageKey: string | null
  metadata: Record<string, unknown>
  tags: string[]
  checksumSha256: string | null
  source: GrowthMediaAssetSource
  sourceReference: string | null
  requiresHumanReview: boolean
  qaMarker: typeof GROWTH_MEDIA_ASSETS_QA_MARKER
  uploadedAt: string | null
  processedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthMediaAssetRelationship = {
  id: string
  organizationId: string
  assetId: string
  relationshipType: GrowthMediaAssetRelationshipType
  relationshipId: string
  metadata: Record<string, unknown>
  createdAt: string
}

export function canArchiveMediaAsset(status: GrowthMediaAssetStatus): boolean {
  return status !== "archived"
}

export function canCreateUploadSession(status: GrowthMediaAssetStatus): boolean {
  return status === "draft" || status === "upload_pending" || status === "failed"
}
