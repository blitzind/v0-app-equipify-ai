import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  attachMediaAsset,
  completeUploadSession,
  createMediaAsset,
  createUploadSession,
  getMediaAsset,
} from "@/lib/growth/media/media-asset-repository"
import { resolveMediaStorageProvider } from "@/lib/growth/media/media-asset-storage-providers"
import type { GrowthMediaAsset } from "@/lib/growth/media/media-asset-types"
import { extractGrowthMediaVideoMetadata } from "@/lib/growth/media/media-video-metadata"
import {
  DEFAULT_GROWTH_MEDIA_VIDEO_MAX_BYTES,
  GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
  type GrowthMediaVideoUploadRelationshipType,
} from "@/lib/growth/media/media-video-upload-types"
import {
  assertGrowthMediaVideoChecksum,
  assertGrowthMediaVideoFileSize,
  assertGrowthMediaVideoMimeType,
  inferVideoExtension,
  isUploadSessionExpired,
  sanitizeMediaVideoFilename,
} from "@/lib/growth/media/media-video-upload-utils"
import type { GrowthMediaAssetUploadSession } from "@/lib/growth/media/media-asset-types"

function assertVideoAsset(asset: GrowthMediaAsset): void {
  if (asset.assetType !== "video") throw new Error("invalid_asset_type")
}

function readUploadSession(asset: GrowthMediaAsset): GrowthMediaAssetUploadSession {
  const sessionRaw = asset.metadata.upload_session
  if (!sessionRaw || typeof sessionRaw !== "object") throw new Error("upload_session_not_found")
  return sessionRaw as GrowthMediaAssetUploadSession
}

export type CreateGrowthMediaVideoAssetInput = {
  organizationId: string
  createdBy?: string | null
  title?: string
  description?: string
  originalFilename: string
  mimeType?: string
  fileSizeBytes?: number | null
  provider?: "local_stub" | "supabase_storage"
  tags?: string[]
}

export type CreateGrowthMediaVideoUploadSessionInput = {
  organizationId: string
  assetId: string
  mimeType?: string
  fileSizeBytes?: number | null
  signedUrlTtlSeconds?: number
}

export type CompleteGrowthMediaVideoUploadInput = {
  organizationId: string
  assetId: string
  checksumSha256: string
  fileSizeBytes: number
  durationSeconds?: number | null
  width?: number | null
  height?: number | null
}

export type AttachGrowthMediaVideoAssetInput = {
  organizationId: string
  assetId: string
  relationshipType: GrowthMediaVideoUploadRelationshipType
  relationshipId: string
  metadata?: Record<string, unknown>
}

export async function createGrowthMediaVideoAsset(
  admin: SupabaseClient,
  input: CreateGrowthMediaVideoAssetInput,
): Promise<GrowthMediaAsset> {
  const originalFilename = sanitizeMediaVideoFilename(input.originalFilename)
  const mimeType = assertGrowthMediaVideoMimeType(input.mimeType ?? "video/mp4")
  const fileSizeBytes =
    input.fileSizeBytes == null ? null : assertGrowthMediaVideoFileSize(input.fileSizeBytes)
  const extension = inferVideoExtension(originalFilename, mimeType)

  return createMediaAsset(admin, {
    organizationId: input.organizationId,
    createdBy: input.createdBy ?? null,
    assetType: "video",
    provider: input.provider ?? "supabase_storage",
    title: input.title?.trim() || originalFilename.replace(/\.mp4$/i, ""),
    description: input.description?.trim() || "",
    originalFilename,
    mimeType,
    extension,
    source: "upload",
    tags: input.tags ?? [],
    metadata: {
      video_upload: {
        mime_type: mimeType,
        max_bytes: fileSizeBytes ?? DEFAULT_GROWTH_MEDIA_VIDEO_MAX_BYTES,
        original_filename: originalFilename,
      },
      ...GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
    },
  })
}

export async function createGrowthMediaVideoUploadSession(
  admin: SupabaseClient,
  input: CreateGrowthMediaVideoUploadSessionInput,
): Promise<{ asset: GrowthMediaAsset; session: GrowthMediaAssetUploadSession }> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  assertVideoAsset(asset)

  if (asset.status === "ready") throw new Error("duplicate_upload")
  if (asset.status === "upload_pending") {
    const existing = readUploadSession(asset)
    if (!isUploadSessionExpired(existing.expiresAt)) {
      throw new Error("duplicate_upload_session")
    }
  }

  const mimeType = assertGrowthMediaVideoMimeType(input.mimeType ?? asset.mimeType ?? "video/mp4")
  const fileSizeBytes = assertGrowthMediaVideoFileSize(input.fileSizeBytes ?? asset.fileSizeBytes ?? 1)

  const result = await createUploadSession(admin, {
    organizationId: input.organizationId,
    assetId: asset.id,
    mimeType,
    extension: asset.extension ?? "mp4",
    fileSizeBytes,
    signedUrlTtlSeconds: input.signedUrlTtlSeconds,
  })

  const metadata = {
    ...result.asset.metadata,
    video_upload: {
      ...(typeof result.asset.metadata.video_upload === "object"
        ? (result.asset.metadata.video_upload as Record<string, unknown>)
        : {}),
      mime_type: mimeType,
      max_bytes: fileSizeBytes,
      signed_upload_url: result.session.writeUrl,
      signed_upload_expires_at: result.session.expiresAt,
    },
    ...GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
  }

  const { data, error } = await admin
    .schema("growth")
    .from("media_assets")
    .update({ metadata_json: metadata })
    .eq("id", result.asset.id)
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "upload_session_failed")
  return {
    asset: {
      ...result.asset,
      metadata,
    },
    session: result.session,
  }
}

