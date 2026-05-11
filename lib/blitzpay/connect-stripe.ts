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
}): Promise<Stripe.Checkout.Session> {
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

  return stripe.checkout.sessions.create(
    {
      mode: "payment",
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
      payment_intent_data: {
        application_fee_amount: params.applicationFeeCents,
        metadata: params.paymentIntentMetadata,
      },
      metadata: params.sessionMetadata,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    },
    {
      stripeAccount: params.stripeConnectAccountId,
      idempotencyKey: params.idempotencyKey,
    },
  )
}
