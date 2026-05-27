import type { GrowthNormalizedProviderEvent } from "@/lib/growth/webhooks/webhook-types"
import { mapWebhookEventType, pickWebhookOccurredAt, webhookAsString } from "@/lib/growth/webhooks/webhook-normalizer-utils"

export function normalizeSesWebhookPayload(payload: Record<string, unknown>): GrowthNormalizedProviderEvent {
  const notificationType = webhookAsString(payload.notificationType) || webhookAsString(payload.Type) || "unknown"
  const mail = payload.mail && typeof payload.mail === "object" ? (payload.mail as Record<string, unknown>) : {}
  const bounce = payload.bounce && typeof payload.bounce === "object" ? (payload.bounce as Record<string, unknown>) : null
  const complaint =
    payload.complaint && typeof payload.complaint === "object" ? (payload.complaint as Record<string, unknown>) : null

  let normalized = mapWebhookEventType(notificationType)
  if (bounce) normalized = "bounced"
  if (complaint) normalized = "complained"

  const bouncedRecipients =
    bounce?.bouncedRecipients && Array.isArray(bounce.bouncedRecipients)
      ? (bounce.bouncedRecipients[0] as Record<string, unknown>)
      : null

  return {
    eventType: notificationType,
    normalizedEventType: normalized,
    eventStatus: webhookAsString(bounce?.bounceType) || webhookAsString(complaint?.complaintFeedbackType) || "received",
    providerMessageId: webhookAsString(mail.messageId) || null,
    recipientEmail: webhookAsString(bouncedRecipients?.emailAddress) || null,
    occurredAt: pickWebhookOccurredAt(bounce ?? complaint ?? mail),
    providerCode: webhookAsString(bounce?.bounceType) || null,
    providerReason: webhookAsString(bounce?.bounceSubType) || webhookAsString(complaint?.complaintFeedbackType) || null,
    bounceTypeHint: webhookAsString(bounce?.bounceType) || null,
  }
}
