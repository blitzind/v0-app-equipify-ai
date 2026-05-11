import { createHash } from "node:crypto"

/** Connect payment lifecycle events handled under POST /api/blitzpay/webhook (Phase 2+). */
export const BLITZPAY_PHASE2_WEBHOOK_EVENT_TYPES = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "payment_intent.amount_capturable_updated",
  "checkout.session.completed",
  "charge.refunded",
  "charge.dispute.created",
])

export function isBlitzPayPhase2WebhookEventType(eventType: string): boolean {
  return BLITZPAY_PHASE2_WEBHOOK_EVENT_TYPES.has(eventType)
}

export function blitzpayWebhookPayloadSha256(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex")
}
