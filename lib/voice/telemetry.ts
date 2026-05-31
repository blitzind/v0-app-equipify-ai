import "server-only"

import { VOICE_FOUNDATION_QA_MARKER } from "@/lib/voice/types"

export type VoiceTelemetryEvent =
  | "voice_webhook_received"
  | "voice_webhook_signature_failed"
  | "voice_webhook_idempotent_skip"
  | "voice_webhook_ingested"
  | "voice_webhook_ingestion_failed"
  | "voice_call_lifecycle_transition"
  | "voice_provider_health"
  | "voice_schema_probe"
  | "voice_inbound_route_decision"
  | "voice_recording_callback_received"
  | "voice_recording_callback_stored"
  | "voice_transfer_started"
  | "voice_transfer_completed"
  | "voice_transfer_canceled"
  | "voice_supervisor_joined"
  | "voice_participant_hold"
  | "voice_participant_mute"
  | "twilio_voice_incoming_webhook"
  | "twilio_voice_incoming_webhook_failed"
  | "voice_media_stream_frame_processed"
  | "voice_media_websocket_frame"
  | "voice_media_websocket_error"
  | "voice_media_websocket_closed"
  | "voice_media_stream_started"
  | "voice_media_stream_stopped"
  | "voice_stream_lifecycle_transition"
  | "voice_stream_connected"
  | "voice_stream_disconnected"
  | "voice_transcript_started"
  | "voice_transcript_interim"
  | "voice_transcript_failed"
  | "voice_deepgram_stream_open"
  | "voice_deepgram_stream_closed"
  | "voice_deepgram_stream_reconnect"
  | "voice_conversation_intelligence_failed"
  | "voice_browser_token_issued"
  | "voice_browser_token_mint_diagnostics"

export function logVoiceInfrastructure(
  event: VoiceTelemetryEvent,
  details: Record<string, unknown>,
): void {
  console.info(
    JSON.stringify({
      source: "voice-infrastructure",
      qaMarker: VOICE_FOUNDATION_QA_MARKER,
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}
