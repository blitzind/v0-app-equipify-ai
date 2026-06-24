/** GS-GROWTH-MEDIA-LIBRARY-1A — Shared Growth media library (client-safe). */

export const GROWTH_MEDIA_LIBRARY_QA_MARKER = "growth-media-library-1a-v1" as const

export const GROWTH_MEDIA_LIBRARY_TAG = "growth-media-library" as const

export const GROWTH_MEDIA_LIBRARY_KIND_TAGS = {
  image: "library-kind:image",
  logo: "library-kind:logo",
  avatar: "library-kind:avatar",
} as const

export type GrowthMediaLibraryKind = keyof typeof GROWTH_MEDIA_LIBRARY_KIND_TAGS

export const GROWTH_MEDIA_LIBRARY_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export type GrowthMediaLibraryMimeType = (typeof GROWTH_MEDIA_LIBRARY_MIME_TYPES)[number]

export const GROWTH_MEDIA_LIBRARY_MAX_BYTES = 5 * 1024 * 1024

export const GROWTH_MEDIA_LIBRARY_ACCEPT_ATTR = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"

export type GrowthMediaLibraryAsset = {
  id: string
  title: string
  assetType: string
  mimeType: string | null
  fileSizeBytes: number | null
  width: number | null
  height: number | null
  tags: string[]
  altText: string | null
  libraryKind: GrowthMediaLibraryKind
  publicUrl: string
  previewUrl: string
  status: string
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthMediaLibraryListResponse = {
  ok: boolean
  items: GrowthMediaLibraryAsset[]
  total: number
}
