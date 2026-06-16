import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  DEFAULT_MEDIA_SIGNED_URL_TTL_SECONDS,
  GROWTH_MEDIA_ASSETS_BUCKET,
  type GrowthMediaAssetProvider,
  type GrowthMediaAssetUploadSession,
} from "@/lib/growth/media/media-asset-types"
import type {
  MediaStorageCompleteUploadInput,
  MediaStorageMetadata,
  MediaStorageProvider,
  MediaStorageSignedUrlInput,
  MediaStorageUploadSessionInput,
} from "@/lib/growth/media/media-asset-storage-types"

function expiresAtFromTtl(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString()
}

function buildStorageKey(input: { organizationId: string; assetId: string; extension?: string | null }): string {
  const suffix = input.extension?.replace(/^\./, "") ? `.${input.extension.replace(/^\./, "")}` : ""
  return `${input.organizationId}/${input.assetId}/original${suffix}`
}

export class LocalStubMediaStorageProvider implements MediaStorageProvider {
  readonly id: GrowthMediaAssetProvider = "local_stub"

  async createUploadSession(input: MediaStorageUploadSessionInput): Promise<GrowthMediaAssetUploadSession> {
    const sessionId = randomUUID()
    const ttl = input.signedUrlTtlSeconds ?? DEFAULT_MEDIA_SIGNED_URL_TTL_SECONDS
    const storageKey = input.storageKey || buildStorageKey({ organizationId: input.organizationId, assetId: input.assetId })
    return {
      sessionId,
      assetId: input.assetId,
      provider: this.id,
      storageKey,
      writeUrl: `stub://upload/${storageKey}?session=${sessionId}`,
      readUrl: null,
      expiresAt: expiresAtFromTtl(ttl),
      metadata: {
        stub: true,
        no_upload_executed: true,
      },
    }
  }

  async completeUpload(input: MediaStorageCompleteUploadInput): Promise<{ storageKey: string; metadata: Record<string, unknown> }> {
    return {
      storageKey: input.storageKey,
      metadata: {
        stub: true,
        no_upload_executed: true,
        session_id: input.sessionId,
        completed_at: new Date().toISOString(),
        checksum_sha256: input.checksumSha256 ?? null,
        file_size_bytes: input.fileSizeBytes ?? null,
      },
    }
  }

  async generateSignedReadUrl(input: MediaStorageSignedUrlInput): Promise<{ url: string; expiresAt: string }> {
    const ttl = input.signedUrlTtlSeconds ?? DEFAULT_MEDIA_SIGNED_URL_TTL_SECONDS
    return {
      url: `stub://read/${input.storageKey}?asset=${input.assetId}`,
      expiresAt: expiresAtFromTtl(ttl),
    }
  }

  async generateSignedWriteUrl(input: MediaStorageSignedUrlInput): Promise<{ url: string; expiresAt: string }> {
    const ttl = input.signedUrlTtlSeconds ?? DEFAULT_MEDIA_SIGNED_URL_TTL_SECONDS
    return {
      url: `stub://write/${input.storageKey}?asset=${input.assetId}`,
      expiresAt: expiresAtFromTtl(ttl),
    }
  }

  async deleteAsset(): Promise<void> {
    return
  }

  async getMetadata(input: { storageKey: string }): Promise<MediaStorageMetadata | null> {
    return {
      storageKey: input.storageKey,
      sizeBytes: null,
      mimeType: null,
      lastModified: null,
    }
  }
}

export class SupabaseMediaStorageProvider implements MediaStorageProvider {
  readonly id: GrowthMediaAssetProvider = "supabase_storage"

  constructor(private readonly admin: SupabaseClient) {}

  async createUploadSession(input: MediaStorageUploadSessionInput): Promise<GrowthMediaAssetUploadSession> {
    const sessionId = randomUUID()
    const ttl = input.signedUrlTtlSeconds ?? DEFAULT_MEDIA_SIGNED_URL_TTL_SECONDS
    const storageKey = input.storageKey || buildStorageKey({ organizationId: input.organizationId, assetId: input.assetId })
    const expiresAt = expiresAtFromTtl(ttl)

    const { data, error } = await this.admin.storage.from(GROWTH_MEDIA_ASSETS_BUCKET).createSignedUploadUrl(storageKey)
    if (error) {
      return {
        sessionId,
        assetId: input.assetId,
        provider: this.id,
        storageKey,
        writeUrl: null,
        readUrl: null,
        expiresAt,
        metadata: {
          signed_upload_error: error.message,
          no_upload_executed: true,
        },
      }
    }

    return {
      sessionId,
      assetId: input.assetId,
      provider: this.id,
      storageKey,
      writeUrl: data.signedUrl,
      readUrl: null,
      expiresAt,
      metadata: {
        token: data.token,
        path: data.path,
        no_upload_executed: true,
      },
    }
  }

