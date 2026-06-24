import type { GrowthMediaLibraryKind } from "@/lib/growth/media-library/growth-media-library-types"
import { GROWTH_MEDIA_LIBRARY_KIND_TAGS } from "@/lib/growth/media-library/growth-media-library-types"

export const GROWTH_MEDIA_LIBRARY_CONTENT_PATH_PREFIX = "/api/growth/media-library" as const

export function buildGrowthMediaLibraryContentPath(assetId: string): string {
  return `${GROWTH_MEDIA_LIBRARY_CONTENT_PATH_PREFIX}/${assetId}/content`
}

export function buildGrowthMediaLibraryPublicUrl(assetId: string, origin?: string | null): string {
  const path = buildGrowthMediaLibraryContentPath(assetId)
  if (origin && origin.trim()) {
    return `${origin.trim().replace(/\/$/, "")}${path}`
  }
  return path
}

export function resolveGrowthMediaLibraryKindFromTags(tags: string[]): GrowthMediaLibraryKind {
  if (tags.includes(GROWTH_MEDIA_LIBRARY_KIND_TAGS.logo)) return "logo"
  if (tags.includes(GROWTH_MEDIA_LIBRARY_KIND_TAGS.avatar)) return "avatar"
  return "image"
}

export function growthMediaLibraryKindTag(kind: GrowthMediaLibraryKind): string {
  return GROWTH_MEDIA_LIBRARY_KIND_TAGS[kind]
}

export function extractGrowthMediaLibraryAssetIdFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null
  const trimmed = url.trim()
  if (!trimmed) return null
  const match = trimmed.match(/\/api\/growth\/media-library\/([0-9a-f-]{36})\/content(?:[?#].*)?$/i)
  return match?.[1] ?? null
}
