/** Growth Engine S2-B — Browser webcam recording types (client-safe). */

import type { GrowthMediaVideoAssetSummary } from "@/lib/growth/media/media-video-upload-types"

export const GROWTH_MEDIA_WEBCAM_RECORDING_QA_MARKER = "growth-media-webcam-recording-s2b-v1" as const

/** MediaRecorder codec strings probed in preference order (see media-webcam-recording-utils). */
export const GROWTH_MEDIA_WEBCAM_RECORDING_MIME_CANDIDATES = [
  "video/mp4",
  "video/mp4;codecs=avc1",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const

export type GrowthMediaWebcamRecordingPhase =
  | "idle"
  | "unsupported"
  | "permission_denied"
  | "ready"
  | "recording"
  | "recorded"
  | "uploading"
  | "success"
  | "failure"

export type GrowthMediaWebcamRecordingEnvironment = {
  supported: boolean
  hasMediaDevices: boolean
  hasGetUserMedia: boolean
  hasMediaRecorder: boolean
  preferredMimeType: string | null
  normalizedMimeType: "video/mp4" | "video/webm" | null
  blockedReason: string | null
  browserSupportNote: string
}

export type GrowthMediaWebcamRecordingSafetyFlags = {
  no_playback: true
  no_thumbnail_generation: true
  no_ai_generation: true
  no_notifications: true
  no_sequence_execution: true
}

export const GROWTH_MEDIA_WEBCAM_RECORDING_SAFETY_FLAGS: GrowthMediaWebcamRecordingSafetyFlags = {
  no_playback: true,
  no_thumbnail_generation: true,
  no_ai_generation: true,
  no_notifications: true,
  no_sequence_execution: true,
}

export type GrowthMediaRecordedVideoUploadInput = {
  blob: Blob
  mimeType: string
  durationSeconds: number
  width?: number | null
  height?: number | null
  title?: string
  onProgress?: (percent: number) => void
}

export type GrowthMediaRecordedVideoUploadResult = {
  assetId: string
  asset: GrowthMediaVideoAssetSummary
}
