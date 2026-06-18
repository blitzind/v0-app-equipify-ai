import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import { createGrowthVideoStorageService, getGrowthVideoSupabaseStorageProvider } from "@/lib/growth/videos/growth-video-storage-factory"
import {
  GROWTH_VIDEO_ASSETS_QA_MARKER,
  type GrowthVideoSourceType,
} from "@/lib/growth/videos/growth-video-types"
import {
  assertGrowthVideoFileSize,
  assertGrowthVideoMimeType,
  buildGrowthVideoSourceStoragePath,
  buildGrowthVideoThumbnailPlaceholderPath,
  inferGrowthVideoExtension,
  sanitizeGrowthVideoFilename,
} from "@/lib/growth/videos/growth-video-validation"

export type CreateGrowthVideoUploadAssetInput = {
  organizationId: string
  createdBy?: string | null
  title?: string
  description?: string | null
  originalFilename: string
  mimeType: string
  fileSizeBytes: number
  sourceType?: GrowthVideoSourceType
}

export async function createGrowthVideoUploadAsset(
  admin: SupabaseClient,
  input: CreateGrowthVideoUploadAssetInput,
) {
  const videoService = createGrowthVideoService(admin)
  const originalFilename = sanitizeGrowthVideoFilename(input.originalFilename)
  const mimeType = assertGrowthVideoMimeType(input.mimeType)
  const fileSizeBytes = assertGrowthVideoFileSize(input.fileSizeBytes)
  const extension = inferGrowthVideoExtension(originalFilename, mimeType)

  const created = await videoService.createAsset({
    organizationId: input.organizationId,
    createdBy: input.createdBy ?? null,
    title: input.title?.trim() || originalFilename.replace(/\.[^.]+$/, ""),
    description: input.description?.trim() || null,
    sourceType: input.sourceType ?? "upload",
    originalFilename,
    mimeType,
    fileSizeBytes,
    storageProvider: "supabase_storage",
    storagePath: null,
    thumbnailPath: null,
  })
  if (!created.ok) throw new Error(created.error)
  return created.asset
}

export async function createGrowthVideoUploadUrl(
  admin: SupabaseClient,
  input: {
    organizationId: string
    assetId: string
    mimeType?: string
    fileSizeBytes?: number
  },
) {
  const videoService = createGrowthVideoService(admin)
  const assetResult = await videoService.getAssetById({
    organizationId: input.organizationId,
    assetId: input.assetId,
  })
  if (!assetResult.ok) throw new Error(assetResult.error)

  const asset = assetResult.asset
  const mimeType = assertGrowthVideoMimeType(input.mimeType ?? asset.mimeType ?? "video/mp4")
  const extension = inferGrowthVideoExtension(asset.originalFilename ?? "video.mp4", mimeType)
  const storagePath = buildGrowthVideoSourceStoragePath({
    organizationId: input.organizationId,
    assetId: input.assetId,
    extension,
  })

  await videoService.updateAsset({
    organizationId: input.organizationId,
    assetId: input.assetId,
    patch: {
      uploadStatus: "uploading",
      storagePath,
      mimeType,
      fileSizeBytes: input.fileSizeBytes ?? asset.fileSizeBytes,
      processingError: null,
    },
  })

  const storageService = createGrowthVideoStorageService(admin)
  const handle = await storageService.createUploadHandle("supabase_storage", {
    organizationId: input.organizationId,
    assetId: input.assetId,
    contentType: mimeType,
    byteLength: input.fileSizeBytes ?? asset.fileSizeBytes,
    storagePath,
  })

  if (!handle?.uploadUrl) {
    await videoService.updateAsset({
      organizationId: input.organizationId,
      assetId: input.assetId,
      patch: {
        uploadStatus: "failed",
        processingError: handle?.metadata?.error_message_safe ?? "upload_url_unavailable",
        status: "failed",
      },
    })
    throw new Error("upload_url_unavailable")
  }

  return {
    assetId: input.assetId,
    storagePath: handle.storagePath,
    uploadUrl: handle.uploadUrl,
    expiresAt: handle.expiresAt,
    mimeType,
  }
}

export async function completeGrowthVideoUpload(
  admin: SupabaseClient,
  input: {
    organizationId: string
    assetId: string
    fileSizeBytes?: number
    durationSeconds?: number | null
  },
) {
  const videoService = createGrowthVideoService(admin)
  const assetResult = await videoService.getAssetById({
    organizationId: input.organizationId,
    assetId: input.assetId,
  })
  if (!assetResult.ok) throw new Error(assetResult.error)

  const thumbnailPath = buildGrowthVideoThumbnailPlaceholderPath({
    organizationId: input.organizationId,
    assetId: input.assetId,
  })

  const updated = await videoService.updateAsset({
    organizationId: input.organizationId,
    assetId: input.assetId,
    patch: {
      uploadStatus: "uploaded",
      status: "ready",
      fileSizeBytes: input.fileSizeBytes ?? assetResult.asset.fileSizeBytes,
      durationSeconds: input.durationSeconds ?? assetResult.asset.durationSeconds,
      thumbnailPath,
      processingError: null,
    },
  })

  if (!updated.ok) throw new Error(updated.error)

  const storageService = createGrowthVideoStorageService(admin)
  const playback =
    updated.asset.storagePath
      ? await storageService.resolveObjectRef("supabase_storage", updated.asset.storagePath)
      : null

  return {
    asset: updated.asset,
    playbackUrl: playback?.signedUrl ?? null,
    playbackExpiresAt: (playback?.metadata?.expires_at as string | undefined) ?? null,
  }
}

export async function probeGrowthVideoStorageBucket(admin: SupabaseClient) {
  return getGrowthVideoSupabaseStorageProvider(admin).probeBucket()
}

export function growthVideoUploadSafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_ASSETS_QA_MARKER,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}
