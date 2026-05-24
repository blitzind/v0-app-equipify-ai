/** Deterministic session timeline event IDs (Growth Engine slice 6.13A). */

import { createHash } from "node:crypto"
import type { LiveCoachingSessionTimelineEventType } from "@/lib/growth/realtime/live-coaching/session-timeline-types"

export function buildDeterministicSessionTimelineEventId(input: {
  sessionId: string
  sequenceNumber: number
  eventType: LiveCoachingSessionTimelineEventType
}): string {
  const digest = createHash("sha256")
    .update(
      `equipify:live-coaching-session-timeline:${input.sessionId}:${input.sequenceNumber}:${input.eventType}`,
    )
    .digest("hex")

  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `4${digest.slice(13, 16)}`,
    `${((parseInt(digest.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${digest.slice(18, 20)}`,
    digest.slice(20, 32),
  ].join("-")
}
