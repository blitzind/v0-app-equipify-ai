import type { BlitzpayPaymentMethodType } from "@/lib/blitzpay/payment-domain"

export type BlitzpayAutopayEligibilityInput = {
  invoiceBalanceCents: number
  hasStoredProfile: boolean
  hasDefaultPaymentMethod: boolean
  offSessionAuthorized: boolean
  defaultPaymentMethodType: BlitzpayPaymentMethodType | null
}

export function evaluateBlitzpayAutopayEligibility(input: BlitzpayAutopayEligibilityInput): {
  eligible: boolean
  reason:
    | "eligible"
    | "no_balance"
    | "no_profile"
    | "no_default_payment_method"
    | "off_session_not_authorized"
    | "missing_method_type"
} {
  if (Math.round(input.invoiceBalanceCents) <= 0) return { eligible: false, reason: "no_balance" }
  if (!input.hasStoredProfile) return { eligible: false, reason: "no_profile" }
  if (!input.hasDefaultPaymentMethod) return { eligible: false, reason: "no_default_payment_method" }
  if (!input.offSessionAuthorized) return { eligible: false, reason: "off_session_not_authorized" }
  if (!input.defaultPaymentMethodType) return { eligible: false, reason: "missing_method_type" }
  return { eligible: true, reason: "eligible" }
}
