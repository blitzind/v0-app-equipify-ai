import type { GrowthNormalizedProviderEvent } from "@/lib/growth/webhooks/webhook-types"
import { mapWebhookEventType, pickWebhookOccurredAt, webhookAsString } from "@/lib/growth/webhooks/webhook-normalizer-utils"

export function normalizeGoogleWebhookPayload(payload: Record<string, unknown>): GrowthNormalizedProviderEvent {
  const eventType = webhookAsString(payload.eventType) || webhookAsString(payload.type) || "unknown"
  const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : payload
  return {
    eventType,
    normalizedEventType: mapWebhookEventType(eventType),
    eventStatus: webhookAsString(data.status) || "received",
    providerMessageId: webhookAsString(data.messageId) || webhookAsString(data.id) || null,
    recipientEmail: webhookAsString(data.email) || webhookAsString(data.recipient) || null,
    occurredAt: pickWebhookOccurredAt(data),
    providerReason: webhookAsString(data.reason) || webhookAsString(data.error) || null,
  }
}
