import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GE_V1_3_ELEVENLABS_LIVE_QA_MARKER } from "@/lib/growth/media/ge-v1-3-types"
import { attachMediaAsset, getMediaAsset } from "@/lib/growth/media/media-asset-repository"
import { GROWTH_MEDIA_ASSETS_BUCKET } from "@/lib/growth/media/media-asset-types"
import { createGrowthVideoPageService } from "@/lib/growth/videos/growth-video-page-service"
import { createGrowthVideoService } from "@/lib/growth/videos/growth-video-service"
import {
  buildGrowthVideoSourceStoragePath,
  inferGrowthVideoExtension,
} from "@/lib/growth/videos/growth-video-validation"
import { GROWTH_VIDEOS_STORAGE_BUCKET } from "@/lib/growth/videos/growth-video-types"
import { recordGeV13GenerationLifecycleEvent } from "@/lib/growth/media/ge-v1-3-generation-analytics"

export type GeV13AttachGeneratedVideoToPageResult = {
  videoPageId: string
  mediaAssetId: string
  videoAssetId: string
  storagePath: string
  replacedExistingVideoAsset: boolean
}

function resolveMediaAssetStorageKey(asset: Awaited<ReturnType<typeof getMediaAsset>>): string {
  if (!asset) throw new Error("media_asset_not_found")
  const metadataPath =
    typeof asset.metadata.storage_path_override === "string" ? asset.metadata.storage_path_override.trim() : ""
  const storageKey = asset.storageKey?.trim() || metadataPath
  if (!storageKey) throw new Error("media_asset_storage_missing")
  return storageKey
}

async function copyMediaAssetBytesToVideoBucket(
  admin: SupabaseClient,
  input: { sourceStorageKey: string; targetStoragePath: string; mimeType: string },
): Promise<void> {
  const download = await admin.storage.from(GROWTH_MEDIA_ASSETS_BUCKET).download(input.sourceStorageKey)
  if (download.error || !download.data) {
    throw new Error(`media_download_failed:${download.error?.message ?? "unknown"}`)
  }

  const bytes = new Uint8Array(await download.data.arrayBuffer())
  const upload = await admin.storage.from(GROWTH_VIDEOS_STORAGE_BUCKET).upload(input.targetStoragePath, bytes, {
    contentType: input.mimeType,
    upsert: true,
  })
  if (upload.error) {
    throw new Error(`video_upload_failed:${upload.error.message}`)
  }
}

export async function attachGeneratedMediaAssetToVideoPage(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string
    videoPageId: string
    mediaAssetId: string
    leadId?: string | null
    mediaGenerationRunId?: string | null
    title?: string | null
  },
): Promise<GeV13AttachGeneratedVideoToPageResult> {
  const mediaAsset = await getMediaAsset(admin, input.mediaAssetId)
  if (!mediaAsset || mediaAsset.organizationId !== input.organizationId) {
    throw new Error("media_asset_not_found")
  }
  if (mediaAsset.status !== "ready") {
    throw new Error("media_asset_not_ready")
  }
  if (mediaAsset.assetType !== "generated_video" && mediaAsset.assetType !== "avatar_video") {
    throw new Error("invalid_media_asset_type")
  }

  const pageService = createGrowthVideoPageService(admin)
  const page = await pageService.getPageById({
    organizationId: input.organizationId,
    pageId: input.videoPageId,
  })
  if (!page) throw new Error("video_page_not_found")

  const sourceStorageKey = resolveMediaAssetStorageKey(mediaAsset)
  const mimeType = mediaAsset.mimeType?.trim() || "video/mp4"
  const extension = inferGrowthVideoExtension(mediaAsset.originalFilename ?? "avatar.mp4", mimeType)

  const videoService = createGrowthVideoService(admin)
  const replacedExistingVideoAsset = Boolean(page.videoAssetId)

  let videoAssetId = page.videoAssetId
  if (!videoAssetId) {
    const created = await videoService.createAsset({
      organizationId: input.organizationId,
      createdBy: input.createdBy,
      title: input.title?.trim() || mediaAsset.title || "Personalized AI video",
      description: "Generated avatar video promoted from media_assets.",
      sourceType: "generated",
      originalFilename: mediaAsset.originalFilename ?? `avatar.${extension}`,
      mimeType,
      fileSizeBytes: mediaAsset.fileSizeBytes,
      storageProvider: "supabase_storage",
      status: "ready",
      uploadStatus: "uploading",
    })
    if (!created.ok) throw new Error(created.error)
    videoAssetId = created.asset.id
  }

  const storagePath = buildGrowthVideoSourceStoragePath({
    organizationId: input.organizationId,
    assetId: videoAssetId,
    extension,
  })

  await copyMediaAssetBytesToVideoBucket(admin, {
    sourceStorageKey,
    targetStoragePath: storagePath,
    mimeType,
  })

  const updatedVideo = await videoService.updateAsset({
    organizationId: input.organizationId,
    assetId: videoAssetId,
    patch: {
      title: input.title?.trim() || mediaAsset.title || undefined,
      mimeType,
      fileSizeBytes: mediaAsset.fileSizeBytes,
      storagePath,
      uploadStatus: "uploaded",
      status: "ready",
      durationSeconds: mediaAsset.durationSeconds,
      processingError: null,
    },
  })
  if (!updatedVideo.ok) throw new Error(updatedVideo.error)

  await pageService.updatePage({
    organizationId: input.organizationId,
    pageId: input.videoPageId,
    patch: {
      videoAssetId,
      metadata: {
        ge_v1_3: {
          qa_marker: GE_V1_3_ELEVENLABS_LIVE_QA_MARKER,
          avatar_media_asset_id: input.mediaAssetId,
          media_generation_run_id: input.mediaGenerationRunId ?? null,
          lead_id: input.leadId ?? null,
          attached_at: new Date().toISOString(),
        },
      },
    },
  })

  await attachMediaAsset(admin, {
    organizationId: input.organizationId,
    assetId: input.mediaAssetId,
    relationshipType: "other",
    relationshipId: input.videoPageId,
    metadata: {
      link_type: "ge_v1_3_page_video",
      video_asset_id: videoAssetId,
      lead_id: input.leadId ?? null,
      media_generation_run_id: input.mediaGenerationRunId ?? null,
    },
  }).catch(() => undefined)

  await recordGeV13GenerationLifecycleEvent(admin, {
    organizationId: input.organizationId,
    eventType: "video_attached",
    videoPageId: input.videoPageId,
    videoAssetId,
    mediaAssetId: input.mediaAssetId,
    leadId: input.leadId ?? null,
    mediaGenerationRunId: input.mediaGenerationRunId ?? null,
    metadata: {
      replaced_existing_video_asset: replacedExistingVideoAsset,
      storage_path: storagePath,
    },
  })

  return {
    videoPageId: input.videoPageId,
    mediaAssetId: input.mediaAssetId,
    videoAssetId,
    storagePath,
    replacedExistingVideoAsset,
  }
}
