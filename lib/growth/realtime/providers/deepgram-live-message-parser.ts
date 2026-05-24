import type { RealtimeTranscriptChunk } from "@/lib/growth/realtime/providers/provider-types"

type DeepgramLiveMessage = {
  type?: string
  channel?: {
    alternatives?: Array<{
      transcript?: string
      confidence?: number
      words?: Array<{ speaker?: number }>
    }>
  }
  is_final?: boolean
  speech_final?: boolean
  start?: number
  duration?: number
}

export function parseDeepgramLiveTranscriptMessage(
  raw: string,
  input: {
    keywordMatcher?: (content: string) => string[]
    speakerSeparationEnabled?: boolean
  } = {},
): RealtimeTranscriptChunk | null {
  let parsed: DeepgramLiveMessage
  try {
    parsed = JSON.parse(raw) as DeepgramLiveMessage
  } catch {
    return null
  }

  if (parsed.type === "Metadata" || parsed.type === "SpeechStarted" || parsed.type === "UtteranceEnd") {
    return null
  }

  const alternative = parsed.channel?.alternatives?.[0]
  const transcript = alternative?.transcript?.trim() ?? ""
  if (!transcript) return null

  const isFinal = Boolean(parsed.is_final || parsed.speech_final)
  if (!isFinal) return null

  const speaker = resolveDeepgramSpeaker(alternative?.words, input.speakerSeparationEnabled)
  const timestampMs = Math.round((parsed.start ?? 0) * 1000)
  const confidence =
    alternative?.confidence !== undefined ? Math.round(alternative.confidence * 100) : undefined
  const keywords = input.keywordMatcher?.(transcript) ?? []

  return {
    speaker,
    content: transcript,
    timestampMs,
    isFinal: true,
    confidence,
    keywords: keywords.length > 0 ? keywords : undefined,
  }
}

function resolveDeepgramSpeaker(
  words: Array<{ speaker?: number }> | undefined,
  speakerSeparationEnabled?: boolean,
): RealtimeTranscriptChunk["speaker"] {
  if (!speakerSeparationEnabled || !words?.length) return "rep"
  const speakerId = words.find((word) => word.speaker !== undefined)?.speaker
  if (speakerId === undefined) return "rep"
  return speakerId % 2 === 0 ? "rep" : "prospect"
}

export function mapDeepgramProviderError(raw: string | Error): {
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
