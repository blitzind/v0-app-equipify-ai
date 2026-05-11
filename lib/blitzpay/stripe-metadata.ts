import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const BLITZPAY_METADATA_PURPOSE_KEY = "purpose"
export const BLITZPAY_METADATA_PURPOSE_INVOICE = "blitzpay_invoice"
export const BLITZPAY_METADATA_ORG_ID_KEY = "organization_id"
export const BLITZPAY_METADATA_ORG_INVOICE_ID_KEY = "org_invoice_id"
export const BLITZPAY_METADATA_FEE_POLICY_VERSION_KEY = "fee_policy_version"
/** Distinguishes staff dashboard prepare vs customer portal (Phase 2C). */
export const BLITZPAY_METADATA_PAYMENT_SOURCE_KEY = "payment_source"

export type BlitzpayInvoicePaymentSource = "staff_dashboard" | "customer_portal"

export function blitzpayInvoicePaymentMetadata(input: {
  organizationId: string
  orgInvoiceId: string
  feePolicyVersion: string
  paymentSource?: BlitzpayInvoicePaymentSource
}): Record<string, string> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.orgInvoiceId, "orgInvoiceId")
  const v = input.feePolicyVersion.trim()
  if (v.length < 1 || v.length > 64) {
    throw new Error("feePolicyVersion length must be 1–64")
  }
  const src = input.paymentSource?.trim()
  if (src && src !== "staff_dashboard" && src !== "customer_portal") {
    throw new Error("paymentSource must be staff_dashboard or customer_portal")
  }
  return {
    [BLITZPAY_METADATA_PURPOSE_KEY]: BLITZPAY_METADATA_PURPOSE_INVOICE,
    [BLITZPAY_METADATA_ORG_ID_KEY]: input.organizationId,
    [BLITZPAY_METADATA_ORG_INVOICE_ID_KEY]: input.orgInvoiceId,
    [BLITZPAY_METADATA_FEE_POLICY_VERSION_KEY]: v,
    ...(src ? { [BLITZPAY_METADATA_PAYMENT_SOURCE_KEY]: src } : {}),
  }
}

export type BlitzpayInvoiceStripeMetadata = {
  organizationId: string
  orgInvoiceId: string
  feePolicyVersion: string | null
  paymentSource: BlitzpayInvoicePaymentSource | null
}

/** Accepts Stripe Metadata or a plain record (webhook / API). */
export function parseBlitzpayInvoiceMetadata(
  metadata: Record<string, string> | null | undefined,
): BlitzpayInvoiceStripeMetadata | null {
  if (!metadata) return null
  const purpose = metadata[BLITZPAY_METADATA_PURPOSE_KEY]?.trim()
  if (purpose !== BLITZPAY_METADATA_PURPOSE_INVOICE) return null
  const organizationId = metadata[BLITZPAY_METADATA_ORG_ID_KEY]?.trim() ?? ""
  const orgInvoiceId = metadata[BLITZPAY_METADATA_ORG_INVOICE_ID_KEY]?.trim() ?? ""
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(orgInvoiceId)) return null
  const feePolicyVersion = metadata[BLITZPAY_METADATA_FEE_POLICY_VERSION_KEY]?.trim() ?? null
  const psRaw = metadata[BLITZPAY_METADATA_PAYMENT_SOURCE_KEY]?.trim() ?? ""
  const paymentSource: BlitzpayInvoicePaymentSource | null =
    psRaw === "staff_dashboard" || psRaw === "customer_portal" ? psRaw : null
  return {
    organizationId,
    orgInvoiceId,
    feePolicyVersion: feePolicyVersion && feePolicyVersion.length <= 64 ? feePolicyVersion : null,
    paymentSource,
  }
}
