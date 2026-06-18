/** Growth Engine A1 — Recording session state (client-safe). */

import type { GrowthVideoSourceType } from "@/lib/growth/videos/growth-video-types"

export const GROWTH_VIDEO_RECORDING_SESSION_QA_MARKER = "growth-video-recording-session-a1-v1" as const

export const GROWTH_VIDEO_RECORDING_SESSION_STATES = [
  "idle",
  "preparing",
  "recording",
  "paused",
  "stopping",
  "uploading",
  "completed",
  "cancelled",
  "failed",
] as const

export type GrowthVideoRecordingSessionState = (typeof GROWTH_VIDEO_RECORDING_SESSION_STATES)[number]

export const GROWTH_VIDEO_UPLOAD_STATES = [
  "not_started",
  "queued",
  "uploading",
  "processing",
  "ready",
  "failed",
] as const

export type GrowthVideoUploadState = (typeof GROWTH_VIDEO_UPLOAD_STATES)[number]

export type GrowthVideoRecordingMetadata = {
  sourceType: GrowthVideoSourceType
  startedAt: string | null
  endedAt: string | null
  durationMs: number | null
  mimeType: string | null
  deviceLabel: string | null
  resolution: string | null
  frameRate: number | null
  audioTracks: number
  videoTracks: number
}

export type GrowthVideoRecordingSession = {
  sessionId: string
  state: GrowthVideoRecordingSessionState
  uploadState: GrowthVideoUploadState
  metadata: GrowthVideoRecordingMetadata
  error: string | null
  uploadProgressPct: number | null
}

export function createIdleGrowthVideoRecordingSession(
  sessionId: string,
  sourceType: GrowthVideoSourceType,
): GrowthVideoRecordingSession {
  return {
    sessionId,
    state: "idle",
    uploadState: "not_started",
    metadata: {
      sourceType,
      startedAt: null,
      endedAt: null,
      durationMs: null,
      mimeType: null,
      deviceLabel: null,
      resolution: null,
      frameRate: null,
      audioTracks: 0,
      videoTracks: 0,
    },
    error: null,
    uploadProgressPct: null,
  }
}
