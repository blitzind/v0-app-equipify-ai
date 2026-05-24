/** Browser mic capture is live transcript input only — never persisted as audio. */
export const GROWTH_BROWSER_AUDIO_STORAGE_ENABLED = false

export const GROWTH_BROWSER_AUDIO_AUTONOMOUS_ACTIONS: string[] = []

export const GROWTH_BROWSER_AUDIO_CAPTURE_SAFETY_COPY =
  "Mic capture is used only to create live transcript text for coaching. Audio is not stored."

export const GROWTH_BROWSER_AUDIO_PROVIDER_UNAVAILABLE_MESSAGE =
  "Provider transcript streaming is not connected. Use manual transcript mode."

export const GROWTH_BROWSER_AUDIO_CONNECT_PROVIDER_MESSAGE =
  "Connect a realtime transcript provider to enable mic capture."

export const GROWTH_BROWSER_AUDIO_SCAFFOLD_MESSAGE =
  "Audio chunk received. Provider live streaming scaffold is active — SDK transcription wiring is not enabled yet."

export const GROWTH_BROWSER_AUDIO_STREAM_CONNECTING_COPY = "Connecting provider"
export const GROWTH_BROWSER_AUDIO_STREAM_LISTENING_COPY = "Listening"
export const GROWTH_BROWSER_AUDIO_STREAM_UNAVAILABLE_COPY =
  "Provider unavailable, manual transcript mode active"
export const GROWTH_BROWSER_AUDIO_STREAM_INTERRUPTED_COPY = "Stream interrupted, retry available"
