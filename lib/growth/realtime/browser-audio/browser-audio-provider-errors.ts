import {
  ProviderStreamingUnavailableError,
} from "@/lib/growth/realtime/browser-audio/browser-audio-chunk-errors"
import { mapDeepgramProviderError } from "@/lib/growth/realtime/providers/deepgram-live-message-parser"

export class ProviderAuthError extends Error {
  constructor(message = "Provider authentication failed. Check credentials in Live Coaching settings.") {
    super(message)
    this.name = "ProviderAuthError"
  }
}

export class ProviderRateLimitError extends Error {
  constructor(message = "Provider rate limit reached. Pause mic capture and retry shortly.") {
    super(message)
    this.name = "ProviderRateLimitError"
  }
}

export class UnsupportedAudioFormatError extends Error {
  constructor(message = "Browser audio format is not supported by the provider stream.") {
    super(message)
    this.name = "UnsupportedAudioFormatError"
  }
}

export class StreamTimeoutError extends Error {
  constructor(message = "Provider stream timed out. Retry mic capture when ready.") {
    super(message)
    this.name = "StreamTimeoutError"
  }
}

export class ProviderDisconnectedError extends Error {
  constructor(message = "Provider stream disconnected. Manual transcript mode remains available.") {
    super(message)
    this.name = "ProviderDisconnectedError"
  }
}

export function mapBrowserAudioProviderError(error: unknown): { code: string; message: string; status: number } {
  if (error instanceof ProviderStreamingUnavailableError) {
    return {
      code: "provider_streaming_unavailable",
      message: error.message,
      status: 409,
    }
  }
  if (error instanceof ProviderAuthError) {
    return { code: "provider_auth_failed", message: error.message, status: 401 }
  }
  if (error instanceof ProviderRateLimitError) {
    return { code: "provider_rate_limited", message: error.message, status: 429 }
  }
  if (error instanceof UnsupportedAudioFormatError) {
    return { code: "unsupported_audio_format", message: error.message, status: 415 }
  }
  if (error instanceof StreamTimeoutError) {
    return { code: "stream_timeout", message: error.message, status: 408 }
  }
  if (error instanceof ProviderDisconnectedError) {
    return { code: "provider_disconnected", message: error.message, status: 409 }
  }

  const mapped = mapDeepgramProviderError(error instanceof Error ? error : String(error))
  return {
    code: mapped.code,
    message: mapped.message,
    status: mapped.code === "provider_auth_failed" ? 401 : 409,
  }
}

export function classifyBrowserAudioProviderErrorCode(detail: string): Error {
  const mapped = mapDeepgramProviderError(detail)
  switch (mapped.code) {
    case "provider_auth_failed":
      return new ProviderAuthError(mapped.message)
    case "provider_rate_limited":
      return new ProviderRateLimitError(mapped.message)
    case "unsupported_audio_format":
      return new UnsupportedAudioFormatError(mapped.message)
    case "stream_timeout":
      return new StreamTimeoutError(mapped.message)
    case "provider_disconnected":
      return new ProviderDisconnectedError(mapped.message)
    default:
      return new ProviderStreamingUnavailableError(mapped.message)
  }
}
