/** Client-safe browser audio provider stream types (Growth Engine slice 6.12B). */

export const GROWTH_BROWSER_AUDIO_STREAM_STATUSES = [
  "inactive",
  "connecting",
  "listening",
  "interrupted",
  "closed",
] as const

export type GrowthBrowserAudioStreamStatus = (typeof GROWTH_BROWSER_AUDIO_STREAM_STATUSES)[number]

export type GrowthBrowserAudioStreamMetrics = {
  streamOpenCount: number
  streamCloseCount: number
  streamFailureReason: string | null
  averageProviderTranscriptLatencyMs: number
  reconnectAttempts: number
  canRetry: boolean
}

export type GrowthBrowserAudioStreamState = {
  status: GrowthBrowserAudioStreamStatus
  metrics: GrowthBrowserAudioStreamMetrics
}

export const emptyBrowserAudioStreamMetrics = (): GrowthBrowserAudioStreamMetrics => ({
  streamOpenCount: 0,
  streamCloseCount: 0,
  streamFailureReason: null,
  averageProviderTranscriptLatencyMs: 0,
  reconnectAttempts: 0,
  canRetry: false,
})

export const initialBrowserAudioStreamState = (): GrowthBrowserAudioStreamState => ({
  status: "inactive",
  metrics: emptyBrowserAudioStreamMetrics(),
})

/** Providers that support live browser mic → provider streaming (slice 6.12B). */
export const BROWSER_AUDIO_STREAMING_PROVIDER_IDS = ["deepgram"] as const

export type BrowserAudioStreamingProviderId = (typeof BROWSER_AUDIO_STREAMING_PROVIDER_IDS)[number]

export function providerSupportsBrowserAudioStreaming(providerId: string | null | undefined): boolean {
  return BROWSER_AUDIO_STREAMING_PROVIDER_IDS.includes(providerId as BrowserAudioStreamingProviderId)
}

export function growthBrowserAudioStreamStatusLabel(status: GrowthBrowserAudioStreamStatus): string {
  switch (status) {
    case "connecting":
      return "Connecting provider"
    case "listening":
      return "Listening"
    case "interrupted":
      return "Stream interrupted, retry available"
    case "closed":
      return "Stream closed"
    default:
      return "Inactive"
  }
}
