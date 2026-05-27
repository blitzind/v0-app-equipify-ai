import type { GrowthNormalizedProviderEvent } from "@/lib/growth/webhooks/webhook-types"
import { mapWebhookEventType, pickWebhookOccurredAt, webhookAsString } from "@/lib/growth/webhooks/webhook-normalizer-utils"

export function normalizeSmtpWebhookPayload(payload: Record<string, unknown>): GrowthNormalizedProviderEvent {
  const eventType = webhookAsString(payload.event) || webhookAsString(payload.event_type) || webhookAsString(payload.type) || "unknown"
  return {
    eventType,
    normalizedEventType: mapWebhookEventType(eventType),
    eventStatus: webhookAsString(payload.status) || "received",
    providerMessageId: webhookAsString(payload.message_id) || webhookAsString(payload.messageId) || null,
    recipientEmail: webhookAsString(payload.recipient) || webhookAsString(payload.email) || null,
    occurredAt: pickWebhookOccurredAt(payload),
    providerCode: webhookAsString(payload.code) || null,
    providerReason: webhookAsString(payload.reason) || webhookAsString(payload.error) || null,
    bounceTypeHint: webhookAsString(payload.bounce_type) || null,
  }
}
