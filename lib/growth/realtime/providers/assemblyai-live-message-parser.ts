import type { RealtimeTranscriptChunk } from "@/lib/growth/realtime/providers/provider-types"
import { mapLiveProviderStreamError } from "@/lib/growth/realtime/providers/live-provider-stream-error-mapper"

type AssemblyAiV3TurnMessage = {
  type?: string
  transcript?: string
  end_of_turn?: boolean
  turn_order?: number
  words?: Array<{ text?: string; start?: number; end?: number; confidence?: number; speaker?: string }>
  audio_start?: number
  audio_end?: number
}

type AssemblyAiV2TranscriptMessage = {
  message_type?: string
  text?: string
  created?: string
  confidence?: number
  audio_start?: number
  audio_end?: number
}

type AssemblyAiErrorMessage = {
  type?: string
  error?: string
  message?: string
}

export function parseAssemblyAiLiveTranscriptMessage(
  raw: string,
  input: {
    keywordMatcher?: (content: string) => string[]
    speakerSeparationEnabled?: boolean
  } = {},
): RealtimeTranscriptChunk | null {
  let parsed: AssemblyAiV3TurnMessage | AssemblyAiV2TranscriptMessage | AssemblyAiErrorMessage
  try {
    parsed = JSON.parse(raw) as AssemblyAiV3TurnMessage | AssemblyAiV2TranscriptMessage | AssemblyAiErrorMessage
  } catch {
    return null
  }

  if (parsed.type === "Begin" || parsed.type === "Termination") {
    return null
  }

  if (parsed.type === "Error") {
    return null
  }

  if (parsed.type === "Turn") {
    return parseAssemblyAiTurnMessage(parsed as AssemblyAiV3TurnMessage, input)
  }

  const legacy = parsed as AssemblyAiV2TranscriptMessage
  if (legacy.message_type === "PartialTranscript" || legacy.message_type === "FinalTranscript") {
    return parseAssemblyAiLegacyTranscriptMessage(legacy, input)
  }

  return null
}

export function parseAssemblyAiProviderErrorMessage(raw: string): { code: string; message: string } | null {
  try {
    const parsed = JSON.parse(raw) as AssemblyAiErrorMessage
    if (parsed.type !== "Error") return null
    const detail = parsed.error ?? parsed.message ?? "Provider stream error"
    return mapAssemblyAiProviderError(detail)
  } catch {
    return null
  }
}

function parseAssemblyAiTurnMessage(
  parsed: AssemblyAiV3TurnMessage,
  input: {
    keywordMatcher?: (content: string) => string[]
    speakerSeparationEnabled?: boolean
  },
): RealtimeTranscriptChunk | null {
  const transcript = parsed.transcript?.trim() ?? ""
  if (!transcript) return null

  const isFinal = Boolean(parsed.end_of_turn)
  const speaker = resolveAssemblyAiSpeaker(parsed.words, input.speakerSeparationEnabled)
  const timestampMs = Math.round((parsed.audio_start ?? 0) * 1000)
  const confidence = resolveAssemblyAiConfidence(parsed.words)
  const keywords = isFinal ? (input.keywordMatcher?.(transcript) ?? []) : []

  return {
    speaker,
    content: transcript,
    timestampMs,
    isFinal,
    confidence,
    keywords: keywords.length > 0 ? keywords : undefined,
  }
}

function parseAssemblyAiLegacyTranscriptMessage(
  parsed: AssemblyAiV2TranscriptMessage,
  input: {
    keywordMatcher?: (content: string) => string[]
    speakerSeparationEnabled?: boolean
  },
): RealtimeTranscriptChunk | null {
  const transcript = parsed.text?.trim() ?? ""
  if (!transcript) return null

  const isFinal = parsed.message_type === "FinalTranscript"
  const timestampMs = Math.round((parsed.audio_start ?? 0) * 1000)
  const confidence =
    parsed.confidence !== undefined ? Math.round(parsed.confidence * 100) : undefined
  const keywords = isFinal ? (input.keywordMatcher?.(transcript) ?? []) : []

  return {
    speaker: input.speakerSeparationEnabled ? "rep" : "rep",
    content: transcript,
    timestampMs,
    isFinal,
    confidence,
    keywords: keywords.length > 0 ? keywords : undefined,
  }
}

function resolveAssemblyAiSpeaker(
  words: Array<{ speaker?: string }> | undefined,
  speakerSeparationEnabled?: boolean,
): RealtimeTranscriptChunk["speaker"] {
  if (!speakerSeparationEnabled || !words?.length) return "rep"
  const speakerLabel = words.find((word) => word.speaker)?.speaker?.toLowerCase()
  if (!speakerLabel) return "rep"
  if (speakerLabel.includes("a") || speakerLabel.includes("0") || speakerLabel.includes("rep")) {
    return "rep"
  }
  return "prospect"
}

function resolveAssemblyAiConfidence(
  words: Array<{ confidence?: number }> | undefined,
): number | undefined {
  if (!words?.length) return undefined
  const scored = words.filter((word) => word.confidence !== undefined)
  if (!scored.length) return undefined
  const average = scored.reduce((sum, word) => sum + (word.confidence ?? 0), 0) / scored.length
  return Math.round(average * 100)
}

export function mapAssemblyAiProviderError(raw: string | Error): {
  code: string
  message: string
} {
  return mapLiveProviderStreamError(raw)
}
