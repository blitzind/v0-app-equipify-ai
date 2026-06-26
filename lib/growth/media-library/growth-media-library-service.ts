import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthMediaAsset } from "@/lib/growth/media/media-asset-types"
import {
  createMediaAsset,
  createUploadSession,
  generateMediaAssetSignedReadUrl,
  listMediaAssets,
} from "@/lib/growth/media/media-asset-repository"
import {
  GROWTH_MEDIA_LIBRARY_KIND_TAGS,
  GROWTH_MEDIA_LIBRARY_TAG,
  type GrowthMediaLibraryAsset,
  type GrowthMediaLibraryKind,
} from "@/lib/growth/media-library/growth-media-library-types"
import {
  buildGrowthMediaLibraryPublicUrl,
  growthMediaLibraryKindTag,
  resolveGrowthMediaLibraryKindFromTags,
} from "@/lib/growth/media-library/growth-media-library-url"
import { validateGrowthMediaLibraryUpload } from "@/lib/growth/media-library/growth-media-library-validation"

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function readAltText(metadata: Record<string, unknown>): string | null {
  const alt = metadata.alt_text
  return typeof alt === "string" && alt.trim() ? alt.trim() : null
}

export function mapGrowthMediaLibraryAsset(
  asset: GrowthMediaAsset,
  origin?: string | null,
): GrowthMediaLibraryAsset {
  const metadata = asset.metadata
  const libraryKind = resolveGrowthMediaLibraryKindFromTags(asset.tags)
  const publicUrl = buildGrowthMediaLibraryPublicUrl(asset.id, origin)
  return {
    id: asset.id,
    title: asset.title,
    assetType: asset.assetType,
    mimeType: asset.mimeType,
    fileSizeBytes: asset.fileSizeBytes,
    width: asset.width,
    height: asset.height,
    tags: asset.tags,
    altText: readAltText(metadata),
    libraryKind,
    publicUrl,
    previewUrl: publicUrl,
    status: asset.status,
    archivedAt: asset.archivedAt,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }
}

export async function listGrowthMediaLibraryAssets(
  admin: SupabaseClient,
  input: {
    organizationId: string
    libraryKind?: GrowthMediaLibraryKind | "avatar"
    includeArchived?: boolean
    search?: string
    limit?: number
    offset?: number
    origin?: string | null
  },
): Promise<{ items: GrowthMediaLibraryAsset[]; total: number }> {
  const filterKind = input.libraryKind === "avatar" ? "team" : input.libraryKind
  const tag = filterKind ? GROWTH_MEDIA_LIBRARY_KIND_TAGS[filterKind] : GROWTH_MEDIA_LIBRARY_TAG

  const result = await listMediaAssets(admin, {
    organizationId: input.organizationId,
    assetType: "image",
    tag: filterKind === "team" ? GROWTH_MEDIA_LIBRARY_TAG : tag,
    search: input.search,
    limit: filterKind === "team" ? Math.min(input.limit ?? 100, 200) : input.limit,
    offset: input.offset,
    excludeArchived: !input.includeArchived,
  })

  let items = result.items.map((asset) => mapGrowthMediaLibraryAsset(asset, input.origin))
  if (filterKind === "team") {
    items = items.filter((asset) => asset.libraryKind === "team")
  } else if (filterKind) {
    items = items.filter((asset) => asset.libraryKind === filterKind)
  }

  return {
    items,
    total: filterKind ? items.length : result.total,
  }
}

export async function createGrowthMediaLibraryUploadSession(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string
    title?: string
    libraryKind?: GrowthMediaLibraryKind | "avatar"
    mimeType: string
    fileSizeBytes: number
    altText?: string | null
    originalFilename?: string | null
    origin?: string | null
  },
) {
  const validation = validateGrowthMediaLibraryUpload({
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
  })
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const libraryKind = input.libraryKind ?? "image"
  const normalizedKind: GrowthMediaLibraryKind =
    libraryKind === "avatar" ? "team" : libraryKind
  const tags = [GROWTH_MEDIA_LIBRARY_TAG, growthMediaLibraryKindTag(normalizedKind)]
  const metadata: Record<string, unknown> = {}
  if (input.altText?.trim()) metadata.alt_text = input.altText.trim()

  const asset = await createMediaAsset(admin, {
    organizationId: input.organizationId,
    createdBy: input.createdBy,
    assetType: "image",
    provider: "supabase_storage",
    title: input.title?.trim() || input.originalFilename?.trim() || "Media library image",
    originalFilename: input.originalFilename ?? null,
    mimeType: validation.mimeType,
    tags,
    source: "upload",
    metadata,
  })

  const sessionResult = await createUploadSession(admin, {
    organizationId: input.organizationId,
    assetId: asset.id,
    mimeType: validation.mimeType,
    fileSizeBytes: input.fileSizeBytes,
  })

  return {
    asset: mapGrowthMediaLibraryAsset(sessionResult.asset, input.origin),
    uploadSession: sessionResult.session,
    publicUrl: buildGrowthMediaLibraryPublicUrl(asset.id, input.origin),
  }
}

export async function resolveGrowthMediaLibraryContentRedirect(
  admin: SupabaseClient,
  input: { organizationId: string; assetId: string },
): Promise<{ url: string; mimeType: string | null } | null> {
  const signed = await generateMediaAssetSignedReadUrl(admin, {
    organizationId: input.organizationId,
    assetId: input.assetId,
    signedUrlTtlSeconds: 3600,
  })

  const { data, error } = await admin
    .schema("growth")
    .from("media_assets")
    .select("mime_type, tags, asset_type, status")
    .eq("id", input.assetId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()

  if (error || !data) return null

  const assetType = String(data.asset_type ?? "")
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : []
  const isLibraryImage =
    assetType === "image" &&
    (tags.includes(GROWTH_MEDIA_LIBRARY_TAG) || tags.some((tag) => tag.startsWith("library-kind:")))

  if (!isLibraryImage) return null

  const status = String(data.status ?? "")
  if (status === "draft" || status === "upload_pending" || status === "failed") {
    return null
  }

  return {
    url: signed.url,
    mimeType: typeof data.mime_type === "string" ? data.mime_type : null,
  }
}
