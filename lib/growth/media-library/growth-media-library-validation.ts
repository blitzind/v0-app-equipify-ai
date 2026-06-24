import {
  GROWTH_MEDIA_LIBRARY_MAX_BYTES,
  GROWTH_MEDIA_LIBRARY_MIME_TYPES,
  type GrowthMediaLibraryMimeType,
} from "@/lib/growth/media-library/growth-media-library-types"

export type GrowthMediaLibraryValidationResult =
  | { ok: true; mimeType: GrowthMediaLibraryMimeType }
  | { ok: false; error: "invalid_mime_type" | "file_too_large" | "missing_file" }

function normalizeMimeType(value: string | null | undefined): GrowthMediaLibraryMimeType | null {
  const mime = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (!mime) return null
  if (mime === "image/jpg") return "image/jpeg"
  return (GROWTH_MEDIA_LIBRARY_MIME_TYPES as readonly string[]).includes(mime)
    ? (mime as GrowthMediaLibraryMimeType)
    : null
}

export function validateGrowthMediaLibraryUpload(input: {
  mimeType?: string | null
  fileSizeBytes?: number | null
}): GrowthMediaLibraryValidationResult {
  const mimeType = normalizeMimeType(input.mimeType)
  if (!mimeType) {
    return { ok: false, error: "invalid_mime_type" }
  }

  const size = input.fileSizeBytes
  if (size == null || !Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "missing_file" }
  }
  if (size > GROWTH_MEDIA_LIBRARY_MAX_BYTES) {
    return { ok: false, error: "file_too_large" }
  }

  return { ok: true, mimeType }
}

export function validateGrowthMediaLibraryFile(file: File): GrowthMediaLibraryValidationResult {
  return validateGrowthMediaLibraryUpload({
    mimeType: file.type,
    fileSizeBytes: file.size,
  })
}
