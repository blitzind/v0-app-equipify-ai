import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { parseBlitzpayInvoiceMetadata } from "@/lib/blitzpay/stripe-metadata"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"

/**
 * Phase 2A: bounded, idempotent mirror updates only (no org_invoice_payments allocation yet).
 */
export async function dispatchBlitzPayPhase2Webhook(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
    case "payment_intent.processing":
    case "payment_intent.requires_action":
    case "payment_intent.amount_capturable_updated": {
      const pi = event.data.object as Stripe.PaymentIntent
      const lastAt = new Date(event.created * 1000).toISOString()
      const { error } = await admin
        .from("blitzpay_payment_intents")
        .update({
          status: pi.status,
          last_stripe_event_at: lastAt,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", pi.id)

      if (error) throw new Error(error.message)

      const meta = parseBlitzpayInvoiceMetadata(
        pi.metadata as Record<string, string> | undefined,
      )
      if (meta && isBlitzPayInvoicePayEnabledEnv()) {
        console.info(
          JSON.stringify({
            source: "blitzpay-webhook",
            phase: "2a_stub",
            message: "payment_intent event for BlitzPay invoice metadata (allocation deferred to Phase 2B)",
            eventId: event.id,
            eventType: event.type,
            organizationId: meta.organizationId,
            orgInvoiceId: meta.orgInvoiceId,
            stripePaymentIntentId: pi.id,
          }),
        )
      }
      return
    }
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const meta = parseBlitzpayInvoiceMetadata(
        session.metadata as Record<string, string> | undefined,
      )
      console.info(
        JSON.stringify({
          source: "blitzpay-webhook",
          phase: "2a_stub",
          message: "checkout.session.completed (no-op until Checkout wired)",
          eventId: event.id,
          purpose: session.metadata?.purpose ?? null,
          organizationId: meta?.organizationId ?? null,
          orgInvoiceId: meta?.orgInvoiceId ?? null,
          stripeCheckoutSessionId: session.id,
        }),
      )
      return
    }
    case "charge.refunded":
    case "charge.dispute.created": {
      const obj = event.data.object as { id?: string }
      console.info(
        JSON.stringify({
          source: "blitzpay-webhook",
          phase: "2a_stub",
          message: `${event.type} (ledger/refund handling deferred)`,
          eventId: event.id,
          stripeObjectId: obj.id ?? null,
        }),
      )
      return
    }
    default:
      return
  }
}
