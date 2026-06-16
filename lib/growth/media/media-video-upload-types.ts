/** Growth Engine S2-A — MP4 video upload + hosting types (client-safe). */

export const GROWTH_MEDIA_VIDEO_UPLOAD_QA_MARKER = "growth-media-video-upload-s2a-v1" as const

/** Supported S2-A asset kinds — only `video` is persisted in S2-A; `thumbnail_placeholder` is reserved. */
export const GROWTH_MEDIA_VIDEO_UPLOAD_ASSET_TYPES = ["video", "thumbnail_placeholder"] as const

export type GrowthMediaVideoUploadAssetType = (typeof GROWTH_MEDIA_VIDEO_UPLOAD_ASSET_TYPES)[number]

export const GROWTH_MEDIA_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const

export type GrowthMediaVideoMimeType = (typeof GROWTH_MEDIA_VIDEO_MIME_TYPES)[number]

export const DEFAULT_GROWTH_MEDIA_VIDEO_MAX_BYTES = 524_288_000 as const

export const GROWTH_MEDIA_VIDEO_UPLOAD_RELATIONSHIP_TYPES = [
  "share_page_template",
  "share_page",
  "campaign",
  "voice_drop",
  "other",
] as const

export type GrowthMediaVideoUploadRelationshipType =
  (typeof GROWTH_MEDIA_VIDEO_UPLOAD_RELATIONSHIP_TYPES)[number]

export type GrowthMediaVideoUploadSafetyFlags = {
  no_playback: true
  no_ai_generation: true
  no_notifications: true
  no_sequence_execution: true
  no_thumbnail_generation: true
}

export const GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS: GrowthMediaVideoUploadSafetyFlags = {
  no_playback: true,
  no_ai_generation: true,
  no_notifications: true,
  no_sequence_execution: true,
  no_thumbnail_generation: true,
}

export type GrowthMediaVideoUploadSessionResponse = {
  assetId: string
  sessionId: string
  storageKey: string
  signedUploadUrl: string | null
  expiresAt: string
  mimeType: GrowthMediaVideoMimeType
  maxBytes: number
}

export type GrowthMediaVideoAssetSummary = {
  id: string
  status: string
  title: string
  mimeType: string | null
  fileSizeBytes: number | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  checksumSha256: string | null
  uploadedAt: string | null
  originalFilename: string | null
}
