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
  | "voice_media_websocket_production"
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
  | "voice_browser_sync_auth_denied"
  | "voice_browser_sync_auth_success"
  | "voice_browser_sync_success"
  | "voice_browser_sync_failed"
  | "voice_browser_sync_call_selected"
  | "voice_browser_sync_timing"
  | "voice_browser_token_auth_denied"
  | "voice_browser_token_auth_success"
  | "voice_supabase_rest_anomaly"
  | "voice_supabase_rest_fetch_failed"
  | "voice_supabase_rest_query_failed"
  | "voice_growth_transcript_bridged"
  | "voice_growth_transcript_bridge_outcome"
  | "voice_growth_coaching_auto_linked"
  | "voice_growth_coaching_auto_start_failed"
  | "voice_growth_coaching_session_created"
  | "voice_growth_coaching_native_linked"
  | "voice_growth_coaching_native_link_failed"
  | "voice_growth_coaching_link_missing_after_answer"
  | "voice_growth_coaching_orphan_cleanup_failed"
  | "voice_growth_coaching_orphan_complete_failed"
  | "voice_growth_coaching_orphan_closed_fast"
  | "voice_growth_coaching_session_start_failed"
  | "voice_growth_coaching_bootstrap_failed"
  | "voice_growth_coaching_session_completed"
  | "voice_growth_coaching_orphan_completed"
  | "voice_answered_inbound_media_stream_call_sid_resolved"
  | "voice_answered_inbound_media_stream_skipped"
  | "voice_answered_inbound_media_stream_reused"
  | "voice_answered_inbound_media_stream_restart_skipped"
  | "voice_answered_inbound_media_stream_stale_stopped"
  | "voice_answered_inbound_media_stream_create_requested"
  | "voice_answered_inbound_media_stream_started"
  | "voice_answered_inbound_media_stream_failed"

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
