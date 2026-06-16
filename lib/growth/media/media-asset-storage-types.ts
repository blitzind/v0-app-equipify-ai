/** Growth Engine S1.5 — media storage provider abstraction (no uploads executed in S1.5). */

import type {
  GrowthMediaAssetProvider,
  GrowthMediaAssetUploadSession,
} from "@/lib/growth/media/media-asset-types"

export type MediaStorageUploadSessionInput = {
  organizationId: string
  assetId: string
  storageKey: string
  mimeType?: string | null
  fileSizeBytes?: number | null
  signedUrlTtlSeconds?: number
}

export type MediaStorageCompleteUploadInput = {
  organizationId: string
  assetId: string
  storageKey: string
  sessionId: string
  checksumSha256?: string | null
  fileSizeBytes?: number | null
}

export type MediaStorageSignedUrlInput = {
  organizationId: string
  assetId: string
  storageKey: string
  signedUrlTtlSeconds?: number
}

export type MediaStorageMetadata = {
  storageKey: string
  sizeBytes: number | null
  mimeType: string | null
  lastModified: string | null
}

export interface MediaStorageProvider {
  readonly id: GrowthMediaAssetProvider
  createUploadSession(input: MediaStorageUploadSessionInput): Promise<GrowthMediaAssetUploadSession>
  completeUpload(input: MediaStorageCompleteUploadInput): Promise<{ storageKey: string; metadata: Record<string, unknown> }>
  generateSignedReadUrl(input: MediaStorageSignedUrlInput): Promise<{ url: string; expiresAt: string }>
  generateSignedWriteUrl(input: MediaStorageSignedUrlInput): Promise<{ url: string; expiresAt: string }>
  deleteAsset(input: { organizationId: string; assetId: string; storageKey: string }): Promise<void>
  getMetadata(input: { organizationId: string; storageKey: string }): Promise<MediaStorageMetadata | null>
}
