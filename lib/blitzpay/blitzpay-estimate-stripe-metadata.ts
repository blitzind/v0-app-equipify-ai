import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  BLITZPAY_METADATA_FEE_POLICY_VERSION_KEY,
  BLITZPAY_METADATA_ORG_ID_KEY,
  BLITZPAY_METADATA_PAYMENT_SOURCE_KEY,
  BLITZPAY_METADATA_PURPOSE_KEY,
} from "@/lib/blitzpay/stripe-metadata"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const BLITZPAY_METADATA_PURPOSE_ESTIMATE = "blitzpay_estimate_deposit"
export const BLITZPAY_METADATA_ORG_QUOTE_ID_KEY = "org_quote_id"
/** Amount toward the estimate (deposit or full prepay), cents, for reconciliation. */
export const BLITZPAY_METADATA_QUOTE_PAY_CENTS_KEY = "quote_pay_cents"

export type BlitzpayEstimatePaymentSource = "staff_dashboard" | "customer_portal"

export function blitzpayEstimateDepositMetadata(input: {
  organizationId: string
  orgQuoteId: string
  feePolicyVersion: string
  paymentSource?: BlitzpayEstimatePaymentSource
  quotePayCents: number
}): Record<string, string> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.orgQuoteId, "orgQuoteId")
  const v = input.feePolicyVersion.trim()
  if (v.length < 1 || v.length > 64) {
    throw new Error("feePolicyVersion length must be 1–64")
  }
  if (!Number.isInteger(input.quotePayCents) || input.quotePayCents < 50) {
    throw new Error("quotePayCents must be an integer >= 50 (Stripe USD minimum).")
  }
  const src = input.paymentSource?.trim()
  if (src && src !== "staff_dashboard" && src !== "customer_portal") {
    throw new Error("paymentSource must be staff_dashboard or customer_portal")
  }
  return {
    [BLITZPAY_METADATA_PURPOSE_KEY]: BLITZPAY_METADATA_PURPOSE_ESTIMATE,
    [BLITZPAY_METADATA_ORG_ID_KEY]: input.organizationId,
    [BLITZPAY_METADATA_ORG_QUOTE_ID_KEY]: input.orgQuoteId,
    [BLITZPAY_METADATA_FEE_POLICY_VERSION_KEY]: v,
    [BLITZPAY_METADATA_QUOTE_PAY_CENTS_KEY]: String(input.quotePayCents),
    ...(src ? { [BLITZPAY_METADATA_PAYMENT_SOURCE_KEY]: src } : {}),
  }
}

export type BlitzpayEstimateStripeMetadata = {
  organizationId: string
  orgQuoteId: string
  feePolicyVersion: string | null
  paymentSource: BlitzpayEstimatePaymentSource | null
  quotePayCents: number
}

export function parseBlitzpayEstimateMetadata(
  metadata: Record<string, string> | null | undefined,
): BlitzpayEstimateStripeMetadata | null {
  if (!metadata) return null
  const purpose = metadata[BLITZPAY_METADATA_PURPOSE_KEY]?.trim()
  if (purpose !== BLITZPAY_METADATA_PURPOSE_ESTIMATE) return null
  const organizationId = metadata[BLITZPAY_METADATA_ORG_ID_KEY]?.trim() ?? ""
  const orgQuoteId = metadata[BLITZPAY_METADATA_ORG_QUOTE_ID_KEY]?.trim() ?? ""
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(orgQuoteId)) return null
  const feePolicyVersion = metadata[BLITZPAY_METADATA_FEE_POLICY_VERSION_KEY]?.trim() ?? null
  const psRaw = metadata[BLITZPAY_METADATA_PAYMENT_SOURCE_KEY]?.trim() ?? ""
  const paymentSource: BlitzpayEstimatePaymentSource | null =
    psRaw === "staff_dashboard" || psRaw === "customer_portal" ? psRaw : null
  const payRaw = metadata[BLITZPAY_METADATA_QUOTE_PAY_CENTS_KEY]?.trim() ?? ""
  const quotePayCents = Math.round(Number(payRaw))
  if (!Number.isFinite(quotePayCents) || quotePayCents < 50) return null
  return {
    organizationId,
    orgQuoteId,
    feePolicyVersion: feePolicyVersion && feePolicyVersion.length <= 64 ? feePolicyVersion : null,
    paymentSource,
    quotePayCents,
  }
}
