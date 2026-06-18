/** Growth Engine A2 — Video upload validation (client-safe). */

import {
  GROWTH_VIDEO_ALLOWED_MIME_TYPES,
  GROWTH_VIDEO_MAX_UPLOAD_BYTES,
  type GrowthVideoAllowedMimeType,
} from "@/lib/growth/videos/growth-video-types"

export function sanitizeGrowthVideoFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "video.mp4"
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_")
  if (!cleaned || cleaned === "." || cleaned === "..") return "video.mp4"
  return cleaned.slice(0, 200)
}

export function inferGrowthVideoExtension(filename: string, mimeType?: string | null): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".webm")) return "webm"
  if (lower.endsWith(".mov")) return "mov"
  if (lower.endsWith(".mp4")) return "mp4"
  if (mimeType === "video/webm") return "webm"
  if (mimeType === "video/quicktime") return "mov"
  return "mp4"
}

export function assertGrowthVideoMimeType(value: string | null | undefined): GrowthVideoAllowedMimeType {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (!(GROWTH_VIDEO_ALLOWED_MIME_TYPES as readonly string[]).includes(normalized)) {
    throw new Error("invalid_video_mime_type")
  }
  return normalized as GrowthVideoAllowedMimeType
}

export function assertGrowthVideoFileSize(
  fileSizeBytes: number | null | undefined,
  maxBytes = GROWTH_VIDEO_MAX_UPLOAD_BYTES,
): number {
  if (fileSizeBytes == null || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("invalid_file_size")
  }
  if (fileSizeBytes > maxBytes) {
    throw new Error("file_too_large")
  }
  return Math.trunc(fileSizeBytes)
}

export function buildGrowthVideoSourceStoragePath(input: {
  organizationId: string
  assetId: string
  extension: string
}): string {
  const ext = input.extension.replace(/^\./, "").toLowerCase()
  return `organizations/${input.organizationId}/videos/${input.assetId}/source.${ext}`
}

export function buildGrowthVideoThumbnailPlaceholderPath(input: {
  organizationId: string
  assetId: string
}): string {
  return `organizations/${input.organizationId}/videos/${input.assetId}/thumbnail.jpg`
}
