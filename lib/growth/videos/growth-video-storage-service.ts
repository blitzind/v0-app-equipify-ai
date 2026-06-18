/** Growth Engine A1 — Video storage abstraction (client-safe interfaces only). */

import type { GrowthVideoStorageProvider } from "@/lib/growth/videos/growth-video-types"

export const GROWTH_VIDEO_STORAGE_QA_MARKER = "growth-video-storage-a1-v1" as const

export type GrowthVideoStorageUploadRequest = {
  organizationId: string
  assetId: string
  contentType: string
  byteLength: number | null
  checksumSha256?: string | null
  storagePath?: string
}

export type GrowthVideoStorageUploadHandle = {
  provider: GrowthVideoStorageProvider
  storagePath: string
  uploadUrl: string | null
  expiresAt: string | null
  metadata?: Record<string, unknown>
}

export type GrowthVideoStorageObjectRef = {
  provider: GrowthVideoStorageProvider
  storagePath: string
  publicUrl: string | null
  signedUrl: string | null
  metadata?: Record<string, unknown>
}

export type GrowthVideoStorageProviderCapabilities = {
  provider: GrowthVideoStorageProvider
  supportsDirectUpload: boolean
  supportsSignedUrls: boolean
  supportsThumbnails: boolean
}

/**
 * Provider-agnostic storage boundary — implementations live in future phases.
 */
export interface GrowthVideoStorageProviderAdapter {
  readonly provider: GrowthVideoStorageProvider
  readonly capabilities: GrowthVideoStorageProviderCapabilities

  createUploadHandle(
    request: GrowthVideoStorageUploadRequest & { storagePath?: string },
  ): Promise<GrowthVideoStorageUploadHandle>
  resolveObjectRef(storagePath: string): Promise<GrowthVideoStorageObjectRef>
  deleteObject(storagePath: string): Promise<void>
}

export type GrowthVideoStorageServiceDeps = {
  resolveAdapter(provider: GrowthVideoStorageProvider): GrowthVideoStorageProviderAdapter | null
}

export class GrowthVideoStorageService {
  constructor(private readonly deps: GrowthVideoStorageServiceDeps) {}

  async createUploadHandle(
    provider: GrowthVideoStorageProvider,
    request: GrowthVideoStorageUploadRequest,
  ): Promise<GrowthVideoStorageUploadHandle | null> {
    const adapter = this.deps.resolveAdapter(provider)
    if (!adapter) return null
    return adapter.createUploadHandle(request)
  }

  async resolveObjectRef(
    provider: GrowthVideoStorageProvider,
    storagePath: string,
  ): Promise<GrowthVideoStorageObjectRef | null> {
    const adapter = this.deps.resolveAdapter(provider)
    if (!adapter) return null
    return adapter.resolveObjectRef(storagePath)
  }

  async deleteObject(
    provider: GrowthVideoStorageProvider,
    storagePath: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const adapter = this.deps.resolveAdapter(provider)
    if (!adapter) return { ok: false, error: "provider_not_configured" }
    try {
      await adapter.deleteObject(storagePath)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "delete_failed" }
    }
  }
}
