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
