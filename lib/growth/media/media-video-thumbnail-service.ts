import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  archiveMediaAsset,
  attachMediaAsset,
  completeUploadSession,
  createMediaAsset,
  createUploadSession,
  detachMediaAsset,
  generateMediaAssetSignedReadUrl,
  getMediaAsset,
  listRelationships,
  updateMediaAsset,
} from "@/lib/growth/media/media-asset-repository"
import type { GrowthMediaAsset } from "@/lib/growth/media/media-asset-types"
import {
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_CAPTURE_SECONDS,
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MAX_BYTES,
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
  GROWTH_MEDIA_VIDEO_THUMBNAIL_LINK_ROLE,
  GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER,
  GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
  type GrowthMediaVideoThumbnailSummary,
  type GrowthMediaVideoThumbnailUploadSessionResponse,
} from "@/lib/growth/media/media-video-thumbnail-types"
import {
  assertGrowthMediaVideoThumbnailChecksum,
  assertGrowthMediaVideoThumbnailFileSize,
  assertGrowthMediaVideoThumbnailMimeType,
  buildThumbnailFilename,
  inferThumbnailExtension,
} from "@/lib/growth/media/media-video-thumbnail-utils"

type VideoThumbnailMetadata = {
  asset_id?: string
  capture_timestamp_seconds?: number
  mime_type?: string
  status?: string
}

function readVideoThumbnailMetadata(asset: GrowthMediaAsset): VideoThumbnailMetadata {
  const raw = asset.metadata.video_thumbnail
  if (!raw || typeof raw !== "object") return {}
  return raw as VideoThumbnailMetadata
}

function assertReadyVideoAsset(asset: GrowthMediaAsset, organizationId: string): void {
  if (asset.organizationId !== organizationId) throw new Error("organization_scope_mismatch")
  if (asset.assetType !== "video") throw new Error("invalid_asset_type")
  if (asset.status !== "ready") throw new Error("invalid_status")
}

async function findLinkedThumbnailAsset(
  admin: SupabaseClient,
  organizationId: string,
  videoAssetId: string,
): Promise<GrowthMediaAsset | null> {
  const video = await getMediaAsset(admin, videoAssetId)
  const linkedId = readVideoThumbnailMetadata(video ?? ({} as GrowthMediaAsset)).asset_id
  if (linkedId) {
    const linked = await getMediaAsset(admin, linkedId)
    if (linked && linked.organizationId === organizationId && linked.status !== "archived") {
      return linked
    }
  }

  const relationships = await listRelationships(admin, {
    organizationId,
    relationshipType: "other",
    relationshipId: videoAssetId,
  })

  for (const relationship of relationships) {
    if (relationship.metadata.link_role !== GROWTH_MEDIA_VIDEO_THUMBNAIL_LINK_ROLE) continue
    const candidate = await getMediaAsset(admin, relationship.assetId)
    if (candidate && candidate.status !== "archived") return candidate
  }

  return null
}

export function toGrowthMediaVideoThumbnailSummary(
  video: GrowthMediaAsset,
  thumbnail: GrowthMediaAsset | null,
  previewUrl?: string | null,
): GrowthMediaVideoThumbnailSummary | null {
  if (!thumbnail && !video.thumbnailStorageKey) return null

  const meta = readVideoThumbnailMetadata(video)
  return {
    assetId: thumbnail?.id ?? meta.asset_id ?? "",
    parentVideoId: video.id,
    storageKey: video.thumbnailStorageKey ?? thumbnail?.storageKey ?? null,
    mimeType: thumbnail?.mimeType ?? meta.mime_type ?? null,
    fileSizeBytes: thumbnail?.fileSizeBytes ?? null,
    width: thumbnail?.width ?? null,
    height: thumbnail?.height ?? null,
    checksumSha256: thumbnail?.checksumSha256 ?? null,
    captureTimestampSeconds: meta.capture_timestamp_seconds ?? DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_CAPTURE_SECONDS,
    status: thumbnail?.status ?? meta.status ?? "missing",
    previewUrl: previewUrl ?? null,
  }
}

