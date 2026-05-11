export const BLITZPAY_PLATFORM_MANAGED_FEE_FIELDS = [
  "blitzpay_pass_processing_fees_to_customer",
  "blitzpay_fee_mode",
  "blitzpay_fee_percentage_snapshot",
  "blitzpay_fee_cap_cents",
  "blitzpay_fee_disclosure_copy",
  "blitzpay_ach_convenience_fee_enabled",
] as const

export type BlitzpaySettingsPatchBody = Partial<
  Record<
    | "blitzpay_invoice_pay_enabled"
    | "blitzpay_pass_processing_fees_to_customer"
    | "blitzpay_fee_mode"
    | "blitzpay_fee_percentage_snapshot"
    | "blitzpay_fee_cap_cents"
    | "blitzpay_fee_disclosure_copy"
    | "blitzpay_payment_method_card_enabled"
    | "blitzpay_payment_method_ach_enabled"
    | "blitzpay_ach_convenience_fee_enabled"
    | "blitzpay_ach_processing_timeline_copy"
    | "blitzpay_allow_save_payment_methods",
    unknown
  >
>

export function picksPlatformManagedFeeFields(body: BlitzpaySettingsPatchBody): string[] {
  const keys: string[] = []
  for (const field of BLITZPAY_PLATFORM_MANAGED_FEE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) keys.push(field)
  }
  return keys
}
