/** Deterministic relationship timeline builder. */

import type {
  VoiceRelationshipMemoryEventPublicView,
  VoiceRelationshipTimelineItem,
} from "@/lib/voice/relationship-memory/types"

export function buildRelationshipTimeline(input: {
  memoryEvents: VoiceRelationshipMemoryEventPublicView[]
  callSummaries?: Array<{
    voiceCallId: string
    startedAt: string | null
    endedAt: string | null
    direction: string
    durationSeconds: number
  }>
  transferEvents?: Array<{
    id: string
    voiceCallId: string
    occurredAt: string
    label: string
  }>
  limit?: number
}): VoiceRelationshipTimelineItem[] {
  const items: VoiceRelationshipTimelineItem[] = []

  for (const call of input.callSummaries ?? []) {
    items.push({
      id: `call:${call.voiceCallId}`,
      occurredAt: call.startedAt ?? call.endedAt ?? new Date().toISOString(),
      kind: "call",
      title: `${call.direction === "inbound" ? "Inbound" : "Outbound"} call`,
      evidenceText: `${call.durationSeconds}s talk time`,
      sourceVoiceCallId: call.voiceCallId,
      filterTags: ["calls"],
    })
  }

  for (const transfer of input.transferEvents ?? []) {
    items.push({
      id: `transfer:${transfer.id}`,
      occurredAt: transfer.occurredAt,
      kind: "transfer",
      title: "Call transfer",
      evidenceText: transfer.label,
      sourceVoiceCallId: transfer.voiceCallId,
      filterTags: ["transfers"],
    })
  }

  for (const event of input.memoryEvents) {
    const kind =
      event.memoryType.includes("objection") || event.memoryType === "budget_concern"
        ? "objection"
        : event.memoryType === "booking_interest" || event.memoryType === "urgency_signal"
          ? "buying_signal"
          : event.memoryType === "cancellation_risk" || event.memoryType === "escalation_pattern"
            ? "risk"
            : "memory_event"

    items.push({
      id: `memory:${event.id}`,
      occurredAt: event.createdAt,
      kind,
      title: event.memoryType.replace(/_/g, " "),
      evidenceText: event.evidenceText,
      sourceVoiceCallId: event.sourceVoiceCallId,
      filterTags: [kind, event.memoryType],
    })
  }

  const limit = input.limit ?? 24
  return items
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit)
}

export function filterRelationshipTimeline(
  items: VoiceRelationshipTimelineItem[],
  filter: "all" | "objections" | "buying_signals" | "calls" | "memory",
): VoiceRelationshipTimelineItem[] {
  if (filter === "all") return items
  if (filter === "objections") return items.filter((item) => item.kind === "objection")
  if (filter === "buying_signals") return items.filter((item) => item.kind === "buying_signal")
  if (filter === "calls") return items.filter((item) => item.kind === "call")
  return items.filter((item) => item.kind === "memory_event")
}
