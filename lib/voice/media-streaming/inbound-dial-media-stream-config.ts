/** Inbound dial media stream gating — shared by Growth inbound and legacy Twilio incoming routes. */

import { resolveConfiguredTranscriptProviderKind } from "@/lib/voice/transcripts/providers/types"

export function shouldEnableInboundDialMediaStream(): boolean {
  const explicit = process.env.TWILIO_VOICE_INCOMING_STREAM_ENABLED?.trim()
  if (explicit === "false") return false
  if (explicit === "true") return true
  if (process.env.DEEPGRAM_API_KEY?.trim()) return true
  if (process.env.ASSEMBLYAI_API_KEY?.trim()) return true
  const provider = resolveConfiguredTranscriptProviderKind()
  return provider !== "stub" && provider !== "none"
}
