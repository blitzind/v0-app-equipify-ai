import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe"
import { fetchBlitzpayPaymentIntentByStripeId } from "@/lib/blitzpay/payment-repository"

function paymentIntentIdFromCharge(charge: Stripe.Charge): string {
  const pi = charge.payment_intent
  if (typeof pi === "string") return pi
  if (pi && typeof pi === "object" && "id" in pi) return String((pi as { id: string }).id)
  return ""
}

/**
 * Upserts a lightweight dispute row for staff visibility (no evidence workflow).
 */
export async function upsertBlitzpayInvoiceDisputeFromStripe(
  admin: SupabaseClient,
  dispute: Stripe.Dispute,
  connectAccountId: string,
): Promise<void> {
  const chargeRef = dispute.charge
  const chargeId =
    typeof chargeRef === "string"
      ? chargeRef
      : chargeRef && typeof chargeRef === "object" && "id" in chargeRef
        ? String((chargeRef as { id: string }).id)
        : ""
  if (!chargeId) return

  const stripe = getStripe()
  const charge = await stripe.charges.retrieve(chargeId, {}, { stripeAccount: connectAccountId })
  const piId = paymentIntentIdFromCharge(charge)
  if (!piId) return

  const rawPi = await fetchBlitzpayPaymentIntentByStripeId(admin, piId)
  if (!rawPi) return

  const piRow = rawPi as {
    id: string
    organization_id: string
    org_invoice_id: string | null
  }
  if (!piRow.org_invoice_id) return

  const openedAt =
    typeof dispute.created === "number" && dispute.created > 0
      ? new Date(dispute.created * 1000).toISOString()
      : null

  const row = {
    organization_id: piRow.organization_id,
    org_invoice_id: piRow.org_invoice_id,
    blitzpay_payment_intent_id: piRow.id,
    stripe_dispute_id: dispute.id,
    stripe_charge_id: chargeId,
    amount_cents: Math.round(Number(dispute.amount ?? 0)),
    currency: String(dispute.currency || "usd").toLowerCase(),
    status: String(dispute.status || "unknown"),
    opened_at: openedAt,
    metadata: { reason: dispute.reason ?? null, event: "blitzpay_dispute_upsert" },
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin.from("blitzpay_invoice_disputes").upsert(row, { onConflict: "stripe_dispute_id" })
  if (error) throw new Error(error.message)
}
