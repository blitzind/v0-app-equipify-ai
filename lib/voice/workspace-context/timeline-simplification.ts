/** Communication timeline simplification — grouped summaries. */

import type { VoiceWorkspaceTimelineGroup } from "@/lib/voice/workspace-context/types"

export type TimelineEventLike = {
  id: string
  label: string
  eventTimestamp: string
  eventType?: string
}

export function groupTimelineEvents(events: TimelineEventLike[]): VoiceWorkspaceTimelineGroup[] {
  if (events.length === 0) return []

  const groups = new Map<string, TimelineEventLike[]>()

  for (const event of events) {
    const key = inferTimelineGroupKey(event.label)
    const bucket = groups.get(key) ?? []
    bucket.push(event)
    groups.set(key, bucket)
  }

  return [...groups.entries()].map(([groupKey, bucket]) => {
    const sorted = [...bucket].sort(
      (a, b) => new Date(a.eventTimestamp).getTime() - new Date(b.eventTimestamp).getTime(),
    )
    const latest = sorted[sorted.length - 1]
    return {
      groupKey,
      label: timelineGroupLabel(groupKey),
      eventCount: sorted.length,
      summary: sorted.length === 1 ? sorted[0]!.label : `${sorted.length} events — latest: ${latest?.label ?? ""}`,
      latestAt: latest?.eventTimestamp ?? new Date().toISOString(),
      collapsed: sorted.length > 1,
    }
  })
}

function inferTimelineGroupKey(label: string): string {
  const lower = label.toLowerCase()
  if (lower.includes("escalat")) return "escalation"
  if (lower.includes("transfer")) return "transfer"
  if (lower.includes("callback")) return "callback"
  if (lower.includes("ai") || lower.includes("receptionist")) return "ai"
  if (lower.includes("hold") || lower.includes("mute")) return "controls"
  if (lower.includes("connect") || lower.includes("ring")) return "call_lifecycle"
  return "other"
}

function timelineGroupLabel(groupKey: string): string {
  switch (groupKey) {
    case "escalation":
      return "Escalations"
    case "transfer":
      return "Transfers"
    case "callback":
      return "Callbacks"
    case "ai":
      return "AI interactions"
    case "controls":
      return "Call controls"
    case "call_lifecycle":
      return "Call lifecycle"
    default:
      return "Other events"
  }
}

export function capTimelineEvents<T>(events: T[], limit = 12): T[] {
  return events.slice(-limit)
}