export async function completeGrowthMediaVideoUpload(
  admin: SupabaseClient,
  input: CompleteGrowthMediaVideoUploadInput,
): Promise<GrowthMediaAsset> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  if (asset.organizationId !== input.organizationId) throw new Error("organization_scope_mismatch")
  assertVideoAsset(asset)
  if (asset.status === "ready") throw new Error("duplicate_upload")

  const checksum = assertGrowthMediaVideoChecksum(input.checksumSha256)
  const fileSizeBytes = assertGrowthMediaVideoFileSize(input.fileSizeBytes)
  const session = readUploadSession(asset)
  if (isUploadSessionExpired(session.expiresAt)) throw new Error("upload_session_expired")

  const provider = resolveMediaStorageProvider(asset.provider, admin)
  const storageKey = asset.storageKey ?? session.storageKey
  const storageMetadata = await provider.getMetadata({ organizationId: input.organizationId, storageKey })

  if (asset.provider === "supabase_storage" && !storageMetadata) {
    throw new Error("upload_object_missing")
  }

  if (storageMetadata?.mimeType) {
    assertGrowthMediaVideoMimeType(storageMetadata.mimeType)
  }
  if (storageMetadata?.sizeBytes != null) {
    assertGrowthMediaVideoFileSize(storageMetadata.sizeBytes)
  }

  const extracted = extractGrowthMediaVideoMetadata(asset, {
    durationSeconds: input.durationSeconds,
    width: input.width,
    height: input.height,
    storageMetadata,
    providerMetadata: {
      storage_provider: asset.provider,
      upload_session_id: session.sessionId,
    },
  })

  const completed = await completeUploadSession(admin, {
    organizationId: input.organizationId,
    assetId: asset.id,
    checksumSha256: checksum,
    fileSizeBytes,
  })

  const metadata = {
    ...completed.metadata,
    provider: extracted.providerMetadata,
    video_upload: {
      ...(typeof completed.metadata.video_upload === "object"
        ? (completed.metadata.video_upload as Record<string, unknown>)
        : {}),
      completed_at: new Date().toISOString(),
      checksum_sha256: checksum,
    },
    ...GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
  }

  const { data, error } = await admin
    .schema("growth")
    .from("media_assets")
    .update({
      mime_type: extracted.mimeType,
      file_size_bytes: extracted.fileSizeBytes ?? fileSizeBytes,
      duration_seconds: extracted.durationSeconds,
      width: extracted.width,
      height: extracted.height,
      checksum_sha256: checksum,
      metadata_json: metadata,
    })
    .eq("id", completed.id)
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "upload_complete_failed")
  return {
    ...completed,
    mimeType: extracted.mimeType,
    fileSizeBytes: extracted.fileSizeBytes ?? fileSizeBytes,
    durationSeconds: extracted.durationSeconds,
    width: extracted.width,
    height: extracted.height,
    checksumSha256: checksum,
    metadata,
  }
}

export async function attachGrowthMediaVideoAsset(
  admin: SupabaseClient,
  input: AttachGrowthMediaVideoAssetInput,
): Promise<GrowthMediaAsset> {
  const asset = await getMediaAsset(admin, input.assetId)
  if (!asset) throw new Error("asset_not_found")
  assertVideoAsset(asset)
  if (asset.status !== "ready") throw new Error("invalid_status")

  await attachMediaAsset(admin, {
    organizationId: input.organizationId,
    assetId: input.assetId,
    relationshipType: input.relationshipType,
    relationshipId: input.relationshipId,
    metadata: {
      ...(input.metadata ?? {}),
      ...GROWTH_MEDIA_VIDEO_UPLOAD_SAFETY_FLAGS,
    },
  })

  return asset
}

export function toGrowthMediaVideoAssetSummary(asset: GrowthMediaAsset) {
  return {
    id: asset.id,
    status: asset.status,
    title: asset.title,
    mimeType: asset.mimeType,
    fileSizeBytes: asset.fileSizeBytes,
    durationSeconds: asset.durationSeconds,
    width: asset.width,
    height: asset.height,
    checksumSha256: asset.checksumSha256,
    uploadedAt: asset.uploadedAt,
    originalFilename: asset.originalFilename,
  }
}
