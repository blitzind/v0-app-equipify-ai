/** Growth Engine A1 — Video recorder abstraction (client-safe). */

import type {
  GrowthVideoRecordingSession,
  GrowthVideoRecordingSessionState,
} from "@/lib/growth/videos/recording/recording-session"
import type { GrowthVideoSourceType } from "@/lib/growth/videos/growth-video-types"

export const GROWTH_VIDEO_RECORDER_QA_MARKER = "growth-video-recorder-a1-v1" as const

export type GrowthVideoRecorderCapabilities = {
  sourceType: GrowthVideoSourceType
  supportsPause: boolean
  supportsPictureInPicture: boolean
}

export type GrowthVideoRecorderEvent =
  | { type: "state_changed"; state: GrowthVideoRecordingSessionState }
  | { type: "upload_progress"; progressPct: number }
  | { type: "error"; message: string }

export interface GrowthVideoRecorder {
  readonly capabilities: GrowthVideoRecorderCapabilities
  readonly session: GrowthVideoRecordingSession

  prepare(): Promise<void>
  start(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  stop(): Promise<void>
  cancel(): Promise<void>

  subscribe(listener: (event: GrowthVideoRecorderEvent) => void): () => void
}
