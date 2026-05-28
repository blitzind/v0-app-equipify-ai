/** Transcript provider abstraction — Phase 1F (provider-agnostic). */

import type {
  VoiceSpeakerType,
  VoiceTranscriptProviderKind,
  VoiceTranscriptSessionStatus,
} from "@/lib/voice/media-streaming/types"

export type NormalizedTranscriptEvent = {
  speakerIdentity: string
  speakerType: VoiceSpeakerType
  transcriptText: string
  confidenceScore: number | null
  startedAt: string | null
  endedAt: string | null
  isFinal: boolean
  providerEventId?: string
  metadata?: Record<string, unknown>
}

export type TranscriptProviderStartInput = {
  mediaSessionId: string
  voiceCallId: string
  organizationId: string
  locale?: string
}

export type TranscriptProviderStartResult = {
  ok: boolean
  providerSessionRef: string | null
  message: string
}

export type TranscriptProviderAppendResult = {
  ok: boolean
  normalized: NormalizedTranscriptEvent | null
  message: string
}

export type TranscriptProviderFinalizeResult = {
  ok: boolean
  finalStatus: VoiceTranscriptSessionStatus
  message: string
}

export interface VoiceTranscriptProvider {
  kind: VoiceTranscriptProviderKind
  displayName: string
  stubMode: boolean
  startTranscriptSession(input: TranscriptProviderStartInput): Promise<TranscriptProviderStartResult>
  appendTranscriptSegment(
    providerSessionRef: string,
    rawEvent: unknown,
  ): Promise<TranscriptProviderAppendResult>
  finalizeTranscript(providerSessionRef: string): Promise<TranscriptProviderFinalizeResult>
  mapSpeaker(rawSpeaker: unknown): { speakerIdentity: string; speakerType: VoiceSpeakerType }
  normalizeTranscriptEvent(rawEvent: unknown): NormalizedTranscriptEvent | null
}

export function resolveConfiguredTranscriptProviderKind(): VoiceTranscriptProviderKind {
  const configured = process.env.VOICE_TRANSCRIPT_PROVIDER?.trim().toLowerCase()
  if (configured === "deepgram" && process.env.DEEPGRAM_API_KEY?.trim()) return "deepgram"
  if (configured === "assemblyai" && process.env.ASSEMBLYAI_API_KEY?.trim()) return "assemblyai"
  if (configured === "openai_realtime" && process.env.OPENAI_API_KEY?.trim()) return "openai_realtime"
  if (configured === "none") return "none"
  return "stub"
}
