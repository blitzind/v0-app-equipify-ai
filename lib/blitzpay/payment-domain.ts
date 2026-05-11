/** Stripe PaymentIntent.status mirror values we persist (extend as product needs). */
export const BLITZPAY_PAYMENT_INTENT_STATUSES = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "succeeded",
  "canceled",
] as const

export type BlitzpayPaymentIntentStatus = (typeof BLITZPAY_PAYMENT_INTENT_STATUSES)[number]

export function isBlitzpayPaymentIntentStatus(value: string): value is BlitzpayPaymentIntentStatus {
  return (BLITZPAY_PAYMENT_INTENT_STATUSES as readonly string[]).includes(value)
}

export const BLITZPAY_INVOICE_PAY_ATTEMPT_STATUSES = [
  "initiated",
  "redirected",
  "completed",
  "failed",
  "expired",
] as const

export type BlitzpayInvoicePaymentAttemptStatus = (typeof BLITZPAY_INVOICE_PAY_ATTEMPT_STATUSES)[number]

export const BLITZPAY_INVOICE_PAY_CHANNELS = ["checkout", "payment_element", "portal_link"] as const

export type BlitzpayInvoicePayChannel = (typeof BLITZPAY_INVOICE_PAY_CHANNELS)[number]

export const BLITZPAY_LEDGER_ENTRY_TYPES = [
  "payment_captured",
  "application_fee_received",
  "refund",
  "chargeback",
  "adjustment",
] as const

export type BlitzpayLedgerEntryType = (typeof BLITZPAY_LEDGER_ENTRY_TYPES)[number]

export const BLITZPAY_CONVENIENCE_FEE_MODES = [
  "none",
  "pass_stripe_cost_estimate",
  "fixed_cents",
  "bps",
] as const

export type BlitzpayConvenienceFeeMode = (typeof BLITZPAY_CONVENIENCE_FEE_MODES)[number]

export const BLITZPAY_WEBHOOK_INBOX_STATUSES = ["pending", "processing", "done", "dead"] as const

export type BlitzpayWebhookInboxStatus = (typeof BLITZPAY_WEBHOOK_INBOX_STATUSES)[number]

export const DEFAULT_BLITZPAY_FEE_POLICY_VERSION = "blitzpay_fees_v1"

export type BlitzpayFeeSnapshotRow = {
  id: string
  organization_id: string
  blitzpay_payment_intent_id: string
  platform_fee_bps: number
  platform_fee_fixed_cents: number
  convenience_fee_bps: number
  convenience_fee_fixed_cents: number
  stripe_fee_estimate_cents: number | null
  computed_total_application_fee_cents: string
  policy_version: string
  created_at: string
}

export type BlitzpayLedgerEntryRow = {
  id: string
  organization_id: string
  entry_type: BlitzpayLedgerEntryType
  amount_cents: string
  currency: string
  stripe_object_id: string | null
  blitzpay_payment_intent_id: string | null
  org_invoice_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}
