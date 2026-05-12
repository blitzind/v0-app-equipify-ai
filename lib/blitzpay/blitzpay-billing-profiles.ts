import { createHash } from "node:crypto"

/** Bounded list caps for Phase 2AA reads (org staff + reporting). */
export const BLITZPAY_BILLING_PROFILE_LIST_CAP = 80
export const BLITZPAY_PAYMENT_METHOD_LIST_CAP = 200
export const BLITZPAY_AUTOPAY_LIST_CAP = 120
export const BLITZPAY_PHASE_2AA_REPORTING_PROFILE_CAP = 400

const STRIPE_REF_PEPPER = process.env.BLITZPAY_STRIPE_REF_PEPPER ?? "blitzpay_ref_pepper_dev_only"

export type BillingProfileStatus = "active" | "inactive" | "delinquent" | "archived"
export type PaymentMethodRowStatus = "active" | "expired" | "removed"
export type AutopayEnrollmentStatus = "active" | "paused" | "canceled" | "failed"
export type AutopayEnrollmentSource = "admin" | "customer" | "imported" | "system"
export type PreferredInvoiceDelivery = "email" | "sms" | "manual" | "portal"
export type PaymentTiming = "invoice_due" | "invoice_sent" | "scheduled"

export type AutopayReadinessState =
  | "ready"
  | "needs_payment_method"
  | "needs_enrollment"
  | "paused"
  | "blocked_delinquent"
  | "archived"

export type BillingRiskBand = "low" | "watch" | "elevated"

export type CollectionReadiness = "ready" | "partial" | "not_ready"

/** Deterministic SHA-256 reference fingerprint — never store raw Stripe object ids in DB or API payloads. */
export function hashStripeReference(stripeObjectId: string): string {
  const id = String(stripeObjectId || "").trim()
  return createHash("sha256").update(STRIPE_REF_PEPPER).update("|").update(id).digest("hex")
}

export function formatMaskedPaymentMethodLabel(input: {
  paymentMethodType: string
  displayBrand: string | null
  displayLast4: string | null
}): string {
  const t = String(input.paymentMethodType || "").toLowerCase()
  const brand = (input.displayBrand || "").trim() || (t === "bank_account" || t === "us_bank_account" ? "Bank account" : "Card")
  const last4 = (input.displayLast4 || "").trim()
  if (last4.length >= 2) return `${brand} ending in ${last4}`
  return `${brand} on file`
}

export function computeAutopayReadinessState(args: {
  profileStatus: BillingProfileStatus
  autopayEnabled: boolean
  enrollmentStatus: AutopayEnrollmentStatus | null
  hasActivePaymentMethod: boolean
}): AutopayReadinessState {
  if (args.profileStatus === "archived") return "archived"
  if (args.profileStatus === "delinquent") return "blocked_delinquent"
  if (!args.autopayEnabled) return "needs_enrollment"
  if (args.enrollmentStatus === "paused") return "paused"
  if (args.enrollmentStatus === "failed" || args.enrollmentStatus === "canceled") return "needs_enrollment"
  if (!args.hasActivePaymentMethod) return "needs_payment_method"
  if (args.enrollmentStatus === "active") return "ready"
  return "needs_enrollment"
}

export function computeBillingRiskIndicator(profileStatus: BillingProfileStatus): BillingRiskBand {
  if (profileStatus === "delinquent") return "elevated"
  if (profileStatus === "inactive") return "watch"
  return "low"
}

export function computeInvoiceCollectionReadiness(args: {
  profileStatus: BillingProfileStatus
  preferredDelivery: PreferredInvoiceDelivery
  hasActivePaymentMethod: boolean
  autopayReadiness: AutopayReadinessState
}): CollectionReadiness {
  if (args.profileStatus === "archived" || args.profileStatus === "delinquent") return "not_ready"
  if (args.autopayReadiness === "ready") return "ready"
  if (args.hasActivePaymentMethod || args.preferredDelivery === "portal") return "partial"
  return "not_ready"
}

/** Strip any value that looks like a Stripe id from a shallow object (defense in depth for API responses). */
export function redactStripeLikeStrings<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row } as Record<string, unknown>
  const stripeLike = /^(cus_|pm_|card_|ba_|sub_|seti_|pi_|acct_)[A-Za-z0-9]+$/i
  for (const k of Object.keys(out)) {
    const v = out[k]
    if (typeof v === "string" && stripeLike.test(v.trim())) {
      delete out[k]
    }
  }
  return out as T
}

export function phase2aaReportingRates(args: {
  profileCount: number
  profilesWithActiveAutopayEnrollment: number
  profilesWithSavedMethod: number
  profilesBillingReady: number
  delinquentProfileCount: number
}): {
  autopayEnrollmentRate: number
  savedPaymentMethodRate: number
  billingReadinessRate: number
  delinquencyRiskRate: number
} {
  const n = Math.max(0, args.profileCount)
  const base = Math.max(n, 1)
  return {
    autopayEnrollmentRate: Math.min(100, Math.round((100 * args.profilesWithActiveAutopayEnrollment) / base)),
    savedPaymentMethodRate: Math.min(100, Math.round((100 * args.profilesWithSavedMethod) / base)),
    billingReadinessRate: Math.min(100, Math.round((100 * args.profilesBillingReady) / base)),
    delinquencyRiskRate: Math.min(100, Math.round((100 * args.delinquentProfileCount) / base)),
  }
}
