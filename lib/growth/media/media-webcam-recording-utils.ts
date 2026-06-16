/** Growth Engine S2-B — Browser webcam recording helpers (client-safe). */

import {
  GROWTH_MEDIA_WEBCAM_RECORDING_MIME_CANDIDATES,
  GROWTH_MEDIA_WEBCAM_RECORDING_QA_MARKER,
  type GrowthMediaRecordedVideoUploadInput,
  type GrowthMediaRecordedVideoUploadResult,
  type GrowthMediaWebcamRecordingEnvironment,
} from "@/lib/growth/media/media-webcam-recording-types"
import {
  GROWTH_MEDIA_VIDEO_MIME_TYPES,
  type GrowthMediaVideoMimeType,
} from "@/lib/growth/media/media-video-upload-types"

const BROWSER_SUPPORT_NOTE =
  "Safari 14.1+ may record MP4 directly. Chrome, Edge, and Firefox typically record WebM; S2-C may transcode to MP4 for delivery."

export function normalizeRecordedVideoMimeType(mimeType: string): GrowthMediaVideoMimeType {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? ""
  if (base === "video/mp4" || base === "video/webm") {
    return base
  }
  throw new Error("unsupported_recording_mime_type")
}

export function getSupportedVideoRecordingMimeType(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return null
  }

  for (const candidate of GROWTH_MEDIA_WEBCAM_RECORDING_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate
    }
  }

  return null
}

export function isWebcamRecordingSupported(): boolean {
  return evaluateWebcamRecordingEnvironment().supported
}

export function evaluateWebcamRecordingEnvironment(): GrowthMediaWebcamRecordingEnvironment {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supported: false,
      hasMediaDevices: false,
      hasGetUserMedia: false,
      hasMediaRecorder: false,
      preferredMimeType: null,
      normalizedMimeType: null,
      blockedReason: "Webcam recording is not available in this environment.",
      browserSupportNote: BROWSER_SUPPORT_NOTE,
    }
  }

  const hasMediaDevices = Boolean(navigator.mediaDevices)
  const hasGetUserMedia = Boolean(navigator.mediaDevices?.getUserMedia)
  const hasMediaRecorder = typeof MediaRecorder !== "undefined"

  if (!hasMediaDevices || !hasGetUserMedia) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      normalizedMimeType: null,
      blockedReason: "This browser does not expose webcam capture APIs.",
      browserSupportNote: BROWSER_SUPPORT_NOTE,
    }
  }

  if (!hasMediaRecorder) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      normalizedMimeType: null,
      blockedReason: "This browser does not support MediaRecorder for video.",
      browserSupportNote: BROWSER_SUPPORT_NOTE,
    }
  }

  const preferredMimeType = getSupportedVideoRecordingMimeType()
  if (!preferredMimeType) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasMediaRecorder,
      preferredMimeType: null,
      normalizedMimeType: null,
      blockedReason: "This browser does not support a compatible MP4 or WebM recording format.",
      browserSupportNote: BROWSER_SUPPORT_NOTE,
    }
  }

  let normalizedMimeType: GrowthMediaVideoMimeType | null = null
  try {
    normalizedMimeType = normalizeRecordedVideoMimeType(preferredMimeType)
  } catch {
    normalizedMimeType = null
  }

  if (!normalizedMimeType || !(GROWTH_MEDIA_VIDEO_MIME_TYPES as readonly string[]).includes(normalizedMimeType)) {
    return {
      supported: false,
      hasMediaDevices,
      hasGetUserMedia,
      hasMediaRecorder,
      preferredMimeType,
      normalizedMimeType: null,
      blockedReason: "Recorded format is not accepted by the media asset pipeline.",
      browserSupportNote: BROWSER_SUPPORT_NOTE,
    }
  }

  return {
    supported: true,
    hasMediaDevices,
    hasGetUserMedia,
    hasMediaRecorder,
    preferredMimeType,
    normalizedMimeType,
    blockedReason: null,
    browserSupportNote: BROWSER_SUPPORT_NOTE,
  }
}

export function formatRecordingDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function buildRecordedVideoFilename(mimeType: string, prefix = "webcam-recording"): string {
  const normalized = normalizeRecordedVideoMimeType(mimeType)
  const extension = normalized === "video/webm" ? "webm" : "mp4"
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  return `${prefix}-${stamp}.${extension}`
}

export async function computeBlobSha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function uploadBlobWithProgress(
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
      reject(new Error(`storage_upload_failed_${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error("storage_upload_network_error"))
    xhr.send(blob)
  })
}

/** Upload a recorded blob through the S2-A signed-upload pipeline (no playback/thumbnail/AI). */
export async function uploadRecordedVideoBlob(
  input: GrowthMediaRecordedVideoUploadInput,
): Promise<GrowthMediaRecordedVideoUploadResult> {
  const normalizedMimeType = normalizeRecordedVideoMimeType(input.mimeType)
  const filename = buildRecordedVideoFilename(normalizedMimeType)
  const checksumSha256 = await computeBlobSha256Hex(input.blob)
  const fileSizeBytes = input.blob.size

  const createResponse = await fetch("/api/platform/growth/media-assets/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title?.trim() || "Webcam recording",
      original_filename: filename,
      mime_type: normalizedMimeType,
      file_size_bytes: fileSizeBytes,
      provider: "supabase_storage",
      tags: [GROWTH_MEDIA_WEBCAM_RECORDING_QA_MARKER],
    }),
  })
  const createPayload = (await createResponse.json()) as {
    ok?: boolean
    asset?: { id: string }
    message?: string
    error?: string
  }
  if (!createResponse.ok || !createPayload.ok || !createPayload.asset?.id) {
    throw new Error(createPayload.message ?? createPayload.error ?? "video_asset_create_failed")
  }

  const assetId = createPayload.asset.id

  const sessionResponse = await fetch("/api/platform/growth/media-assets/video/upload-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asset_id: assetId,
      mime_type: normalizedMimeType,
      file_size_bytes: fileSizeBytes,
    }),
  })
  const sessionPayload = (await sessionResponse.json()) as {
    ok?: boolean
    upload_session?: { signedUploadUrl: string | null }
    message?: string
    error?: string
  }
  if (!sessionResponse.ok || !sessionPayload.ok || !sessionPayload.upload_session?.signedUploadUrl) {
    throw new Error(sessionPayload.message ?? sessionPayload.error ?? "upload_session_failed")
  }

  input.onProgress?.(0)
  await uploadBlobWithProgress(
    sessionPayload.upload_session.signedUploadUrl,
    input.blob,
    normalizedMimeType,
    (storagePercent) => {
      input.onProgress?.(Math.round(storagePercent * 0.85))
    },
  )

  const completeResponse = await fetch("/api/platform/growth/media-assets/video/complete-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asset_id: assetId,
      checksum_sha256: checksumSha256,
      file_size_bytes: fileSizeBytes,
      duration_seconds: input.durationSeconds,
      width: input.width ?? null,
      height: input.height ?? null,
    }),
  })
  const completePayload = (await completeResponse.json()) as {
    ok?: boolean
    asset?: GrowthMediaRecordedVideoUploadResult["asset"]
    message?: string
    error?: string
  }
  if (!completeResponse.ok || !completePayload.ok || !completePayload.asset) {
    throw new Error(completePayload.message ?? completePayload.error ?? "upload_complete_failed")
  }

  input.onProgress?.(100)

  return {
    assetId,
    asset: completePayload.asset,
  }
}
