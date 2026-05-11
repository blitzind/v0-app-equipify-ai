import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe"
import { applyBlitzpayStripeRefundToInvoiceIfEligible } from "@/lib/blitzpay/blitzpay-refund-apply"

/**
 * Replay-safe: re-processes succeeded refunds on the charge; DB + ledger dedupe per Stripe refund id.
 */
export async function dispatchBlitzpayChargeRefunded(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  const connectAccount = typeof event.account === "string" && event.account.length > 0 ? event.account : null
  if (!connectAccount) {
    console.info(
      JSON.stringify({
        source: "blitzpay-webhook",
        message: "charge.refunded missing connected account — skipping",
        eventId: event.id,
      }),
    )
    return
  }

  const partial = event.data.object as Stripe.Charge
  const stripe = getStripe()
  const charge = await stripe.charges.retrieve(partial.id, { expand: ["refunds"] }, { stripeAccount: connectAccount })
  const refunds = charge.refunds?.data ?? []

  for (const r of refunds) {
    if (r.status !== "succeeded") continue
    const { applied, duplicate } = await applyBlitzpayStripeRefundToInvoiceIfEligible(admin, r, connectAccount, charge)
    if (applied) {
      console.info(
        JSON.stringify({
          source: "blitzpay-webhook",
          message: "refund_booked",
          eventId: event.id,
          stripeRefundId: r.id,
        }),
      )
    } else if (duplicate) {
      console.info(
        JSON.stringify({
          source: "blitzpay-webhook",
          message: "refund_replay_noop",
          eventId: event.id,
          stripeRefundId: r.id,
        }),
      )
    }
  }
}
