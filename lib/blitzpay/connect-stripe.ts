import "server-only"

import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { mapStripeAccountToBlitzPayOrgPatch } from "@/lib/blitzpay/map-account"

/**
 * BlitzPay / Stripe Connect — isolated from SaaS subscription Checkout and Customer objects.
 * Uses the same platform STRIPE_SECRET_KEY; connected account context is per-request on Account/AccountLink APIs.
 */

/** One Express account per org; Stripe dedupes retries within the idempotency window. */
const EXPRESS_ACCOUNT_IDEMPOTENCY_PREFIX = "blitzpay_org_express_acct:v1"

export async function createUsExpressConnectedAccount(organizationId: string): Promise<Stripe.Account> {
  const stripe = getStripe()
  const idempotencyKey = `${EXPRESS_ACCOUNT_IDEMPOTENCY_PREFIX}:${organizationId}`
  return stripe.accounts.create(
    {
      type: "express",
      country: "US",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    },
    { idempotencyKey },
  )
}

export async function retrieveConnectAccount(accountId: string): Promise<Stripe.Account> {
  const stripe = getStripe()
  return stripe.accounts.retrieve(accountId)
}

export async function createConnectAccountOnboardingLink(params: {
  accountId: string
  refreshUrl: string
  returnUrl: string
}): Promise<Stripe.AccountLink> {
  const stripe = getStripe()
  return stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  })
}

export function buildBlitzPayOrgUpdateFromStripeAccount(account: Stripe.Account): Record<string, unknown> {
  const mapped = mapStripeAccountToBlitzPayOrgPatch(account)
  return {
    ...mapped,
    updated_at: new Date().toISOString(),
  }
}

/** Returns true when the Customer exists on the connected account. */
export async function connectCheckoutCustomerExists(params: {
  stripeConnectAccountId: string
  stripeCustomerId: string
}): Promise<boolean> {
  const stripe = getStripe()
  try {
    const cust = await stripe.customers.retrieve(params.stripeCustomerId, {
      stripeAccount: params.stripeConnectAccountId,
    })
    return !("deleted" in cust && cust.deleted)
  } catch {
    return false
  }
}

export type BlitzpayInvoiceCheckoutSessionApiBody = {
  mode: "payment"
  payment_method_types: Array<"card" | "us_bank_account">
  customer?: string
  customer_creation?: "always"
  customer_email?: string
  line_items: Array<{
    price_data: {
      currency: string
      unit_amount: number
      product_data: { name: string }
    }
    quantity: number
  }>
  payment_intent_data: {
    application_fee_amount?: number
    metadata: Record<string, string>
    setup_future_usage?: "off_session"
  }
  metadata: Record<string, string>
  success_url: string
  cancel_url: string
}

