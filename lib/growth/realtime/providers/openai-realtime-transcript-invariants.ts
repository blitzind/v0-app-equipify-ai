/** Client-safe OpenAI Realtime transcript-only invariants (Growth Engine slice 6.12E). */

/** OpenAI Realtime is transcript + guidance only — never autonomous customer audio. */
export const OPENAI_REALTIME_AUTONOMOUS_AUDIO_FORBIDDEN = true

export const OPENAI_REALTIME_AUTONOMOUS_ACTIONS: string[] = []

/** Outbound provider events that must never be emitted or acted on for customer audio. */
export const OPENAI_REALTIME_FORBIDDEN_OUTBOUND_EVENT_TYPES = [
  "response.create",
  "response.cancel",
  "response.audio.delta",
  "response.audio.done",
  "response.audio_transcript.delta",
  "response.audio_transcript.done",
  "response.output_item.added",
  "response.output_item.done",
  "response.content_part.added",
  "response.content_part.done",
  "session.output_audio.delta",
  "session.output_audio.done",
  "output_audio_buffer.append",
  "output_audio_buffer.commit",
  "output_audio_buffer.clear",
] as const

export type OpenAiRealtimeForbiddenOutboundEventType =
  (typeof OPENAI_REALTIME_FORBIDDEN_OUTBOUND_EVENT_TYPES)[number]

export function isOpenAiRealtimeForbiddenOutboundEventType(
  eventType: string | null | undefined,
): eventType is OpenAiRealtimeForbiddenOutboundEventType {
  return OPENAI_REALTIME_FORBIDDEN_OUTBOUND_EVENT_TYPES.includes(
    eventType as OpenAiRealtimeForbiddenOutboundEventType,
  )
}
