import type { GrowthNormalizedProviderEvent } from "@/lib/growth/webhooks/webhook-types"
import { mapWebhookEventType, pickWebhookOccurredAt, webhookAsString } from "@/lib/growth/webhooks/webhook-normalizer-utils"

export function normalizeResendWebhookPayload(payload: Record<string, unknown>): GrowthNormalizedProviderEvent {
  const eventType = webhookAsString(payload.type) || webhookAsString(payload.event) || "unknown"
  const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : payload
  return {
    eventType,
    normalizedEventType: mapWebhookEventType(eventType),
    eventStatus: webhookAsString(data.status) || "received",
    providerMessageId: webhookAsString(data.email_id) || webhookAsString(data.id) || null,
    recipientEmail: webhookAsString(data.to) || webhookAsString(data.email) || null,
    occurredAt: pickWebhookOccurredAt(data),
    providerReason: webhookAsString(data.reason) || webhookAsString(data.error) || null,
    destinationUrl: webhookAsString(data.link) || webhookAsString(data.url) || null,
  }
}
