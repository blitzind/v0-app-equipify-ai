/** Growth Engine S2-C — Video thumbnail types (client-safe). */

export const GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER = "growth-media-video-thumbnail-s2c-v1" as const

export const GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES = ["image/jpeg", "image/png"] as const

export type GrowthMediaVideoThumbnailMimeType = (typeof GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES)[number]

export const DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE: GrowthMediaVideoThumbnailMimeType = "image/jpeg"

export const DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_CAPTURE_SECONDS = 1 as const

export const DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MAX_BYTES = 5_242_880 as const

export const GROWTH_MEDIA_VIDEO_THUMBNAIL_LINK_ROLE = "video_thumbnail" as const

export type GrowthMediaVideoThumbnailSafetyFlags = {
  no_playback: true
  no_video_transcoding: true
  no_ai_generation: true
  no_notifications: true
  no_sequence_execution: true
}

export const GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS: GrowthMediaVideoThumbnailSafetyFlags = {
  no_playback: true,
  no_video_transcoding: true,
  no_ai_generation: true,
  no_notifications: true,
  no_sequence_execution: true,
}

export type GrowthMediaVideoThumbnailSummary = {
  assetId: string
  parentVideoId: string
  storageKey: string | null
  mimeType: string | null
  fileSizeBytes: number | null
  width: number | null
  height: number | null
  checksumSha256: string | null
  captureTimestampSeconds: number
  status: string
  previewUrl?: string | null
}

export type GrowthMediaVideoThumbnailUploadSessionResponse = {
  thumbnailAssetId: string
  parentVideoId: string
  sessionId: string
  storageKey: string
  signedUploadUrl: string | null
  expiresAt: string
  mimeType: GrowthMediaVideoThumbnailMimeType
  maxBytes: number
}