export async function getGrowthMediaVideoThumbnail(
  admin: SupabaseClient,
  input: { organizationId: string; videoAssetId: string; includePreviewUrl?: boolean },
): Promise<{ video: GrowthMediaAsset; thumbnail: GrowthMediaVideoThumbnailSummary | null }> {
  const video = await getMediaAsset(admin, input.videoAssetId)
  if (!video) throw new Error("asset_not_found")
  assertReadyVideoAsset(video, input.organizationId)

  const thumbnailAsset = await findLinkedThumbnailAsset(admin, input.organizationId, video.id)
  let previewUrl: string | null = null
  if (input.includePreviewUrl && thumbnailAsset?.storageKey) {
    const signed = await generateMediaAssetSignedReadUrl(admin, {
      organizationId: input.organizationId,
      assetId: thumbnailAsset.id,
    })
    previewUrl = signed.url
  }

  return {
    video,
    thumbnail: toGrowthMediaVideoThumbnailSummary(video, thumbnailAsset, previewUrl),
  }
}

export type CreateGrowthMediaVideoThumbnailSessionInput = {
  organizationId: string
  videoAssetId: string
  createdBy?: string | null
  mimeType?: string
  fileSizeBytes: number
  captureTimestampSeconds?: number
  provider?: "local_stub" | "supabase_storage"
  replaceExisting?: boolean
}

export async function createGrowthMediaVideoThumbnailUploadSession(
  admin: SupabaseClient,
  input: CreateGrowthMediaVideoThumbnailSessionInput,
): Promise<{
  video: GrowthMediaAsset
  thumbnailAsset: GrowthMediaAsset
  session: GrowthMediaVideoThumbnailUploadSessionResponse
}> {
  const video = await getMediaAsset(admin, input.videoAssetId)
  if (!video) throw new Error("asset_not_found")
  assertReadyVideoAsset(video, input.organizationId)

  if (input.replaceExisting) {
    await removeGrowthMediaVideoThumbnail(admin, {
      organizationId: input.organizationId,
      videoAssetId: video.id,
    })
  } else {
    const existing = await findLinkedThumbnailAsset(admin, input.organizationId, video.id)
    if (existing && video.thumbnailStorageKey) throw new Error("duplicate_thumbnail")
  }

  const mimeType = assertGrowthMediaVideoThumbnailMimeType(input.mimeType ?? DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE)
  const fileSizeBytes = assertGrowthMediaVideoThumbnailFileSize(input.fileSizeBytes)
  const captureTimestampSeconds = input.captureTimestampSeconds ?? DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_CAPTURE_SECONDS

  const thumbnailAsset = await createMediaAsset(admin, {
    organizationId: input.organizationId,
    createdBy: input.createdBy ?? null,
    assetType: "thumbnail",
    provider: input.provider ?? "supabase_storage",
    title: `${video.title || "Video"} thumbnail`,
    description: `Thumbnail for video ${video.id}`,
    originalFilename: buildThumbnailFilename(video.id, mimeType),
    mimeType,
    extension: inferThumbnailExtension(mimeType),
    source: "generated",
    sourceReference: video.id,
    tags: [GROWTH_MEDIA_VIDEO_THUMBNAIL_QA_MARKER],
    metadata: {
      parent_video_id: video.id,
      capture_timestamp_seconds: captureTimestampSeconds,
      ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
    },
  })

  await attachMediaAsset(admin, {
    organizationId: input.organizationId,
    assetId: thumbnailAsset.id,
    relationshipType: "other",
    relationshipId: video.id,
    metadata: {
      link_role: GROWTH_MEDIA_VIDEO_THUMBNAIL_LINK_ROLE,
      parent_video_id: video.id,
      ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
    },
  })

  const upload = await createUploadSession(admin, {
    organizationId: input.organizationId,
    assetId: thumbnailAsset.id,
    mimeType,
    extension: inferThumbnailExtension(mimeType),
    fileSizeBytes,
  })

  const videoMetadata = {
    ...video.metadata,
    video_thumbnail: {
      asset_id: thumbnailAsset.id,
      capture_timestamp_seconds: captureTimestampSeconds,
      mime_type: mimeType,
      status: "upload_pending",
      ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
    },
  }

  const updatedVideo = await updateMediaAsset(admin, video.id, { metadata: videoMetadata })

  return {
    video: updatedVideo,
    thumbnailAsset: upload.asset,
    session: {
      thumbnailAssetId: thumbnailAsset.id,
      parentVideoId: video.id,
      sessionId: upload.session.sessionId,
      storageKey: upload.session.storageKey,
      signedUploadUrl: upload.session.writeUrl,
      expiresAt: upload.session.expiresAt,
      mimeType,
      maxBytes: DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MAX_BYTES,
    },
  }
}

