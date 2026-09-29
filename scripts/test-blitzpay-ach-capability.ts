/**
 * BlitzPay ACH capability gating, provisioning hooks, and payment-method recording.
 * Run: pnpm test:blitzpay-ach-capability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type Stripe from "stripe"
import {
  connectedAccountSupportsAch,
  resolveAchCapabilityStatusFromAccount,
} from "../lib/blitzpay/blitzpay-ach-capability-status"
import {
  filterPaymentMethodsForConnectedAccount,
  paymentMethodsEnabledInOrgSettings,
  resolveBlitzpayCheckoutPaymentMethods,
} from "../lib/blitzpay/blitzpay-checkout-payment-method-types"
import {
  invoicePaymentMethodFromPaymentIntent,
  mapStripePaymentMethodTypeToInvoiceDb,
} from "../lib/blitzpay/map-stripe-payment-method-to-invoice-db"
import { buildBlitzpayLaunchWorkspaceChecklist } from "../lib/blitzpay/blitzpay-launch-readiness"

function accountWithAchStatus(status: Stripe.Account.Capability.Status | undefined): Pick<Stripe.Account, "capabilities" | "requirements"> {
  return {
    capabilities: {
      us_bank_account_ach_payments: status ? { status } : undefined,
    },
    requirements: {},
  }
}

function launchBase(overrides: Partial<Parameters<typeof buildBlitzpayLaunchWorkspaceChecklist>[0]> = {}) {
  return {
    platformInvoicePayEnv: true,
    schemaHealthy: true,
    webhookSecretConfigured: true,
    cronSecretConfigured: true,
    stripeConnectAccountPresent: true,
    stripeChargesEnabled: true,
    orgBlitzpayInvoicePayEnabled: true,
    orgCardOrAchEnabled: true,
    orgAchEnabled: true,
    achCapabilityActive: true,
    orgRemindersEnabled: true,
    orgReceiptEmailsEnabled: true,
    outboundEmailConfigured: true,
    hasSuccessfulTestCapture: true,
    ...overrides,
  }
}

function testCapabilityStatus() {
  assert.equal(resolveAchCapabilityStatusFromAccount(accountWithAchStatus("active")), "active")
  assert.equal(resolveAchCapabilityStatusFromAccount(accountWithAchStatus("pending")), "pending")
  assert.equal(resolveAchCapabilityStatusFromAccount(accountWithAchStatus("inactive")), "inactive")
  assert.equal(resolveAchCapabilityStatusFromAccount({ capabilities: {}, requirements: {} }), "unrequested")
  assert.equal(connectedAccountSupportsAch(accountWithAchStatus("active")), true)
  assert.equal(connectedAccountSupportsAch(accountWithAchStatus("pending")), false)
}

function testCheckoutResolutionMatrix() {
  const achOn = { blitzpay_payment_method_ach_enabled: true, blitzpay_payment_method_card_enabled: true }
  assert.deepEqual(
    resolveBlitzpayCheckoutPaymentMethods({ settings: { blitzpay_payment_method_ach_enabled: false }, connectAccountSupportsAch: true })
      .selectedPaymentMethods,
    ["card"],
  )
  assert.deepEqual(
    resolveBlitzpayCheckoutPaymentMethods({ settings: achOn, connectAccountSupportsAch: false }).selectedPaymentMethods,
    ["card"],
  )
  assert.deepEqual(
    resolveBlitzpayCheckoutPaymentMethods({ settings: achOn, connectAccountSupportsAch: true }).selectedPaymentMethods,
    ["card", "us_bank_account"],
  )
  assert.deepEqual(
    resolveBlitzpayCheckoutPaymentMethods({
      settings: { blitzpay_payment_method_card_enabled: false, blitzpay_payment_method_ach_enabled: true },
      connectAccountSupportsAch: true,
    }).selectedPaymentMethods,
    ["us_bank_account"],
  )
  assert.deepEqual(
    filterPaymentMethodsForConnectedAccount({
      settingsMethods: paymentMethodsEnabledInOrgSettings(achOn),
      connectAccountSupportsAch: false,
    }),
    ["card"],
  )
}

function testPaymentMethodRecording() {
  assert.equal(mapStripePaymentMethodTypeToInvoiceDb("us_bank_account"), "ach")
  assert.equal(mapStripePaymentMethodTypeToInvoiceDb("card"), "card")
  const achPi = {
    payment_method: { type: "us_bank_account" },
    payment_method_types: ["us_bank_account"],
  } as Stripe.PaymentIntent
  const cardPi = {
    payment_method: { type: "card" },
    payment_method_types: ["card"],
  } as Stripe.PaymentIntent
  assert.equal(invoicePaymentMethodFromPaymentIntent(achPi), "ach")
  assert.equal(invoicePaymentMethodFromPaymentIntent(cardPi), "card")
}

function testLaunchReadinessAchRow() {
  const ready = buildBlitzpayLaunchWorkspaceChecklist(launchBase())
  const achRow = ready.find((i) => i.id === "ach_bank_transfer")
  assert.ok(achRow)
  assert.equal(achRow.ok, true)

  const incomplete = buildBlitzpayLaunchWorkspaceChecklist(
    launchBase({ achCapabilityActive: false, orgAchEnabled: true }),
  )
  const achIncomplete = incomplete.find((i) => i.id === "ach_bank_transfer")
  assert.ok(achIncomplete)
  assert.equal(achIncomplete.ok, false)
}

function testWebhookLifecycleGuardsInSource() {
  const dispatch = fs.readFileSync(path.join(process.cwd(), "lib/blitzpay/webhook-phase2-dispatch.ts"), "utf8")
  assert.match(dispatch, /payment_intent\.processing/)
  assert.match(dispatch, /payment_intent\.payment_failed/)
  assert.match(dispatch, /completeBlitzpayPaymentIntentSucceeded/)
  assert.match(dispatch, /checkout\.session\.completed without paid status/)
  const completion = fs.readFileSync(path.join(process.cwd(), "lib/blitzpay/webhook-invoice-pay-completion.ts"), "utf8")
  assert.match(completion, /invoicePaymentMethodFromPaymentIntent/)
}

function testExpressAccountCreationRequestsAch() {
  const src = fs.readFileSync(path.join(process.cwd(), "lib/blitzpay/connect-stripe.ts"), "utf8")
  assert.match(src, /us_bank_account_ach_payments:\s*\{\s*requested:\s*true\s*\}/)
}

function testSettingsAndStatusExposeAch() {
  const status = fs.readFileSync(
    path.join(process.cwd(), "app/api/organizations/[organizationId]/blitzpay/status/route.ts"),
    "utf8",
  )
  assert.match(status, /achCapabilityStatus/)
  assert.match(status, /achReady/)
  const settings = fs.readFileSync(
    path.join(process.cwd(), "app/api/organizations/[organizationId]/blitzpay/settings/route.ts"),
    "utf8",
  )
  assert.match(settings, /ensureBlitzpayAchCapabilityRequested/)
}

function main() {
  testCapabilityStatus()
  testCheckoutResolutionMatrix()
  testPaymentMethodRecording()
  testLaunchReadinessAchRow()
  testWebhookLifecycleGuardsInSource()
  testExpressAccountCreationRequestsAch()
  testSettingsAndStatusExposeAch()
  console.log("blitzpay ach capability tests passed")
}

main()