  async completeUpload(input: MediaStorageCompleteUploadInput): Promise<{ storageKey: string; metadata: Record<string, unknown> }> {
    const listed = await this.admin.storage.from(GROWTH_MEDIA_ASSETS_BUCKET).list(input.storageKey.split("/").slice(0, -1).join("/"))
    return {
      storageKey: input.storageKey,
      metadata: {
        provider: this.id,
        no_upload_executed: true,
        session_id: input.sessionId,
        listed_objects: listed.data?.length ?? 0,
        checksum_sha256: input.checksumSha256 ?? null,
        file_size_bytes: input.fileSizeBytes ?? null,
        completed_at: new Date().toISOString(),
      },
    }
  }

  async generateSignedReadUrl(input: MediaStorageSignedUrlInput): Promise<{ url: string; expiresAt: string }> {
    const ttl = input.signedUrlTtlSeconds ?? DEFAULT_MEDIA_SIGNED_URL_TTL_SECONDS
    const { data, error } = await this.admin.storage
      .from(GROWTH_MEDIA_ASSETS_BUCKET)
      .createSignedUrl(input.storageKey, ttl)
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "signed_read_url_failed")
    }
    return { url: data.signedUrl, expiresAt: expiresAtFromTtl(ttl) }
  }

  async generateSignedWriteUrl(input: MediaStorageSignedUrlInput): Promise<{ url: string; expiresAt: string }> {
    const ttl = input.signedUrlTtlSeconds ?? DEFAULT_MEDIA_SIGNED_URL_TTL_SECONDS
    const { data, error } = await this.admin.storage.from(GROWTH_MEDIA_ASSETS_BUCKET).createSignedUploadUrl(input.storageKey)
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "signed_write_url_failed")
    }
    return { url: data.signedUrl, expiresAt: expiresAtFromTtl(ttl) }
  }

  async deleteAsset(input: { storageKey: string }): Promise<void> {
    const { error } = await this.admin.storage.from(GROWTH_MEDIA_ASSETS_BUCKET).remove([input.storageKey])
    if (error) throw new Error(error.message)
  }

  async getMetadata(input: { storageKey: string }): Promise<MediaStorageMetadata | null> {
    const folder = input.storageKey.split("/").slice(0, -1).join("/")
    const filename = input.storageKey.split("/").pop() ?? input.storageKey
    const { data, error } = await this.admin.storage.from(GROWTH_MEDIA_ASSETS_BUCKET).list(folder, { search: filename })
    if (error) return null
    const match = data?.find((entry) => entry.name === filename)
    if (!match) return null
    return {
      storageKey: input.storageKey,
      sizeBytes: match.metadata?.size ?? null,
      mimeType: typeof match.metadata?.mimetype === "string" ? match.metadata.mimetype : null,
      lastModified: match.updated_at ?? match.created_at ?? null,
    }
  }
}

class FutureMediaStorageProvider implements MediaStorageProvider {
  constructor(readonly id: Extract<GrowthMediaAssetProvider, "future_s3" | "future_cloudflare_r2">) {}

  private notImplemented(): never {
    throw new Error(`${this.id}_not_implemented`)
  }

  createUploadSession(): Promise<GrowthMediaAssetUploadSession> {
    return Promise.reject(new Error(`${this.id}_not_implemented`))
  }

  completeUpload(): Promise<{ storageKey: string; metadata: Record<string, unknown> }> {
    return Promise.reject(new Error(`${this.id}_not_implemented`))
  }

  generateSignedReadUrl(): Promise<{ url: string; expiresAt: string }> {
    return Promise.reject(new Error(`${this.id}_not_implemented`))
  }

  generateSignedWriteUrl(): Promise<{ url: string; expiresAt: string }> {
    return Promise.reject(new Error(`${this.id}_not_implemented`))
  }

  deleteAsset(): Promise<void> {
    return Promise.reject(new Error(`${this.id}_not_implemented`))
  }

  getMetadata(): Promise<MediaStorageMetadata | null> {
    return Promise.reject(new Error(`${this.id}_not_implemented`))
  }
}

const localStubProvider = new LocalStubMediaStorageProvider()
const futureS3Provider = new FutureMediaStorageProvider("future_s3")
const futureR2Provider = new FutureMediaStorageProvider("future_cloudflare_r2")

export function resolveMediaStorageProvider(
  provider: GrowthMediaAssetProvider,
  admin?: SupabaseClient,
): MediaStorageProvider {
  if (provider === "local_stub") return localStubProvider
  if (provider === "supabase_storage") {
    if (!admin) throw new Error("supabase_admin_required")
    return new SupabaseMediaStorageProvider(admin)
  }
  if (provider === "future_s3") return futureS3Provider
  return futureR2Provider
}

export { buildStorageKey }
