import type { VoiceMediaSessionRecord } from "@/lib/voice/media-streaming/types"

function readMetadataBoolean(metadata: unknown, key: string): boolean {
  if (!metadata || typeof metadata !== "object") return false
  return (metadata as Record<string, unknown>)[key] === true
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** Only restart post-answer when the TwiML media session has explicit disconnect evidence. */
export function isDisconnectedInboundMediaSession(mediaSession: VoiceMediaSessionRecord): boolean {
  if (mediaSession.streamStatus === "failed") return true
  const metadata = mediaSession.metadataJson
  if (readMetadataBoolean(metadata, "websocketDisconnected")) return true
  if (readMetadataBoolean(metadata, "streamLifecycleDisconnected")) return true
  if (readMetadataBoolean(metadata, "stopEventReceived")) return true
  if (readMetadataString(metadata, "streamDisconnectedAt")) return true
  return false
}
