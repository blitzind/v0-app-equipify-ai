import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe"
import { createBlitzpayConnectRefund } from "@/lib/blitzpay/connect-stripe"
import {
  applyBlitzpaySucceededRefund,
  sumSucceededBlitzpayRefundsForOrgInvoicePayment,
} from "@/lib/blitzpay/blitzpay-refund-apply"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

const BLITZPAY_PI_PREFIX = "blitzpay_pi:"

export type StaffBlitzpayRefundResult =
  | { ok: true; stripeRefundId: string; amountBookedCents: number; pending: boolean }
  | { ok: false; code: string; message: string; status: number }

export async function executeStaffBlitzpayInvoiceRefund(params: {
  admin: SupabaseClient
  organizationId: string
  invoiceId: string
  orgInvoicePaymentId: string
  amountCents?: number | null
  staffUserId: string
  idempotencyKey: string
}): Promise<StaffBlitzpayRefundResult> {
  assertUuid(params.organizationId, "organizationId")
  assertUuid(params.invoiceId, "invoiceId")
  assertUuid(params.orgInvoicePaymentId, "orgInvoicePaymentId")

  const { data: payRow, error: payErr } = await params.admin
    .from("org_invoice_payments")
    .select("id, invoice_id, amount_cents, payment_method, reference")
    .eq("organization_id", params.organizationId)
    .eq("id", params.orgInvoicePaymentId)
    .maybeSingle()

  if (payErr) return { ok: false, code: "load_failed", message: payErr.message, status: 500 }
  if (!payRow) return { ok: false, code: "not_found", message: "Payment not found.", status: 404 }

  const pr = payRow as {
    invoice_id: string
    amount_cents: number
    payment_method: string
    reference: string | null
  }
  if (pr.invoice_id !== params.invoiceId) {
    return { ok: false, code: "invoice_mismatch", message: "Payment does not belong to this invoice.", status: 400 }
  }
  const ref = String(pr.reference ?? "").trim()
  if (!ref.startsWith(BLITZPAY_PI_PREFIX)) {
    return { ok: false, code: "not_blitzpay", message: "Only BlitzPay card payments can be refunded here.", status: 400 }
  }
  if (String(pr.payment_method || "").toLowerCase() !== "card") {
    return { ok: false, code: "not_card", message: "Only card payments are refundable via BlitzPay.", status: 400 }
  }

  const stripePiId = ref.slice(BLITZPAY_PI_PREFIX.length).trim()
  if (!stripePiId) {
    return { ok: false, code: "bad_reference", message: "Invalid BlitzPay payment reference.", status: 400 }
  }

  const { data: orgRow, error: orgErr } = await params.admin
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", params.organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    return { ok: false, code: "org_load_failed", message: orgErr?.message ?? "Organization not found.", status: 500 }
  }
  const connectId = String((orgRow as { stripe_connect_account_id?: string | null }).stripe_connect_account_id ?? "").trim()
  if (!connectId) {
    return { ok: false, code: "no_connect", message: "Stripe Connect is not set up for this workspace.", status: 400 }
  }

  const already = await sumSucceededBlitzpayRefundsForOrgInvoicePayment(
    params.admin,
    params.organizationId,
    params.orgInvoicePaymentId,
  )
  const paymentTotal = Math.round(Number(pr.amount_cents))
  const remaining = Math.max(0, paymentTotal - already)
  if (remaining <= 0) {
    return { ok: false, code: "nothing_to_refund", message: "This payment has already been fully refunded.", status: 400 }
  }

  const requested =
    params.amountCents == null || params.amountCents === undefined ? remaining : Math.round(Number(params.amountCents))
  if (!Number.isFinite(requested) || requested < 1) {
    return { ok: false, code: "bad_amount", message: "Refund amount must be a positive number of cents.", status: 400 }
  }
  if (requested > remaining) {
    return {
      ok: false,
      code: "amount_too_high",
      message: `Refund cannot exceed remaining refundable amount (${remaining} cents).`,
      status: 400,
    }
  }

  const { data: idemRow } = await params.admin
    .from("blitzpay_invoice_refunds")
    .select("stripe_refund_id, amount_cents, status")
    .eq("organization_id", params.organizationId)
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle()

  if (idemRow) {
    const ir = idemRow as { stripe_refund_id: string; amount_cents: number; status: string }
    const booked = Math.round(Number(ir.amount_cents))
    return {
      ok: true,
      stripeRefundId: ir.stripe_refund_id,
      amountBookedCents: booked,
      pending: ir.status !== "succeeded",
    }
  }

  const stripe = getStripe()
  let chargeId: string
  try {
    const pi = await stripe.paymentIntents.retrieve(stripePiId, { stripeAccount: connectId })
    const lc = pi.latest_charge
    chargeId =
      typeof lc === "string" ? lc : lc && typeof lc === "object" && "id" in lc ? String((lc as { id: string }).id) : ""
    if (!chargeId) {
      return { ok: false, code: "no_charge", message: "Could not resolve Stripe charge for this payment.", status: 400 }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: "stripe_retrieve_failed", message: msg, status: 502 }
  }

  let stripeRefund
  try {
    stripeRefund = await createBlitzpayConnectRefund({
      stripeConnectAccountId: connectId,
      chargeId,
      amountCents: requested === remaining ? undefined : requested,
      idempotencyKey: params.idempotencyKey,
      refundApplicationFee: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, code: "stripe_refund_failed", message: msg, status: 502 }
  }

  const pending = stripeRefund.status === "pending"

  const { data: piInternal } = await params.admin
    .from("blitzpay_payment_intents")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("stripe_payment_intent_id", stripePiId)
    .maybeSingle()
  const internalPiId = (piInternal as { id?: string } | null)?.id ?? null

  if (stripeRefund.status === "succeeded") {
    const appliedOn = new Date().toISOString().slice(0, 10)
    await applyBlitzpaySucceededRefund(params.admin, {
      organizationId: params.organizationId,
      orgInvoiceId: params.invoiceId,
      orgInvoicePaymentId: params.orgInvoicePaymentId,
      blitzpayPaymentIntentId: internalPiId,
      stripeChargeId: chargeId,
      stripeRefundId: stripeRefund.id,
      amountBookedCents: Math.min(requested, remaining),
      currency: String(stripeRefund.currency || "usd"),
      appliedOnYyyyMmDd: appliedOn,
      staffUserId: params.staffUserId,
      idempotencyKey: params.idempotencyKey,
    })
    return {
      ok: true,
      stripeRefundId: stripeRefund.id,
      amountBookedCents: Math.min(requested, remaining),
      pending: false,
    }
  }

  if (pending) {
    return {
      ok: true,
      stripeRefundId: stripeRefund.id,
      amountBookedCents: Math.min(requested, remaining),
      pending: true,
    }
  }

  return {
    ok: false,
    code: "refund_not_completed",
    message: `Stripe refund status: ${stripeRefund.status}`,
    status: 502,
  }
}
