/** Client-safe session timeline detail sanitization (Growth Engine slice 6.13A). */

import type { LiveCoachingSessionTimelineDetail } from "@/lib/growth/realtime/live-coaching/session-timeline-types"

const BLOCKED_DETAIL_KEYS = new Set([
  "content",
  "transcript",
  "transcriptText",
  "text",
  "audio",
  "audioBase64",
  "payload",
  "payloadBase64",
  "bytes",
  "raw",
  "rawMessage",
  "message",
  "operatorPrompt",
  "recommendation",
  "title",
  "body",
])

const MAX_DETAIL_STRING_LENGTH = 120
const MAX_DETAIL_KEYS = 16

export function sanitizeSessionTimelineDetail(
  detail: Record<string, unknown>,
): LiveCoachingSessionTimelineDetail {
  const next: LiveCoachingSessionTimelineDetail = {}
  let keyCount = 0

  for (const [key, value] of Object.entries(detail)) {
    if (keyCount >= MAX_DETAIL_KEYS) break
    if (BLOCKED_DETAIL_KEYS.has(key)) continue
    if (value == null) {
      next[key] = null
      keyCount += 1
      continue
    }
    if (typeof value === "boolean") {
      next[key] = value
      keyCount += 1
      continue
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = Math.round(value * 100) / 100
      keyCount += 1
      continue
    }
    if (typeof value === "string") {
      next[key] = value.slice(0, MAX_DETAIL_STRING_LENGTH)
      keyCount += 1
    }
  }

  return next
}

export function assertSessionTimelineDetailSafe(detail: LiveCoachingSessionTimelineDetail): void {
  for (const key of Object.keys(detail)) {
    if (BLOCKED_DETAIL_KEYS.has(key)) {
      throw new Error(`session_timeline_detail_blocked_key:${key}`)
    }
  }
}

export const SESSION_TIMELINE_FORBIDDEN_PERSISTENCE_KEYS = [
  "content",
  "transcript",
  "audio",
  "payloadBase64",
] as const
