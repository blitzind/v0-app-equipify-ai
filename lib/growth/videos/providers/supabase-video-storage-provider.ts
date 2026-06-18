import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_VIDEOS_STORAGE_BUCKET,
  type GrowthVideoStorageProvider,
} from "@/lib/growth/videos/growth-video-types"
import type {
  GrowthVideoStorageObjectRef,
  GrowthVideoStorageProviderAdapter,
  GrowthVideoStorageProviderCapabilities,
  GrowthVideoStorageUploadHandle,
  GrowthVideoStorageUploadRequest,
} from "@/lib/growth/videos/growth-video-storage-service"

export const GROWTH_SUPABASE_VIDEO_STORAGE_QA_MARKER = "growth-supabase-video-storage-a2-v1" as const

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600

function expiresAtFromTtl(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString()
}

export class SupabaseGrowthVideoStorageProvider implements GrowthVideoStorageProviderAdapter {
  readonly provider: GrowthVideoStorageProvider = "supabase_storage"
  readonly capabilities: GrowthVideoStorageProviderCapabilities = {
    provider: "supabase_storage",
    supportsDirectUpload: true,
    supportsSignedUrls: true,
    supportsThumbnails: true,
  }

  constructor(
    private readonly admin: SupabaseClient,
    private readonly bucket = GROWTH_VIDEOS_STORAGE_BUCKET,
  ) {}

  async createUploadHandle(request: GrowthVideoStorageUploadRequest): Promise<GrowthVideoStorageUploadHandle> {
    const storagePath =
      request.storagePath ??
      `organizations/${request.organizationId}/videos/${request.assetId}/source.mp4`

    const { data, error } = await this.admin.storage.from(this.bucket).createSignedUploadUrl(storagePath)

    if (error) {
      return {
        provider: this.provider,
        storagePath,
        uploadUrl: null,
        expiresAt: expiresAtFromTtl(DEFAULT_SIGNED_URL_TTL_SECONDS),
        metadata: {
          bucket_missing: error.message.toLowerCase().includes("bucket") || error.message.includes("not found"),
          error_code: "signed_upload_failed",
          error_message_safe: error.message,
        },
      }
    }

    return {
      provider: this.provider,
      storagePath,
      uploadUrl: data.signedUrl,
      expiresAt: expiresAtFromTtl(DEFAULT_SIGNED_URL_TTL_SECONDS),
      metadata: {
        bucket: this.bucket,
        path: storagePath,
        token_present: Boolean(data.token),
      },
    }
  }

  async resolveObjectRef(storagePath: string): Promise<GrowthVideoStorageObjectRef> {
    const { data, error } = await this.admin.storage
      .from(this.bucket)
      .createSignedUrl(storagePath, DEFAULT_SIGNED_URL_TTL_SECONDS)

    if (error) {
      return {
        provider: this.provider,
        storagePath,
        publicUrl: null,
        signedUrl: null,
        metadata: {
          error_code: "signed_read_failed",
          error_message_safe: error.message,
        },
      }
    }

    return {
      provider: this.provider,
      storagePath,
      publicUrl: null,
      signedUrl: data.signedUrl,
      metadata: {
        bucket: this.bucket,
        expires_at: expiresAtFromTtl(DEFAULT_SIGNED_URL_TTL_SECONDS),
      },
    }
  }

  async deleteObject(storagePath: string): Promise<void> {
    const { error } = await this.admin.storage.from(this.bucket).remove([storagePath])
    if (error) throw new Error(`storage_delete_failed:${error.message}`)
  }

  async probeBucket(): Promise<{ ok: boolean; error: string | null }> {
    const probePath = `organizations/__probe__/videos/__probe__/source.mp4`
    const { error } = await this.admin.storage.from(this.bucket).createSignedUploadUrl(probePath)
    if (!error) return { ok: true, error: null }
    return { ok: false, error: error.message }
  }
}

export function createSupabaseGrowthVideoStorageProvider(admin: SupabaseClient): SupabaseGrowthVideoStorageProvider {
  return new SupabaseGrowthVideoStorageProvider(admin)
}
