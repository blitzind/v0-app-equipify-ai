import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe"
import { parseBlitzpayInvoiceMetadata } from "@/lib/blitzpay/stripe-metadata"
import {
  completeBlitzpayPaymentIntentCanceled,
  completeBlitzpayPaymentIntentFailed,
  completeBlitzpayPaymentIntentSucceeded,
} from "@/lib/blitzpay/webhook-invoice-pay-completion"
import { dispatchBlitzpayChargeRefunded } from "@/lib/blitzpay/webhook-charge-refunded"
import { upsertBlitzpayInvoiceDisputeFromStripe } from "@/lib/blitzpay/webhook-charge-dispute"
import { dispatchBlitzpayPayoutWebhook } from "@/lib/blitzpay/blitzpay-payout-sync"

async function refreshBlitzpayPaymentIntentMirror(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
  eventCreatedMs: number,
): Promise<void> {
  const lastAt = new Date(eventCreatedMs * 1000).toISOString()
  const achFlow = Array.isArray(pi.payment_method_types) && pi.payment_method_types.includes("us_bank_account")
  const achSettlementState = achFlow ? (pi.status === "succeeded" ? "settled" : "pending") : null
  const { error } = await admin
    .from("blitzpay_payment_intents")
    .update({
      status: pi.status,
      payment_method_type:
        achFlow ? "us_bank_account"
        : Array.isArray(pi.payment_method_types) && pi.payment_method_types.includes("card") ? "card"
        : null,
      ach_settlement_state: achSettlementState,
      last_stripe_event_at: lastAt,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", pi.id)

  if (error) throw new Error(error.message)
}

/**
 * Phase 2B: mirror PaymentIntent rows + allocate invoice payments on success (idempotent).
 */
export async function dispatchBlitzPayPhase2Webhook(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent
      await refreshBlitzpayPaymentIntentMirror(admin, pi, event.created)
      await completeBlitzpayPaymentIntentSucceeded(admin, pi, event.created)
      return
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent
      await refreshBlitzpayPaymentIntentMirror(admin, pi, event.created)
      await completeBlitzpayPaymentIntentFailed(admin, pi)
      return
    }
    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent
      await refreshBlitzpayPaymentIntentMirror(admin, pi, event.created)
      await completeBlitzpayPaymentIntentCanceled(admin, pi)
      return
    }
    case "payment_intent.processing":
    case "payment_intent.requires_action":
    case "payment_intent.amount_capturable_updated": {
      const pi = event.data.object as Stripe.PaymentIntent
      await refreshBlitzpayPaymentIntentMirror(admin, pi, event.created)
      return
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const meta = parseBlitzpayInvoiceMetadata(session.metadata as Record<string, string> | undefined)
      const acct = typeof event.account === "string" && event.account.length > 0 ? event.account : null
      const piRef = session.payment_intent
      const piId = typeof piRef === "string" ? piRef : piRef && typeof piRef === "object" && "id" in piRef ? String((piRef as { id: string }).id) : ""

      if (meta && acct && piId && session.payment_status === "paid") {
        const stripe = getStripe()
        const pi = await stripe.paymentIntents.retrieve(piId, { stripeAccount: acct })
        await refreshBlitzpayPaymentIntentMirror(admin, pi, event.created)
        if (pi.status === "succeeded") {
          await completeBlitzpayPaymentIntentSucceeded(admin, pi, event.created)
        }
      } else if (meta && session.payment_status !== "paid") {
        console.info(
          JSON.stringify({
            source: "blitzpay-webhook",
            message: "checkout.session.completed without paid status — skipping allocation",
            eventId: event.id,
            paymentStatus: session.payment_status,
            organizationId: meta.organizationId,
          }),
        )
      } else {
        console.info(
          JSON.stringify({
            source: "blitzpay-webhook",
            message: "checkout.session.completed (not BlitzPay invoice metadata — ignored)",
            eventId: event.id,
            purpose: session.metadata?.purpose ?? null,
          }),
        )
      }
      return
    }
    case "charge.refunded": {
      await dispatchBlitzpayChargeRefunded(admin, event)
      return
    }
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed": {
      const acct = typeof event.account === "string" && event.account.length > 0 ? event.account : null
      if (!acct) {
        console.info(
          JSON.stringify({
            source: "blitzpay-webhook",
            message: `${event.type} missing connected account — skipping dispute upsert`,
            eventId: event.id,
          }),
        )
        return
      }
      const dispute = event.data.object as Stripe.Dispute
      await upsertBlitzpayInvoiceDisputeFromStripe(admin, dispute, acct)
      return
    }
    case "payout.created":
    case "payout.paid":
    case "payout.updated":
    case "payout.failed":
    case "payout.canceled": {
      await dispatchBlitzpayPayoutWebhook(admin, event)
      return
    }
    default:
      return
  }
}
