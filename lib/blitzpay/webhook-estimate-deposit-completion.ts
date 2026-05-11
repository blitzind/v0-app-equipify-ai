import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { BlitzpayEstimateStripeMetadata } from "@/lib/blitzpay/blitzpay-estimate-stripe-metadata"
import {
  appendBlitzpayLedgerEntry,
  updateBlitzpayInvoicePaymentAttemptsForInternalIntent,
  updateBlitzpayPaymentIntentMethodDetails,
} from "@/lib/blitzpay/payment-repository"
import { syncBlitzpayCustomerPaymentProfileFromPaymentIntent } from "@/lib/blitzpay/blitzpay-payment-profiles"

type BlitzpayPiRow = {
  id: string
  organization_id: string
  org_quote_id: string | null
  org_invoice_id: string | null
  invoice_amount_cents: string | null
  amount_cents: string
  currency: string
  customer_id: string | null
  stripe_connect_account_id: string
  stripe_customer_id: string | null
  save_payment_method_requested: boolean
  payment_method_type: string | null
}

/**
 * Books a succeeded estimate/deposit PaymentIntent: ledger + org_quotes.blitzpay_deposit_collected_cents.
 * Idempotent via ledger unique (organization_id, entry_type, stripe_object_id) on charge id.
 */
export async function completeBlitzpayEstimateDepositPaymentIntentSucceeded(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
  row: BlitzpayPiRow,
  eventCreatedMs: number,
  estMeta: BlitzpayEstimateStripeMetadata,
): Promise<void> {
  if (!row.org_quote_id || row.org_quote_id !== estMeta.orgQuoteId) return

  const stripePmType =
    typeof pi.payment_method === "object" && pi.payment_method ?
      (pi.payment_method as Stripe.PaymentMethod).type
    : null
  const stripePmId =
    typeof pi.payment_method === "string" ? pi.payment_method
    : pi.payment_method && typeof pi.payment_method === "object" ? pi.payment_method.id
    : null
  const stripeCustomer =
    typeof pi.customer === "string" ? pi.customer
    : pi.customer && typeof pi.customer === "object" ? pi.customer.id
    : row.stripe_customer_id
  await updateBlitzpayPaymentIntentMethodDetails(admin, pi.id, {
    paymentMethodType: stripePmType === "card" || stripePmType === "us_bank_account" ? stripePmType : null,
    stripePaymentMethodId: stripePmId,
    stripeCustomerId: stripeCustomer,
    achSettlementState:
      stripePmType === "us_bank_account" ? (pi.status === "succeeded" ? "settled" : "pending") : null,
  })
  await syncBlitzpayCustomerPaymentProfileFromPaymentIntent(admin, row, pi)

  const portion = Math.round(
    Math.min(
      Number(estMeta.quotePayCents),
      Number(row.invoice_amount_cents ?? row.amount_cents),
      Number(pi.amount_received ?? pi.amount ?? 0),
    ),
  )

  if (portion <= 0) {
    await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
      status: "completed",
      failureCode: null,
    })
    return
  }

  const chargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge && typeof pi.latest_charge === "object" && "id" in pi.latest_charge
        ? String((pi.latest_charge as { id: string }).id)
        : pi.id

  const led = await appendBlitzpayLedgerEntry(admin, {
    organizationId: row.organization_id,
    entryType: "payment_captured",
    amountCents: BigInt(portion),
    currency: row.currency || "usd",
    stripeObjectId: chargeId,
    blitzpayPaymentIntentId: row.id,
    orgInvoiceId: null,
    orgQuoteId: row.org_quote_id,
    metadata: {
      stripe_payment_intent_id: pi.id,
      revenue_recognition: "estimate_deposit",
      org_quote_id: row.org_quote_id,
    },
  })

  if (!led.duplicate) {
    const { data: cur, error: curErr } = await admin
      .from("org_quotes")
      .select("blitzpay_deposit_collected_cents")
      .eq("id", row.org_quote_id)
      .eq("organization_id", row.organization_id)
      .maybeSingle()
    if (!curErr && cur) {
      const prev = Math.max(0, Math.round(Number((cur as { blitzpay_deposit_collected_cents?: number }).blitzpay_deposit_collected_cents ?? 0)))
      await admin
        .from("org_quotes")
        .update({ blitzpay_deposit_collected_cents: prev + portion })
        .eq("id", row.org_quote_id)
        .eq("organization_id", row.organization_id)
    }
  }

  const appFee = pi.application_fee_amount
  if (typeof appFee === "number" && appFee > 0) {
    await appendBlitzpayLedgerEntry(admin, {
      organizationId: row.organization_id,
      entryType: "application_fee_received",
      amountCents: BigInt(appFee),
      currency: row.currency || "usd",
      stripeObjectId: chargeId,
      blitzpayPaymentIntentId: row.id,
      orgInvoiceId: null,
      orgQuoteId: row.org_quote_id,
      metadata: { stripe_payment_intent_id: pi.id, revenue_recognition: "estimate_deposit_fee" },
    })
  }

  await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
    status: "completed",
    failureCode: null,
  })
}
