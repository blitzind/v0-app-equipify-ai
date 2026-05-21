import type Stripe from "stripe"
import type { BlitzpayPaymentMethodType } from "@/lib/blitzpay/payment-domain"

export type BlitzpayCheckoutStripePaymentMethodType = "card" | "us_bank_account"

export type BlitzpayCheckoutPaymentMethodResolution = {
  selectedPaymentMethods: BlitzpayCheckoutStripePaymentMethodType[]
  selectedMethod: BlitzpayPaymentMethodType
  achEnabled: boolean
}

/** True when the connected Express account can accept ACH Direct Debit in Checkout. */
export function connectedAccountSupportsAch(account: Pick<Stripe.Account, "capabilities">): boolean {
  return account.capabilities?.us_bank_account_ach_payments?.status === "active"
}

export function paymentMethodsEnabledInOrgSettings(settings: Record<string, unknown>): BlitzpayPaymentMethodType[] {
  const cardEnabled = settings.blitzpay_payment_method_card_enabled !== false
  const achEnabledInSettings = Boolean(settings.blitzpay_payment_method_ach_enabled)
  const methods: BlitzpayPaymentMethodType[] = []
  if (cardEnabled) methods.push("card")
  if (achEnabledInSettings) methods.push("us_bank_account")
  if (methods.length === 0) methods.push("card")
  return methods
}

export function filterPaymentMethodsForConnectedAccount(args: {
  settingsMethods: BlitzpayPaymentMethodType[]
  connectAccountSupportsAch: boolean
}): BlitzpayPaymentMethodType[] {
  const methods = args.settingsMethods.filter(
    (method) => method === "card" || (method === "us_bank_account" && args.connectAccountSupportsAch),
  )
  return methods.length > 0 ? methods : ["card"]
}

export function resolveBlitzpayCheckoutPaymentMethods(args: {
  settings: Record<string, unknown>
  connectAccountSupportsAch: boolean
  preferredPaymentMethodType?: BlitzpayPaymentMethodType
  /** When true, Checkout is card-only unless ACH is explicitly requested and allowed. */
  defaultCardOnlyUnlessExplicitAch?: boolean
}): BlitzpayCheckoutPaymentMethodResolution {
  const settingsMethods = paymentMethodsEnabledInOrgSettings(args.settings)
  const availableMethods = filterPaymentMethodsForConnectedAccount({
    settingsMethods,
    connectAccountSupportsAch: args.connectAccountSupportsAch,
  })
  const achEnabled = args.connectAccountSupportsAch && settingsMethods.includes("us_bank_account")

  const achExplicitlyRequested = args.preferredPaymentMethodType === "us_bank_account"
  if (args.defaultCardOnlyUnlessExplicitAch && !achExplicitlyRequested) {
    return {
      selectedPaymentMethods: ["card"],
      selectedMethod: "card",
      achEnabled: false,
    }
  }

  let selectedMethod: BlitzpayPaymentMethodType
  if (args.preferredPaymentMethodType && availableMethods.includes(args.preferredPaymentMethodType)) {
    selectedMethod = args.preferredPaymentMethodType
  } else if (achExplicitlyRequested) {
    selectedMethod = availableMethods.includes("us_bank_account") ? "us_bank_account" : "card"
  } else {
    selectedMethod = availableMethods[0]
  }

  const selectedPaymentMethods: BlitzpayCheckoutStripePaymentMethodType[] =
    args.preferredPaymentMethodType ?
      [selectedMethod as BlitzpayCheckoutStripePaymentMethodType]
    : (availableMethods as BlitzpayCheckoutStripePaymentMethodType[])

  return { selectedPaymentMethods, selectedMethod, achEnabled }
}

export function isStripeInvalidPaymentMethodTypeError(error: unknown): boolean {
  const parts: string[] = []
  if (error instanceof Error) parts.push(error.message)
  if (error && typeof error === "object") {
    const stripeLike = error as { message?: string; raw?: { message?: string } }
    if (typeof stripeLike.message === "string") parts.push(stripeLike.message)
    if (typeof stripeLike.raw?.message === "string") parts.push(stripeLike.raw.message)
  }
  const combined = parts.join(" ")
  return /payment method type.*invalid/i.test(combined) || /us_bank_account is invalid/i.test(combined)
}
