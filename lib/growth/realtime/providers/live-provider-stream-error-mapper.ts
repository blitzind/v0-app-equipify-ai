/** Client-safe live provider stream error mapping (Growth Engine slice 6.12B/6.12D). */

export function mapLiveProviderStreamError(raw: string | Error): {
  code: string
  message: string
} {
  const detail = raw instanceof Error ? raw.message : raw
  const normalized = detail.toLowerCase()

  if (normalized.includes("401") || normalized.includes("unauthorized") || normalized.includes("invalid credentials")) {
    return {
      code: "provider_auth_failed",
      message: "Provider authentication failed. Check credentials in Live Coaching settings.",
    }
  }
  if (normalized.includes("429") || normalized.includes("rate limit") || normalized.includes("quota")) {
    return {
      code: "provider_rate_limited",
      message: "Provider rate limit reached. Pause mic capture and retry shortly.",
    }
  }
  if (normalized.includes("unsupported") || normalized.includes("encoding") || normalized.includes("format")) {
    return {
      code: "unsupported_audio_format",
      message: "Browser audio format is not supported by the provider stream.",
    }
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return {
      code: "stream_timeout",
      message: "Provider stream timed out. Retry mic capture when ready.",
    }
  }
  if (normalized.includes("disconnect") || normalized.includes("closed") || normalized.includes("connection")) {
    return {
      code: "provider_disconnected",
      message: "Provider stream disconnected. Manual transcript mode remains available.",
    }
  }

  return {
    code: "provider_unavailable",
    message: "Provider transcript streaming is not connected. Use manual transcript mode.",
  }
}
