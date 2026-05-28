import type { NormalizedVoiceWebhookEvent } from "@/lib/voice/providers/types"
import { VOICE_WEBHOOK_INGESTION_QA_MARKER } from "@/lib/voice/types"

export { VOICE_WEBHOOK_INGESTION_QA_MARKER }

export type VoiceWebhookIngestResult =
  | {
      ok: true
      duplicate: boolean
      voiceCallId: string | null
      voiceConversationId?: string | null
      normalizedEvent: NormalizedVoiceWebhookEvent
    }
  | {
      ok: false
      code:
        | "invalid_payload"
        | "signature_failed"
        | "schema_not_ready"
        | "organization_unresolved"
        | "persistence_failed"
      message: string
    }

export const VOICE_WEBHOOK_EVENT_TYPES = [
  "initiated",
  "ringing",
  "answered",
  "completed",
  "failed",
  "voicemail",
  "recording-ready",
] as const

export type VoiceWebhookNormalizedEventType = (typeof VOICE_WEBHOOK_EVENT_TYPES)[number]

export function mapProviderEventToCanonicalType(
  providerStatus: string | null | undefined,
): VoiceWebhookNormalizedEventType | string {
  const normalized = (providerStatus ?? "unknown").trim().toLowerCase()
  switch (normalized) {
    case "initiated":
    case "queued":
      return "initiated"
    case "ringing":
      return "ringing"
    case "in-progress":
    case "in_progress":
    case "answered":
      return "answered"
    case "completed":
      return "completed"
    case "failed":
    case "busy":
    case "no-answer":
    case "no_answer":
    case "canceled":
    case "cancelled":
      return "failed"
    case "voicemail":
      return "voicemail"
    default:
      if (normalized.includes("recording")) return "recording-ready"
      return normalized || "unknown"
  }
}
