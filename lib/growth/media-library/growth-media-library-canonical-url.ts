import {
  buildGrowthMediaLibraryContentPath,
  extractGrowthMediaLibraryAssetIdFromUrl,
} from "@/lib/growth/media-library/growth-media-library-url"

export const GROWTH_MEDIA_LIBRARY_CANONICAL_ORIGIN_FALLBACK = "https://app.equipify.ai" as const

export const GROWTH_MEDIA_LIBRARY_CANONICAL_QA_MARKER = "growth-media-library-canonical-url-2a-v1" as const

export function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase()
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]"
  } catch {
    return false
  }
}

export function readConfiguredGrowthMediaLibraryOrigin(): string | null {
  for (const raw of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_GROWTH_ENGINE_PUBLIC_BASE_URL,
  ]) {
    const trimmed = raw?.trim()
    if (!trimmed) continue
    const normalized = trimmed.replace(/\/+$/, "")
    if (!isLocalhostOrigin(normalized)) return normalized
  }
  return null
}

/** Prefer configured production origin; never persist localhost when config exists. */
export function resolveGrowthMediaLibraryPublicOrigin(requestOrigin?: string | null): string {
  const configured = readConfiguredGrowthMediaLibraryOrigin()
  if (configured) return configured

  const normalizedRequest = requestOrigin?.trim().replace(/\/+$/, "")
  if (normalizedRequest && !isLocalhostOrigin(normalizedRequest)) {
    return normalizedRequest
  }

  if (typeof window !== "undefined") {
    const browserOrigin = window.location.origin
    if (!isLocalhostOrigin(browserOrigin)) return browserOrigin
  }

  return GROWTH_MEDIA_LIBRARY_CANONICAL_ORIGIN_FALLBACK
}

export function buildCanonicalGrowthMediaLibraryPublicUrl(
  assetId: string,
  requestOrigin?: string | null,
): string {
  return `${resolveGrowthMediaLibraryPublicOrigin(requestOrigin)}${buildGrowthMediaLibraryContentPath(assetId)}`
}

export function normalizeGrowthMediaLibraryPersistedUrl(
  url: string,
  input?: { assetId?: string; requestOrigin?: string | null },
): string {
  const trimmed = url.trim()
  if (!trimmed) return ""
  const assetId = input?.assetId ?? extractGrowthMediaLibraryAssetIdFromUrl(trimmed)
  if (!assetId) return trimmed
  return buildCanonicalGrowthMediaLibraryPublicUrl(assetId, input?.requestOrigin)
}

export function isLocalhostGrowthMediaLibraryUrl(url: string): boolean {
  const assetId = extractGrowthMediaLibraryAssetIdFromUrl(url)
  if (!assetId) return false
  try {
    const parsed = new URL(url, GROWTH_MEDIA_LIBRARY_CANONICAL_ORIGIN_FALLBACK)
    return isLocalhostOrigin(parsed.origin)
  } catch {
    return false
  }
}
