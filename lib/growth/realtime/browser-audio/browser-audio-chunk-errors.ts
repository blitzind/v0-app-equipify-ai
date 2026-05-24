import {
  mapBrowserAudioProviderError,
} from "@/lib/growth/realtime/browser-audio/browser-audio-provider-errors"

export class ProviderStreamingUnavailableError extends Error {
  constructor(message = "Provider transcript streaming is not connected. Use manual transcript mode.") {
    super(message)
    this.name = "ProviderStreamingUnavailableError"
  }
}

export function mapBrowserAudioChunkError(error: unknown): { error: string; message: string; status: number } {
  if (error instanceof ProviderStreamingUnavailableError) {
    return {
      error: "provider_streaming_unavailable",
      message: error.message,
      status: 409,
    }
  }

  const detail = error instanceof Error ? error.message : String(error)
  if (detail === "not_found") return { error: detail, message: "Session not found.", status: 404 }
  if (detail === "session_closed") return { error: detail, message: "Session is closed.", status: 409 }
  if (detail === "invalid_audio_chunk") {
    return { error: detail, message: "Audio chunk payload is invalid or too large.", status: 400 }
  }

  return mapBrowserAudioProviderError(error)
}
