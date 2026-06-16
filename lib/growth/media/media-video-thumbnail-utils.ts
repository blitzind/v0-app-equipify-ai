/** Growth Engine S2-C — Video thumbnail validation + browser extraction (client-safe). */

import {
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_CAPTURE_SECONDS,
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MAX_BYTES,
  DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
  GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES,
  type GrowthMediaVideoThumbnailMimeType,
} from "@/lib/growth/media/media-video-thumbnail-types"

const SHA256_RE = /^[a-f0-9]{64}$/i

export function inferThumbnailExtension(mimeType: string): string {
  return mimeType === "image/png" ? "png" : "jpg"
}

export function assertGrowthMediaVideoThumbnailMimeType(
  value: string | null | undefined,
): GrowthMediaVideoThumbnailMimeType {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (!(GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPES as readonly string[]).includes(normalized)) {
    throw new Error("invalid_thumbnail_mime_type")
  }
  return normalized as GrowthMediaVideoThumbnailMimeType
}

export function assertGrowthMediaVideoThumbnailFileSize(
  fileSizeBytes: number | null | undefined,
  maxBytes = DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MAX_BYTES,
): number {
  if (fileSizeBytes == null || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    throw new Error("invalid_file_size")
  }
  if (fileSizeBytes > maxBytes) {
    throw new Error("file_too_large")
  }
  return Math.trunc(fileSizeBytes)
}

export function assertGrowthMediaVideoThumbnailChecksum(checksum: string | null | undefined): string {
  const normalized = checksum?.trim().toLowerCase() ?? ""
  if (!SHA256_RE.test(normalized)) {
    throw new Error("invalid_checksum")
  }
  return normalized
}

export function buildThumbnailFilename(
  videoAssetId: string,
  mimeType: string = DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
): string {
  const extension = inferThumbnailExtension(assertGrowthMediaVideoThumbnailMimeType(mimeType))
  return `video-${videoAssetId.slice(0, 8)}-thumbnail.${extension}`
}

export async function validateThumbnailImage(blob: Blob): Promise<void> {
  assertGrowthMediaVideoThumbnailMimeType(blob.type || DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE)
  assertGrowthMediaVideoThumbnailFileSize(blob.size)
}

export function createThumbnailBlobFromCanvas(
  canvas: HTMLCanvasElement,
  mimeType: GrowthMediaVideoThumbnailMimeType = DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("thumbnail_canvas_export_failed"))
          return
        }
        void validateThumbnailImage(blob).then(() => resolve(blob)).catch(reject)
      },
      mimeType,
      quality,
    )
  })
}

async function captureFrameFromVideoElement(
  video: HTMLVideoElement,
  captureTimestampSeconds: number,
  mimeType: GrowthMediaVideoThumbnailMimeType,
): Promise<Blob> {
  const duration = Number.isFinite(video.duration) ? video.duration : captureTimestampSeconds
  const targetTime = Math.min(Math.max(captureTimestampSeconds, 0), Math.max(duration - 0.05, 0))

  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }
    video.addEventListener("seeked", onSeeked)
    video.currentTime = targetTime
    setTimeout(() => {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }, 1500)
  })

  const canvas = document.createElement("canvas")
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 360
  const context = canvas.getContext("2d")
  if (!context) throw new Error("thumbnail_canvas_context_failed")
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return createThumbnailBlobFromCanvas(canvas, mimeType)
}

export async function extractVideoThumbnailFromBlob(
  blob: Blob,
  options?: {
    captureTimestampSeconds?: number
    mimeType?: GrowthMediaVideoThumbnailMimeType
  },
): Promise<Blob> {
  const captureTimestampSeconds =
    options?.captureTimestampSeconds ?? DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_CAPTURE_SECONDS
  const mimeType = options?.mimeType ?? DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE
  const objectUrl = URL.createObjectURL(blob)

  try {
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.preload = "metadata"
    video.src = objectUrl

    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error("thumbnail_video_load_failed"))
    })

    return await captureFrameFromVideoElement(video, captureTimestampSeconds, mimeType)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function extractVideoThumbnailFromFile(
  file: File,
  options?: {
    captureTimestampSeconds?: number
    mimeType?: GrowthMediaVideoThumbnailMimeType
  },
): Promise<Blob> {
  return extractVideoThumbnailFromBlob(file, options)
}

export async function computeThumbnailSha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function uploadThumbnailBlobWithProgress(
  url: string,
  blob: Blob,
  mimeType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (url.startsWith("stub://")) {
    onProgress?.(100)
    return
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", mimeType)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }
      reject(new Error(`thumbnail_storage_upload_failed_${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error("thumbnail_storage_upload_network_error"))
    xhr.send(blob)
  })
}

export async function uploadVideoThumbnailBlob(input: {
  videoAssetId: string
  blob: Blob
  mimeType?: GrowthMediaVideoThumbnailMimeType
  captureTimestampSeconds?: number
  replaceExisting?: boolean
  width?: number | null
  height?: number | null
  onProgress?: (percent: number) => void
}): Promise<{ thumbnailAssetId: string; storageKey: string | null }> {
  const mimeType = assertGrowthMediaVideoThumbnailMimeType(
    input.mimeType ?? input.blob.type ?? DEFAULT_GROWTH_MEDIA_VIDEO_THUMBNAIL_MIME_TYPE,
  )
  await validateThumbnailImage(input.blob)
  const checksumSha256 = await computeThumbnailSha256Hex(input.blob)

  const sessionResponse = await fetch(`/api/platform/growth/media-assets/video/${input.videoAssetId}/thumbnail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_size_bytes: input.blob.size,
      mime_type: mimeType,
      capture_timestamp_seconds: input.captureTimestampSeconds,
      replace_existing: input.replaceExisting ?? false,
      provider: "supabase_storage",
    }),
  })
  const sessionPayload = (await sessionResponse.json()) as {
    ok?: boolean
    upload_session?: { signedUploadUrl: string | null; thumbnailAssetId: string; storageKey: string }
    error?: string
  }
  if (!sessionResponse.ok || !sessionPayload.ok || !sessionPayload.upload_session?.signedUploadUrl) {
    throw new Error(sessionPayload.error ?? "thumbnail_session_failed")
  }

  input.onProgress?.(0)
  await uploadThumbnailBlobWithProgress(
    sessionPayload.upload_session.signedUploadUrl,
    input.blob,
    mimeType,
    (storagePercent) => input.onProgress?.(Math.round(storagePercent * 0.8)),
  )

  const completeResponse = await fetch(`/api/platform/growth/media-assets/video/${input.videoAssetId}/thumbnail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "complete",
      thumbnail_asset_id: sessionPayload.upload_session.thumbnailAssetId,
      checksum_sha256: checksumSha256,
      file_size_bytes: input.blob.size,
      width: input.width ?? null,
      height: input.height ?? null,
    }),
  })
  const completePayload = (await completeResponse.json()) as {
    ok?: boolean
    thumbnail?: { asset_id: string; storage_key: string | null }
    error?: string
  }
  if (!completeResponse.ok || !completePayload.ok || !completePayload.thumbnail?.asset_id) {
    throw new Error(completePayload.error ?? "thumbnail_complete_failed")
  }

  input.onProgress?.(100)
  return {
    thumbnailAssetId: completePayload.thumbnail.asset_id,
    storageKey: completePayload.thumbnail.storage_key,
  }
}
