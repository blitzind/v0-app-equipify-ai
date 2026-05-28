import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import {
  parseTwilioMediaStreamMessage,
} from "@/lib/voice/media-streaming/twilio-media-parser"
import {
  processTwilioMediaStreamMessage,
  resolveOrganizationForTwilioMediaStream,
} from "@/lib/voice/media-streaming/media-session-service"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { VOICE_MEDIA_STREAMING_QA_MARKER } from "@/lib/voice/media-streaming/types"
import { VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER } from "@/lib/voice/media-streaming/voice-stream-lifecycle"

export type VoiceMediaWebSocketLike = {
  send(data: string): void
  close(code?: number, reason?: string): void
  on(event: "message", listener: (data: string) => void): void
  on(event: "close", listener: () => void): void
}

export function attachTwilioMediaWebSocketConnection(
  admin: SupabaseClient,
  socket: VoiceMediaWebSocketLike,
): { connectionId: string } {
  const connectionId = randomUUID()
  let boundCallSid: string | null = null
  let organizationId: string | null = null
  let voiceCallId: string | null = null
  let voiceConferenceId: string | null = null

  socket.on("message", (raw) => {
    void (async () => {
      const frame = parseTwilioMediaStreamMessage(raw)
      if (!frame) return

      if (frame.event === "start") {
        boundCallSid = frame.start.callSid
        const resolved = await resolveOrganizationForTwilioMediaStream(admin, { callSid: boundCallSid })
        if (!resolved) {
          socket.close(1008, "organization_unresolved")
          return
        }
        organizationId = resolved.organizationId
        voiceCallId = resolved.voiceCallId
        voiceConferenceId = resolved.voiceConferenceId
      }

      if (!organizationId || !voiceCallId) return

      const result = await processTwilioMediaStreamMessage(admin, {
        connectionId,
        organizationId,
        voiceCallId,
        voiceConferenceId,
        frame,
      })

      logVoiceInfrastructure("voice_media_websocket_frame", {
        qaMarker: VOICE_MEDIA_STREAMING_QA_MARKER,
        foundationMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
        event: frame.event,
        ok: result.ok,
        connectionId,
      })
    })().catch((error) => {
      logVoiceInfrastructure("voice_media_websocket_error", {
        connectionId,
        message: error instanceof Error ? error.message : "unknown",
      })
    })
  })

  socket.on("close", () => {
    logVoiceInfrastructure("voice_stream_disconnected", {
      qaMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      connectionId,
    })
  })

  return { connectionId }
}