export function buildBlitzpayInvoiceCheckoutSessionApiBody(params: {
  stripeConnectAccountId: string
  amountCents: number
  applicationFeeCents: number
  currency: string
  productName: string
  successUrl: string
  cancelUrl: string
  paymentIntentMetadata: Record<string, string>
  sessionMetadata: Record<string, string>
  paymentMethodTypes: Array<"card" | "us_bank_account">
  stripeCustomerId?: string | null
  savePaymentMethodForFutureUse?: boolean
}): BlitzpayInvoiceCheckoutSessionApiBody {
  const c = params.currency.trim().toLowerCase()
  const paymentIntentData: BlitzpayInvoiceCheckoutSessionApiBody["payment_intent_data"] = {
    metadata: params.paymentIntentMetadata,
  }
  if (params.applicationFeeCents > 0) {
    paymentIntentData.application_fee_amount = params.applicationFeeCents
  }
  if (params.savePaymentMethodForFutureUse) {
    paymentIntentData.setup_future_usage = "off_session"
  }

  const body: BlitzpayInvoiceCheckoutSessionApiBody = {
    mode: "payment",
    payment_method_types: params.paymentMethodTypes,
    line_items: [
      {
        price_data: {
          currency: c,
          unit_amount: params.amountCents,
          product_data: { name: params.productName.slice(0, 120) },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: paymentIntentData,
    metadata: params.sessionMetadata,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  }

  if (params.stripeCustomerId) {
    body.customer = params.stripeCustomerId
  } else {
    body.customer_creation = "always"
  }

  return body
}

/** Hosted Checkout on the connected account (BlitzPay invoice pay, Phase 2B). */
export async function createBlitzpayInvoiceCheckoutSession(params: {
  stripeConnectAccountId: string
  amountCents: number
  applicationFeeCents: number
  currency: string
  productName: string
  successUrl: string
  cancelUrl: string
  paymentIntentMetadata: Record<string, string>
  sessionMetadata: Record<string, string>
  idempotencyKey: string
  paymentMethodTypes: Array<"card" | "us_bank_account">
  stripeCustomerId?: string | null
  savePaymentMethodForFutureUse?: boolean
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  if (!Number.isInteger(params.amountCents) || params.amountCents < 50) {
    throw new Error("amount_cents must be an integer >= 50 (Stripe USD minimum).")
  }
  if (!Number.isInteger(params.applicationFeeCents) || params.applicationFeeCents < 0) {
    throw new Error("application_fee_cents must be a non-negative integer.")
  }
  if (params.applicationFeeCents > params.amountCents) {
    throw new Error("application_fee_cents cannot exceed amount_cents.")
  }

  const body = buildBlitzpayInvoiceCheckoutSessionApiBody(params)

  return stripe.checkout.sessions.create(body, {
    stripeAccount: params.stripeConnectAccountId,
    idempotencyKey: params.idempotencyKey,
  })
}

/** Refund a charge on the connected account; set `refundApplicationFee` so platform fee reverses with Stripe rules. */
export async function createBlitzpayConnectRefund(params: {
  stripeConnectAccountId: string
  chargeId: string
  /** Omit for full remaining charge refund (Stripe default). */
  amountCents?: number
  idempotencyKey: string
  refundApplicationFee: boolean
}): Promise<Stripe.Refund> {
  const stripe = getStripe()
  const body: Stripe.RefundCreateParams = {
    charge: params.chargeId,
    refund_application_fee: params.refundApplicationFee,
  }
  if (params.amountCents != null) {
    if (!Number.isInteger(params.amountCents) || params.amountCents < 1) {
      throw new Error("amountCents must be a positive integer when provided.")
    }
    body.amount = params.amountCents
  }
  return stripe.refunds.create(body, {
    stripeAccount: params.stripeConnectAccountId,
    idempotencyKey: params.idempotencyKey,
  })
}

/** Default PaymentMethod id on the connected-account Customer (Stripe-hosted), or null. */
export async function fetchBlitzpayConnectCustomerDefaultPaymentMethodId(params: {
  stripeConnectAccountId: string
  stripeCustomerId: string
}): Promise<string | null> {
  const stripe = getStripe()
  const cust = await stripe.customers.retrieve(
    params.stripeCustomerId,
    { expand: ["invoice_settings.default_payment_method"] },
    { stripeAccount: params.stripeConnectAccountId },
  )
  if (cust.deleted) return null
  const c = cust as Stripe.Customer
  const invPm = c.invoice_settings?.default_payment_method
  if (typeof invPm === "string" && invPm.startsWith("pm_")) return invPm
  if (invPm && typeof invPm === "object" && "id" in invPm) {
    const id = String((invPm as Stripe.PaymentMethod).id ?? "")
    return id.startsWith("pm_") ? id : null
  }
  return null
}

/**
 * Off-session PaymentIntent on the connected account (scheduled pay).
 * Caller must validate consent, balance, and default payment method availability.
 */
export async function createBlitzpayOffSessionInvoicePaymentIntent(params: {
  stripeConnectAccountId: string
  stripeCustomerId: string
  stripePaymentMethodId: string
  amountCents: number
  applicationFeeCents: number
  currency: string
  metadata: Record<string, string>
  idempotencyKey: string
}): Promise<Stripe.PaymentIntent> {
  const stripe = getStripe()
  const c = params.currency.trim().toLowerCase()
  if (!Number.isInteger(params.amountCents) || params.amountCents < 50) {
    throw new Error("amount_cents must be an integer >= 50 (Stripe USD minimum).")
  }
  if (!Number.isInteger(params.applicationFeeCents) || params.applicationFeeCents < 0) {
    throw new Error("application_fee_cents must be a non-negative integer.")
  }
  if (params.applicationFeeCents > params.amountCents) {
    throw new Error("application_fee_cents cannot exceed amount_cents.")
  }
  return stripe.paymentIntents.create(
    {
      amount: params.amountCents,
      currency: c,
      customer: params.stripeCustomerId,
      payment_method: params.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      application_fee_amount: params.applicationFeeCents,
      metadata: params.metadata,
    },
    { stripeAccount: params.stripeConnectAccountId, idempotencyKey: params.idempotencyKey },
  )
}
