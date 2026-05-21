/**
 * BlitzPay hosted checkout payment method resolution (Connect ACH capability gating).
 * Run: pnpm test:blitzpay-checkout-payment-method-types
 */
import assert from "node:assert/strict"
import type Stripe from "stripe"
import {
  connectedAccountSupportsAch,
  filterPaymentMethodsForConnectedAccount,
  isStripeInvalidPaymentMethodTypeError,
  paymentMethodsEnabledInOrgSettings,
  resolveBlitzpayCheckoutPaymentMethods,
} from "../lib/blitzpay/blitzpay-checkout-payment-method-types"

function accountWithAchStatus(status: Stripe.Account.Capability.Status | undefined): Pick<Stripe.Account, "capabilities"> {
  return {
    capabilities: {
      us_bank_account_ach_payments: status ? { status } : undefined,
    },
  }
}

function testConnectedAccountSupportsAch() {
  assert.equal(connectedAccountSupportsAch(accountWithAchStatus("active")), true)
  assert.equal(connectedAccountSupportsAch(accountWithAchStatus("pending")), false)
  assert.equal(connectedAccountSupportsAch(accountWithAchStatus("inactive")), false)
  assert.equal(connectedAccountSupportsAch({ capabilities: {} }), false)
}

function testSettingsMethods() {
  assert.deepEqual(paymentMethodsEnabledInOrgSettings({ blitzpay_payment_method_ach_enabled: true }), [
    "card",
    "us_bank_account",
  ])
  assert.deepEqual(paymentMethodsEnabledInOrgSettings({ blitzpay_payment_method_ach_enabled: false }), ["card"])
}

function testResolveWithoutAchCapability() {
  const resolution = resolveBlitzpayCheckoutPaymentMethods({
    settings: { blitzpay_payment_method_ach_enabled: true },
    connectAccountSupportsAch: false,
  })
  assert.deepEqual(resolution.selectedPaymentMethods, ["card"])
  assert.equal(resolution.selectedMethod, "card")
  assert.equal(resolution.achEnabled, false)
}

function testResolveWithAchCapability() {
  const resolution = resolveBlitzpayCheckoutPaymentMethods({
    settings: { blitzpay_payment_method_ach_enabled: true },
    connectAccountSupportsAch: true,
  })
  assert.deepEqual(resolution.selectedPaymentMethods, ["card", "us_bank_account"])
  assert.equal(resolution.selectedMethod, "card")
  assert.equal(resolution.achEnabled, true)
}

function testPreferredAchFallsBackWhenUnsupported() {
  const resolution = resolveBlitzpayCheckoutPaymentMethods({
    settings: { blitzpay_payment_method_ach_enabled: true },
    connectAccountSupportsAch: false,
    preferredPaymentMethodType: "us_bank_account",
  })
  assert.deepEqual(resolution.selectedPaymentMethods, ["card"])
  assert.equal(resolution.selectedMethod, "card")
}

function testPreferredAchWhenSupported() {
  const resolution = resolveBlitzpayCheckoutPaymentMethods({
    settings: { blitzpay_payment_method_ach_enabled: true },
    connectAccountSupportsAch: true,
    preferredPaymentMethodType: "us_bank_account",
  })
  assert.deepEqual(resolution.selectedPaymentMethods, ["us_bank_account"])
  assert.equal(resolution.selectedMethod, "us_bank_account")
}

function testFilterNeverEmpty() {
  assert.deepEqual(
    filterPaymentMethodsForConnectedAccount({
      settingsMethods: ["us_bank_account"],
      connectAccountSupportsAch: false,
    }),
    ["card"],
  )
}

function testInvalidPaymentMethodError() {
  assert.equal(
    isStripeInvalidPaymentMethodTypeError(new Error("The payment method type provided: us_bank_account is invalid")),
    true,
  )
  assert.equal(isStripeInvalidPaymentMethodTypeError(new Error("amount_cents must be an integer >= 50")), false)
}

function testDefaultCardOnlyUnlessExplicitAch() {
  const cardOnly = resolveBlitzpayCheckoutPaymentMethods({
    settings: { blitzpay_payment_method_ach_enabled: true },
    connectAccountSupportsAch: true,
    defaultCardOnlyUnlessExplicitAch: true,
  })
  assert.deepEqual(cardOnly.selectedPaymentMethods, ["card"])
  assert.equal(cardOnly.selectedMethod, "card")
  assert.equal(cardOnly.achEnabled, false)

  const explicitAch = resolveBlitzpayCheckoutPaymentMethods({
    settings: { blitzpay_payment_method_ach_enabled: true },
    connectAccountSupportsAch: true,
    preferredPaymentMethodType: "us_bank_account",
    defaultCardOnlyUnlessExplicitAch: false,
  })
  assert.deepEqual(explicitAch.selectedPaymentMethods, ["us_bank_account"])
  assert.equal(explicitAch.selectedMethod, "us_bank_account")

  const explicitAchBlocked = resolveBlitzpayCheckoutPaymentMethods({
    settings: { blitzpay_payment_method_ach_enabled: true },
    connectAccountSupportsAch: false,
    preferredPaymentMethodType: "us_bank_account",
    defaultCardOnlyUnlessExplicitAch: false,
  })
  assert.deepEqual(explicitAchBlocked.selectedPaymentMethods, ["card"])
  assert.equal(explicitAchBlocked.selectedMethod, "card")
}

function main() {
  testConnectedAccountSupportsAch()
  testSettingsMethods()
  testResolveWithoutAchCapability()
  testResolveWithAchCapability()
  testPreferredAchFallsBackWhenUnsupported()
  testPreferredAchWhenSupported()
  testFilterNeverEmpty()
  testInvalidPaymentMethodError()
  testDefaultCardOnlyUnlessExplicitAch()
  console.log("test-blitzpay-checkout-payment-method-types: ok")
}

main()
