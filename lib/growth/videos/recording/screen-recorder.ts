/** Growth Engine A1 — Screen recorder interface (client-safe). */

import type { GrowthVideoRecorder } from "@/lib/growth/videos/recording/video-recorder"

export const GROWTH_SCREEN_RECORDER_QA_MARKER = "growth-screen-recorder-a1-v1" as const

export type GrowthScreenRecorderOptions = {
  includeSystemAudio?: boolean
  captureCursor?: boolean
}

export interface GrowthScreenRecorder extends GrowthVideoRecorder {
  readonly mode: "screen" | "screen_webcam"
}

export type GrowthScreenRecorderFactory = (options?: GrowthScreenRecorderOptions) => GrowthScreenRecorder
