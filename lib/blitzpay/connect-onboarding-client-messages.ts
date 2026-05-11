/** Browser-safe copy for BlitzPay Connect onboarding API `error` codes (no Stripe secrets). */

export type BlitzPayConnectOnboardingClientErrorCode =
  | "connect_temporarily_restricted"
  | "connect_verification_required"
  | "connect_rate_limited"
  | "connect_configuration_error"
  | "connect_unavailable"
  | "connect_unknown_error"

export const BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES: Record<
  BlitzPayConnectOnboardingClientErrorCode,
  string
> = {
  connect_temporarily_restricted:
    "BlitzPay onboarding is temporarily unavailable. Please try again shortly or contact support.",
  connect_verification_required:
    "Your Stripe platform account requires additional verification before BlitzPay can be enabled.",
  connect_rate_limited:
    "Too many onboarding attempts were made recently. Please wait a few minutes and try again.",
  connect_configuration_error:
    "BlitzPay is not fully configured yet. Please contact support.",
  connect_unavailable:
    "We could not reach Stripe to continue onboarding. Please try again in a few minutes.",
  connect_unknown_error: "An unexpected onboarding error occurred. Please try again.",
}

export function blitzpayConnectOnboardingToastDescription(error: string | undefined, fallback: string): string {
  if (error && error in BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES) {
    return BLITZPAY_CONNECT_ONBOARDING_CLIENT_MESSAGES[error as BlitzPayConnectOnboardingClientErrorCode]
  }
  return fallback
}
