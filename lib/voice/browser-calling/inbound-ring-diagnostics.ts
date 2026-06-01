/** Temporary production-safe inbound ring path diagnostics — filter: voice-inbound-ring-diag */

export const INBOUND_RING_DIAG_SOURCE = "voice-inbound-ring-diag" as const
export const INBOUND_RING_DIAG_QA_MARKER = "voice-inbound-ring-diag-v1" as const

export const INBOUND_RING_DIAG_EVENTS = {
  TWILIO_WEBHOOK_RECEIVED: "inbound_ring_twilio_webhook_received",
  VOICE_CALL_CREATED: "inbound_ring_voice_call_created",
  NATIVE_SESSION_CREATED: "inbound_ring_native_session_created",
  BROWSER_SYNC_INBOUND_RINGING: "inbound_ring_browser_sync_inbound_ringing",
  INBOUND_OFFER_RECEIVED: "inbound_offer_received",
  INBOUND_OFFER_RENDERED: "inbound_offer_rendered",
  INBOUND_OFFER_CLEARED: "inbound_offer_cleared",
  INBOUND_OFFER_LATENCY_MS: "inbound_offer_latency_ms",
  SDK_INCOMING_RECEIVED: "sdk_incoming_received",
  SDK_INCOMING_CANCELLED: "sdk_incoming_cancelled",
  ANSWER_BUTTON_MOUNTED: "inbound_ring_answer_button_mounted",
  DECLINE_API_CALLED: "inbound_ring_decline_api_called",
} as const

export type InboundRingDiagEvent =
  (typeof INBOUND_RING_DIAG_EVENTS)[keyof typeof INBOUND_RING_DIAG_EVENTS]

export function inboundRingElapsedMs(
  voiceCallCreatedAt: string | null | undefined,
  atMs: number = Date.now(),
): number | null {
  if (!voiceCallCreatedAt) return null
  const originMs = Date.parse(voiceCallCreatedAt)
  if (Number.isNaN(originMs)) return null
  return Math.max(0, atMs - originMs)
}

export function logInboundRingDiagnostic(
  event: InboundRingDiagEvent,
  details: Record<string, unknown>,
): void {
  if (typeof console === "undefined") return
  console.info(
    JSON.stringify({
      source: INBOUND_RING_DIAG_SOURCE,
      qaMarker: INBOUND_RING_DIAG_QA_MARKER,
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

export function withInboundRingElapsed(
  voiceCallCreatedAt: string | null | undefined,
  details: Record<string, unknown>,
  atMs?: number,
): Record<string, unknown> {
  const elapsedMs = inboundRingElapsedMs(voiceCallCreatedAt, atMs)
  if (elapsedMs === null) return details
  return {
    ...details,
    voice_call_created_at: voiceCallCreatedAt,
    elapsed_ms_since_voice_call_created: elapsedMs,
  }
}