export type CompleteGrowthMediaVideoThumbnailUploadInput = {
  organizationId: string
  videoAssetId: string
  thumbnailAssetId: string
  checksumSha256: string
  fileSizeBytes: number
  width?: number | null
  height?: number | null
}

export async function completeGrowthMediaVideoThumbnailUpload(
  admin: SupabaseClient,
  input: CompleteGrowthMediaVideoThumbnailUploadInput,
): Promise<{ video: GrowthMediaAsset; thumbnail: GrowthMediaAsset }> {
  const video = await getMediaAsset(admin, input.videoAssetId)
  if (!video) throw new Error("asset_not_found")
  assertReadyVideoAsset(video, input.organizationId)

  const thumbnail = await getMediaAsset(admin, input.thumbnailAssetId)
  if (!thumbnail) throw new Error("thumbnail_not_found")
  if (thumbnail.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  if (thumbnail.assetType !== "thumbnail") throw new Error("invalid_asset_type")

  const checksum = assertGrowthMediaVideoThumbnailChecksum(input.checksumSha256)
  const fileSizeBytes = assertGrowthMediaVideoThumbnailFileSize(input.fileSizeBytes)

  const completed = await completeUploadSession(admin, {
    organizationId: input.organizationId,
    assetId: thumbnail.id,
    checksumSha256: checksum,
    fileSizeBytes,
  })

  const patchedThumbnail = await updateMediaAsset(admin, completed.id, {
    width: input.width ?? null,
    height: input.height ?? null,
    metadata: {
      ...completed.metadata,
      parent_video_id: video.id,
      completed_at: new Date().toISOString(),
      ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
    },
  })

  const videoMetadata = {
    ...video.metadata,
    video_thumbnail: {
      ...(readVideoThumbnailMetadata(video) as Record<string, unknown>),
      asset_id: patchedThumbnail.id,
      mime_type: patchedThumbnail.mimeType,
      status: "ready",
      ...GROWTH_MEDIA_VIDEO_THUMBNAIL_SAFETY_FLAGS,
    },
  }

  const updatedVideo = await updateMediaAsset(admin, video.id, {
    thumbnailStorageKey: patchedThumbnail.storageKey,
    metadata: videoMetadata,
  })

  return { video: updatedVideo, thumbnail: patchedThumbnail }
}

export async function removeGrowthMediaVideoThumbnail(
  admin: SupabaseClient,
  input: { organizationId: string; videoAssetId: string },
): Promise<GrowthMediaAsset> {
  const video = await getMediaAsset(admin, input.videoAssetId)
  if (!video) throw new Error("asset_not_found")
  if (video.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  if (video.assetType !== "video") throw new Error("invalid_asset_type")

  const thumbnail = await findLinkedThumbnailAsset(admin, input.organizationId, video.id)
  if (thumbnail) {
    await detachMediaAsset(admin, {
      organizationId: input.organizationId,
      assetId: thumbnail.id,
      relationshipType: "other",
      relationshipId: video.id,
    })
    if (thumbnail.status !== "archived") {
      await archiveMediaAsset(admin, thumbnail.id)
    }
  }

  const metadata = { ...video.metadata }
  delete metadata.video_thumbnail

  return updateMediaAsset(admin, video.id, {
    thumbnailStorageKey: null,
    metadata,
  })
}
