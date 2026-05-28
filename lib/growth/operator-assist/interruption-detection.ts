/** Conversational interruption detection — transcript timing aware (Phase 2B). */

import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { GrowthRealtimeTranscriptEvent } from "@/lib/growth/realtime/realtime-call-types"
import type { ConversationalInterruptionSummary } from "@/lib/growth/operator-assist/types"

const INTERRUPTION_GAP_MS = 350
const MIN_PRIOR_UTTERANCE_MS = 400

type TranscriptTurn = {
  speaker: "operator" | "customer" | "unknown"
  text: string
  startedAtMs: number
  endedAtMs: number
}

function mapVoiceSpeaker(speakerType: string): TranscriptTurn["speaker"] {
  if (speakerType === "operator") return "operator"
  if (speakerType === "customer") return "customer"
  return "unknown"
}

function mapGrowthSpeaker(speaker: string): TranscriptTurn["speaker"] {
  if (speaker === "rep" || speaker === "operator") return "operator"
  if (speaker === "prospect" || speaker === "customer") return "customer"
  return "unknown"
}

function buildTurnsFromVoiceTranscript(transcript: VoiceCallTranscriptSnapshot): TranscriptTurn[] {
  return transcript.segments
    .map((segment) => {
      const startedAtMs = Date.parse(segment.startedAt ?? segment.createdAt ?? "")
      const endedAtMs = Date.parse(segment.endedAt ?? segment.startedAt ?? segment.createdAt ?? "")
      if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) return null
      return {
        speaker: mapVoiceSpeaker(segment.speakerType),
        text: segment.transcriptText,
        startedAtMs,
        endedAtMs,
      }
    })
    .filter((turn): turn is TranscriptTurn => Boolean(turn))
    .sort((a, b) => a.startedAtMs - b.startedAtMs)
}

function buildTurnsFromGrowthEvents(events: GrowthRealtimeTranscriptEvent[]): TranscriptTurn[] {
  return events
    .map((event) => {
      const startedAtMs =
        typeof event.timestampMs === "number" && event.timestampMs > 0
          ? event.timestampMs
          : Date.parse(event.createdAt)
      const endedAtMs = startedAtMs + Math.max(MIN_PRIOR_UTTERANCE_MS, event.content.length * 35)
      if (!Number.isFinite(startedAtMs)) return null
      return {
        speaker: mapGrowthSpeaker(event.speaker),
        text: event.content,
        startedAtMs,
        endedAtMs,
      }
    })
    .filter((turn): turn is TranscriptTurn => Boolean(turn))
    .sort((a, b) => a.startedAtMs - b.startedAtMs)
}

export function detectConversationalInterruptions(input: {
  voiceTranscript?: VoiceCallTranscriptSnapshot | null
  growthEvents?: GrowthRealtimeTranscriptEvent[]
}): ConversationalInterruptionSummary {
  const turns =
    input.voiceTranscript?.segments?.length && input.voiceTranscript.segments.length > 0
      ? buildTurnsFromVoiceTranscript(input.voiceTranscript)
      : buildTurnsFromGrowthEvents(input.growthEvents ?? [])

  let operatorInterruptions = 0
  let customerInterruptions = 0
  const recentEvents: ConversationalInterruptionSummary["recentEvents"] = []

  for (let index = 1; index < turns.length; index += 1) {
    const previous = turns[index - 1]
    const current = turns[index]
    if (previous.speaker === "unknown" || current.speaker === "unknown") continue
    if (previous.speaker === current.speaker) continue

    const priorDuration = previous.endedAtMs - previous.startedAtMs
    if (priorDuration < MIN_PRIOR_UTTERANCE_MS) continue

    const overlapMs = previous.endedAtMs - current.startedAtMs
    if (overlapMs < MIN_PRIOR_UTTERANCE_MS / 2) continue
    if (current.startedAtMs - previous.startedAtMs > INTERRUPTION_GAP_MS + priorDuration) continue

    const interruptedSpeaker = previous.speaker
    const interruptingSpeaker = current.speaker
    if (interruptingSpeaker === "operator") operatorInterruptions += 1
    if (interruptingSpeaker === "customer") customerInterruptions += 1

    recentEvents.push({
      id: `interruption:${index}:${current.startedAtMs}`,
      interruptedSpeaker,
      interruptingSpeaker,
      evidenceText: `${interruptingSpeaker === "operator" ? "Operator" : "Customer"} interrupted: “${current.text.slice(0, 120)}”`,
      occurredAt: new Date(current.startedAtMs).toISOString(),
      confidenceScore: 0.78,
    })
  }

  return {
    operatorInterruptions,
    customerInterruptions,
    totalInterruptions: operatorInterruptions + customerInterruptions,
    recentEvents: recentEvents.slice(-6),
  }
}
