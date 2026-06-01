/** Customer/prospect turn detection for live coaching refresh (client-safe). */

import type { ConversationCoachTurn } from "@/lib/growth/live-coaching/types"
import type { GrowthRealtimeTranscriptEvent } from "@/lib/growth/realtime/realtime-call-types"

export function lastProspectTranscriptEvent(
  events: GrowthRealtimeTranscriptEvent[],
): GrowthRealtimeTranscriptEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.speaker === "prospect") return events[index]!
  }
  return null
}

export function lastProspectSequence(events: GrowthRealtimeTranscriptEvent[]): number | null {
  return lastProspectTranscriptEvent(events)?.sequenceNumber ?? null
}

/**
 * When diarization fails, customer speech may land on rep-labeled events.
 * Use the latest rep utterance only while bootstrap is still active and no prospect events exist.
 */
export function lastCustomerFacingTranscriptEvent(
  events: GrowthRealtimeTranscriptEvent[],
  input?: { previousCoach?: ConversationCoachTurn | null },
): GrowthRealtimeTranscriptEvent | null {
  const prospect = lastProspectTranscriptEvent(events)
  if (prospect) return prospect

  const hasProspectLabeledEvent = events.some((event) => event.speaker === "prospect")
  if (hasProspectLabeledEvent) return null

  const bootstrapStillActive = input?.previousCoach?.triggeredBySequenceNumber === null
  if (!bootstrapStillActive) return null

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event?.speaker === "rep" && event.content.trim()) {
      return event
    }
  }

  return null
}

export function lastCustomerFacingSequence(
  events: GrowthRealtimeTranscriptEvent[],
  previousCoach?: ConversationCoachTurn | null,
): number | null {
  return lastCustomerFacingTranscriptEvent(events, { previousCoach })?.sequenceNumber ?? null
}

export function shouldRefreshCoachForCustomerSpeech(input: {
  events: GrowthRealtimeTranscriptEvent[]
  previousCoach: ConversationCoachTurn | null | undefined
}): boolean {
  if (input.events.length === 0) return !input.previousCoach
  const lastCustomerSeq = lastCustomerFacingSequence(input.events, input.previousCoach)
  if (lastCustomerSeq === null) return false
  if (!input.previousCoach) return true
  if (input.previousCoach.triggeredBySequenceNumber === null) return true
  return lastCustomerSeq > input.previousCoach.triggeredBySequenceNumber
}
