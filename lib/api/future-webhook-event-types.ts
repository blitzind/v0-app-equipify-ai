/**
 * Phase 61.2 — Canonical names for a **future** outbound webhook product.
 *
 * Not emitted by the app; no delivery worker; documentation and type hints only.
 * See `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md`.
 */

export const FUTURE_EQUIPIFY_WEBHOOK_EVENTS = [
  "customer.created",
  "customer.updated",
  "equipment.created",
  "equipment.updated",
  "work_order.created",
  "work_order.updated",
  "work_order.status_changed",
  "invoice.created",
  "invoice.updated",
  "invoice.paid",
  "quote.created",
  "quote.accepted",
  "quote.declined",
  "certificate.released",
  "portal.document.viewed",
  "inventory.low_stock",
  "integration.quickbooks.sync_completed",
] as const

export type FutureEquipifyWebhookEventName = (typeof FUTURE_EQUIPIFY_WEBHOOK_EVENTS)[number]
