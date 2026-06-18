/** Growth Engine A1 — Webcam recorder interface (client-safe). */

import type { GrowthVideoRecorder } from "@/lib/growth/videos/recording/video-recorder"

export const GROWTH_WEBCAM_RECORDER_QA_MARKER = "growth-webcam-recorder-a1-v1" as const

export type GrowthWebcamRecorderOptions = {
  preferredDeviceId?: string | null
  mirrorPreview?: boolean
}

export interface GrowthWebcamRecorder extends GrowthVideoRecorder {
  readonly mode: "webcam"
}

export type GrowthWebcamRecorderFactory = (options?: GrowthWebcamRecorderOptions) => GrowthWebcamRecorder
