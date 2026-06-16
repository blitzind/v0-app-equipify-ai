/** Growth Engine S2-A — MP4 upload validation helpers (client-safe). */

import {
  DEFAULT_GROWTH_MEDIA_VIDEO_MAX_BYTES,
  GROWTH_MEDIA_VIDEO_MIME_TYPES,
  type GrowthMediaVideoMimeType,
} from "@/lib/growth/media/media-video-upload-types"

const SHA256_RE = /^[a-f0-9]{64}$/i

export function sanitizeMediaVideoFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.trim() ?? "video.mp4"
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/_+/g, "_")
  if (!cleaned || cleaned === "." || cleaned === "..") return "video.mp4"
  return cleaned.slice(0, 200)
}

export function inferVideoExtension(filename: string, mimeType?: string | null): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith(".webm")) return "webm"
  if (lower.endsWith(".mp4")) return "mp4"
  if (mimeType === "video/webm") return "webm"
  if (mimeType === "video/mp4") return "mp4"
  return "mp4"
}

export function assertGrowthMediaVideoMimeType(value: string | null | undefined): GrowthMediaVideoMimeType {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (!(GROWTH_MEDIA_VIDEO_MIME_TYPES as readonly string[]).includes(normalized)) {
    throw new Error("invalid_video_mime_type")
  }
  return normalized as GrowthMediaVideoMimeType
}

export function assertGrowthMediaVideoFileSize(
  fileSizeBytes: number | null | undefined,
  maxBytes = DEFAULT_GROWTH_MEDIA_VIDEO_MAX_BYTES,
): number {
  if (fileSizeBytes == null || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("invalid_file_size")
  }
  if (fileSizeBytes > maxBytes) {
    throw new Error("file_too_large")
  }
  return Math.trunc(fileSizeBytes)
}

export function assertGrowthMediaVideoChecksum(checksum: string | null | undefined): string {
  const normalized = checksum?.trim().toLowerCase() ?? ""
  if (!SHA256_RE.test(normalized)) {
    throw new Error("invalid_checksum")
  }
  return normalized
}

export function isUploadSessionExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true
  const ms = Date.parse(expiresAt)
  if (!Number.isFinite(ms)) return true
  return ms <= Date.now()
}
