import type { RealtimeTranscriptChunk } from "@/lib/growth/realtime/providers/provider-types"
import { mapLiveProviderStreamError } from "@/lib/growth/realtime/providers/live-provider-stream-error-mapper"

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
  return mapLiveProviderStreamError(raw)
}
