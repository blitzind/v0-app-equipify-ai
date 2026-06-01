import type { VoiceMediaSessionRecord } from "@/lib/voice/media-streaming/types"

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Ring-phase media streams often stay `active` in DB while audio stops long before answer. */
export function isStaleRingPhaseMediaSession(input: {
  mediaSession: VoiceMediaSessionRecord
  answeredAtMs: number
}): boolean {
  const mediaStartedMs =
    parseTimestamp(input.mediaSession.startedAt) ?? parseTimestamp(input.mediaSession.createdAt)
  if (mediaStartedMs === null) return false
  return mediaStartedMs + 5_000 < input.answeredAtMs
}
