import "server-only"

import type Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { mapStripeAccountToBlitzPayOrgPatch } from "@/lib/blitzpay/map-account"

/**
 * BlitzPay / Stripe Connect — isolated from SaaS subscription Checkout and Customer objects.
 * Uses the same platform STRIPE_SECRET_KEY; connected account context is per-request on Account/AccountLink APIs.
 */

export async function createUsExpressConnectedAccount(): Promise<Stripe.Account> {
  const stripe = getStripe()
  return stripe.accounts.create({
    type: "express",
    country: "US",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  })
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
