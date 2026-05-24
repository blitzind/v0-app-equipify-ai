import type { RealtimeTranscriptChunk } from "@/lib/growth/realtime/providers/provider-types"
import { mapLiveProviderStreamError } from "@/lib/growth/realtime/providers/live-provider-stream-error-mapper"
import { isOpenAiRealtimeForbiddenOutboundEventType } from "@/lib/growth/realtime/providers/openai-realtime-transcript-invariants"

type OpenAiRealtimeTranscriptionDeltaEvent = {
  type?: string
  delta?: string
  item_id?: string
  content_index?: number
}

type OpenAiRealtimeTranscriptionCompletedEvent = {
  type?: string
  transcript?: string
  item_id?: string
  content_index?: number
}

type OpenAiRealtimeErrorEvent = {
  type?: string
  error?: {
    type?: string
    message?: string
    code?: string
  }
}

export function parseOpenAiRealtimeLiveTranscriptMessage(
  raw: string,
  input: {
    keywordMatcher?: (content: string) => string[]
    partialBuffer?: { itemId: string | null; content: string }
  } = {},
): RealtimeTranscriptChunk | null {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }

  const eventType = typeof parsed.type === "string" ? parsed.type : null
  if (!eventType) return null

  if (isOpenAiRealtimeForbiddenOutboundEventType(eventType)) {
    return null
  }

  if (eventType === "session.created" || eventType === "session.updated") {
    return null
  }

  if (eventType === "conversation.item.input_audio_transcription.delta") {
    const deltaEvent = parsed as OpenAiRealtimeTranscriptionDeltaEvent
    const delta = deltaEvent.delta ?? ""
    if (!delta) return null
    if (input.partialBuffer) {
      input.partialBuffer.itemId = deltaEvent.item_id ?? input.partialBuffer.itemId
      input.partialBuffer.content = `${input.partialBuffer.content}${delta}`
    }
    return {
      speaker: "rep",
      content: delta,
      timestampMs: Date.now(),
      isFinal: false,
    }
  }

  if (eventType === "conversation.item.input_audio_transcription.completed") {
    const completedEvent = parsed as OpenAiRealtimeTranscriptionCompletedEvent
    const transcript = completedEvent.transcript?.trim() ?? ""
    if (!transcript) return null
    if (input.partialBuffer) {
      input.partialBuffer.itemId = completedEvent.item_id ?? input.partialBuffer.itemId
      input.partialBuffer.content = ""
    }
    const keywords = input.keywordMatcher?.(transcript) ?? []
    return {
      speaker: "rep",
      content: transcript,
      timestampMs: Date.now(),
      isFinal: true,
      keywords: keywords.length > 0 ? keywords : undefined,
    }
  }

  return null
}

export function parseOpenAiRealtimeProviderErrorMessage(raw: string): {
  code: string
  message: string
} | null {
  try {
    const parsed = JSON.parse(raw) as OpenAiRealtimeErrorEvent
    if (parsed.type !== "error") return null
    const detail =
      parsed.error?.message ??
      parsed.error?.code ??
      parsed.error?.type ??
      "Provider stream error"
    return mapOpenAiRealtimeProviderError(detail)
  } catch {
    return null
  }
}

export function mapOpenAiRealtimeProviderError(raw: string | Error): {
  code: string
  message: string
} {
  const detail = raw instanceof Error ? raw.message : raw
  const normalized = detail.toLowerCase()

  if (
    normalized.includes("invalid model") ||
    normalized.includes("unsupported model") ||
    normalized.includes("model_not_found") ||
    (normalized.includes("model") && normalized.includes("not supported"))
  ) {
    return {
      code: "unsupported_model",
      message: "Configured OpenAI Realtime model does not support transcription-only browser streaming.",
    }
  }
  if (normalized.includes("quota") || normalized.includes("insufficient_quota")) {
    return {
      code: "provider_rate_limited",
      message: "OpenAI quota exceeded. Pause mic capture and retry shortly.",
    }
  }
  if (
    normalized.includes("malformed") ||
    normalized.includes("invalid json") ||
    normalized.includes("invalid event") ||
    normalized.includes("unknown event")
  ) {
    return {
      code: "malformed_provider_event",
      message: "Provider returned a malformed stream event. Retry mic capture when ready.",
    }
  }

  return mapLiveProviderStreamError(raw)
}
