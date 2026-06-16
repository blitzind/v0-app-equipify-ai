import "server-only"

import type { MediaStorageMetadata } from "@/lib/growth/media/media-asset-storage-types"
import type { GrowthMediaAsset } from "@/lib/growth/media/media-asset-types"
import { assertGrowthMediaVideoMimeType } from "@/lib/growth/media/media-video-upload-utils"

export type GrowthMediaVideoMetadataInput = {
  durationSeconds?: number | null
  width?: number | null
  height?: number | null
  providerMetadata?: Record<string, unknown> | null
  storageMetadata?: MediaStorageMetadata | null
}

export type GrowthMediaVideoMetadataResult = {
  mimeType: string
  fileSizeBytes: number | null
  durationSeconds: number | null
  width: number | null
  height: number | null
  providerMetadata: Record<string, unknown>
}

export function extractGrowthMediaVideoMetadata(
  asset: GrowthMediaAsset,
  input: GrowthMediaVideoMetadataInput,
): GrowthMediaVideoMetadataResult {
  const mimeType = assertGrowthMediaVideoMimeType(
    input.storageMetadata?.mimeType ?? asset.mimeType ?? "video/mp4",
  )

  const fileSizeBytes =
    input.storageMetadata?.sizeBytes ?? asset.fileSizeBytes ?? null

  return {
    mimeType,
    fileSizeBytes,
    durationSeconds: input.durationSeconds ?? asset.durationSeconds ?? null,
    width: input.width ?? asset.width ?? null,
    height: input.height ?? asset.height ?? null,
    providerMetadata: {
      ...(typeof asset.metadata.provider === "object" ? (asset.metadata.provider as Record<string, unknown>) : {}),
      ...(input.providerMetadata ?? {}),
      storage_last_modified: input.storageMetadata?.lastModified ?? null,
      extracted_at: new Date().toISOString(),
      no_playback: true,
      no_thumbnail_generation: true,
    },
  }
}
