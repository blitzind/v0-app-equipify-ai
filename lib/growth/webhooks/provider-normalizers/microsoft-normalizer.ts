import type { GrowthNormalizedProviderEvent } from "@/lib/growth/webhooks/webhook-types"
import { mapWebhookEventType, pickWebhookOccurredAt, webhookAsString } from "@/lib/growth/webhooks/webhook-normalizer-utils"

export function normalizeMicrosoftWebhookPayload(payload: Record<string, unknown>): GrowthNormalizedProviderEvent {
  const events = Array.isArray(payload.value) ? payload.value : [payload]
  const first = (events[0] ?? payload) as Record<string, unknown>
  const eventType = webhookAsString(first.changeType) || webhookAsString(first.eventType) || webhookAsString(payload.eventType) || "unknown"
  const resourceData =
    first.resourceData && typeof first.resourceData === "object"
      ? (first.resourceData as Record<string, unknown>)
      : first
  return {
    eventType,
    normalizedEventType: mapWebhookEventType(eventType),
    eventStatus: webhookAsString(resourceData.status) || "received",
    providerMessageId: webhookAsString(resourceData.id) || webhookAsString(first.resource) || null,
    recipientEmail: webhookAsString(resourceData.emailAddress) || null,
    occurredAt: pickWebhookOccurredAt(first),
    providerReason: webhookAsString(resourceData.reason) || null,
  }
}
