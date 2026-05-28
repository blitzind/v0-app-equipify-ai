import type { NormalizedVoiceWebhookEvent } from "@/lib/voice/providers/types"
import { mapProviderEventToCanonicalType } from "@/lib/voice/webhooks/types"

export function normalizeVoiceWebhookEvent(
  event: NormalizedVoiceWebhookEvent,
): NormalizedVoiceWebhookEvent & { canonicalEventType: string } {
  return {
    ...event,
    canonicalEventType: mapProviderEventToCanonicalType(event.providerStatus ?? event.eventType),
  }
}

export function parseTwilioFormBody(rawBody: string): Record<string, string> {
  const params = new URLSearchParams(rawBody)
  const out: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    out[key] = value
  }
  return out
}

export function twilioFormBodyToPayload(params: Record<string, string>): Record<string, unknown> {
  return { ...params }
}
