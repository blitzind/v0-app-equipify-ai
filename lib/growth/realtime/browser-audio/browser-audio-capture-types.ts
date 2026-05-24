export const GROWTH_BROWSER_AUDIO_CAPTURE_STATUSES = [
  "inactive",
  "requesting",
  "active",
  "paused",
  "stopped",
  "failed",
] as const

export type GrowthBrowserAudioCaptureStatus = (typeof GROWTH_BROWSER_AUDIO_CAPTURE_STATUSES)[number]

export type GrowthBrowserAudioCaptureMetrics = {
  chunkCount: number
  failedChunkCount: number
  averageChunkSendLatencyMs: number
  providerTranscriptLatencyMs: number
  lastChunkAt: string | null
}

export type GrowthBrowserAudioCaptureCapability = {
  canStart: boolean
  disabledReason: string | null
  providerLabel: string | null
  providerHealthy: boolean
}

export type GrowthBrowserAudioCaptureState = {
  status: GrowthBrowserAudioCaptureStatus
  muted: boolean
  error: string | null
  metrics: GrowthBrowserAudioCaptureMetrics
}

export const emptyBrowserAudioCaptureMetrics = (): GrowthBrowserAudioCaptureMetrics => ({
  chunkCount: 0,
  failedChunkCount: 0,
  averageChunkSendLatencyMs: 0,
  providerTranscriptLatencyMs: 0,
  lastChunkAt: null,
})

export const initialBrowserAudioCaptureState = (): GrowthBrowserAudioCaptureState => ({
  status: "inactive",
  muted: false,
  error: null,
  metrics: emptyBrowserAudioCaptureMetrics(),
})
