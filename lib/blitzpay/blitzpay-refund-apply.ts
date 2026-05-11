import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { reconcileOrgInvoiceFromPayments } from "@/lib/org-quotes-invoices/repository"
import { appendBlitzpayLedgerEntry, fetchBlitzpayPaymentIntentByStripeId } from "@/lib/blitzpay/payment-repository"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { clawbackBlitzpayWalletOverpaymentForStripeRefund } from "@/lib/blitzpay/blitzpay-customer-wallet"

function blitzpayPiReference(piId: string): string {
  return `blitzpay_pi:${piId}`
}

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return typeof err.message === "string" && err.message.toLowerCase().includes("duplicate")
}

export async function sumSucceededBlitzpayRefundsForOrgInvoicePayment(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoicePaymentId: string,
): Promise<number> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoicePaymentId, "orgInvoicePaymentId")
  const { data, error } = await admin
    .from("blitzpay_invoice_refunds")
    .select("amount_cents")
    .eq("organization_id", organizationId)
    .eq("org_invoice_payment_id", orgInvoicePaymentId)
    .eq("status", "succeeded")

  if (error) throw new Error(error.message)
  return (data ?? []).reduce((s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)), 0)
}

export type ApplyBlitzpaySucceededRefundInput = {
  organizationId: string
  orgInvoiceId: string
  orgInvoicePaymentId: string
  blitzpayPaymentIntentId: string | null
  stripeChargeId: string
  stripeRefundId: string
  /** Amount booked against the invoice payment (capped; cents). */
  amountBookedCents: number
  currency: string
  /** Calendar day applied (invoice reconciliation). */
  appliedOnYyyyMmDd: string
  staffUserId?: string | null
  idempotencyKey?: string | null
}

/**
 * Idempotent: one row per stripe_refund_id; ledger uses same id for duplicate skip.
 */
export async function applyBlitzpaySucceededRefund(
  admin: SupabaseClient,
  input: ApplyBlitzpaySucceededRefundInput,
): Promise<{ applied: boolean; duplicate: boolean }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.orgInvoiceId, "orgInvoiceId")
  assertUuid(input.orgInvoicePaymentId, "orgInvoicePaymentId")
  if (!Number.isInteger(input.amountBookedCents) || input.amountBookedCents <= 0) {
    return { applied: false, duplicate: false }
  }

  const row = {
    organization_id: input.organizationId,
    org_invoice_id: input.orgInvoiceId,
    org_invoice_payment_id: input.orgInvoicePaymentId,
    blitzpay_payment_intent_id: input.blitzpayPaymentIntentId,
    stripe_charge_id: input.stripeChargeId,
    stripe_refund_id: input.stripeRefundId,
    amount_cents: input.amountBookedCents,
    currency: input.currency.trim().toLowerCase(),
    status: "succeeded" as const,
    applied_on: input.appliedOnYyyyMmDd.slice(0, 10),
    staff_user_id: input.staffUserId ?? null,
    idempotency_key: input.idempotencyKey?.trim() || null,
    metadata: {},
    updated_at: new Date().toISOString(),
  }

  const { data: ins, error: insErr } = await admin.from("blitzpay_invoice_refunds").insert(row).select("id").maybeSingle()

  if (insErr) {
    if (isUniqueViolation(insErr)) {
      await reconcileOrgInvoiceFromPayments(admin, input.organizationId, input.orgInvoiceId)
      return { applied: false, duplicate: true }
    }
    throw new Error(insErr.message)
  }
  if (!ins) {
    await reconcileOrgInvoiceFromPayments(admin, input.organizationId, input.orgInvoiceId)
    return { applied: false, duplicate: true }
  }

  await appendBlitzpayLedgerEntry(admin, {
    organizationId: input.organizationId,
    entryType: "refund",
    amountCents: BigInt(input.amountBookedCents),
    currency: input.currency,
    stripeObjectId: input.stripeRefundId,
    blitzpayPaymentIntentId: input.blitzpayPaymentIntentId,
    orgInvoiceId: input.orgInvoiceId,
    metadata: { stripe_charge_id: input.stripeChargeId },
  })

  await reconcileOrgInvoiceFromPayments(admin, input.organizationId, input.orgInvoiceId)
  return { applied: true, duplicate: false }
}

export async function resolveBlitzpayOrgInvoicePaymentForPi(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
  stripePaymentIntentId: string,
): Promise<{ id: string; amount_cents: number } | null> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")
  const ref = blitzpayPiReference(stripePaymentIntentId)
  const { data, error } = await admin
    .from("org_invoice_payments")
    .select("id, amount_cents")
    .eq("organization_id", organizationId)
    .eq("invoice_id", orgInvoiceId)
    .eq("reference", ref)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as { id: string; amount_cents: number }
  return { id: row.id, amount_cents: Math.round(Number(row.amount_cents)) }
}

/**
 * For a succeeded Stripe refund, book up to remaining refundable on the BlitzPay invoice payment row.
 */
export async function applyBlitzpayStripeRefundToInvoiceIfEligible(
  admin: SupabaseClient,
  stripeRefund: Stripe.Refund,
  connectAccountId: string,
  charge: Stripe.Charge,
): Promise<{ applied: boolean; duplicate: boolean }> {
  if (stripeRefund.status !== "succeeded") {
    return { applied: false, duplicate: false }
  }

  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent && typeof charge.payment_intent === "object" && "id" in charge.payment_intent
        ? String((charge.payment_intent as { id: string }).id)
        : ""
  if (!piId) return { applied: false, duplicate: false }

  const rawPi = await fetchBlitzpayPaymentIntentByStripeId(admin, piId)
  if (!rawPi) return { applied: false, duplicate: false }

  const piRow = rawPi as {
    id: string
    organization_id: string
    org_invoice_id: string | null
    org_quote_id?: string | null
    currency: string
    customer_id?: string | null
  }
  if (piRow.org_quote_id && !piRow.org_invoice_id) {
    return applyBlitzpayStripeRefundToQuoteDeposit(admin, stripeRefund, piRow)
  }

  if (!piRow.org_invoice_id || piRow.organization_id.length === 0) return { applied: false, duplicate: false }

  const pay = await resolveBlitzpayOrgInvoicePaymentForPi(
    admin,
    piRow.organization_id,
    piRow.org_invoice_id,
    piId,
  )
  if (!pay) return { applied: false, duplicate: false }

  const already = await sumSucceededBlitzpayRefundsForOrgInvoicePayment(
    admin,
    piRow.organization_id,
    pay.id,
  )
  const remaining = Math.max(0, pay.amount_cents - already)
  const stripeAmount = Math.round(Number(stripeRefund.amount ?? 0))
  const amountBooked = Math.min(remaining, stripeAmount)
  if (amountBooked <= 0) {
    return { applied: false, duplicate: false }
  }

  const createdSec = typeof stripeRefund.created === "number" ? stripeRefund.created : Math.floor(Date.now() / 1000)
  const appliedOn = new Date(createdSec * 1000).toISOString().slice(0, 10)
  const chargeId = typeof charge.id === "string" ? charge.id : String(charge.id)

  const out = await applyBlitzpaySucceededRefund(admin, {
    organizationId: piRow.organization_id,
    orgInvoiceId: piRow.org_invoice_id,
    orgInvoicePaymentId: pay.id,
    blitzpayPaymentIntentId: piRow.id,
    stripeChargeId: chargeId,
    stripeRefundId: stripeRefund.id,
    amountBookedCents: amountBooked,
    currency: stripeRefund.currency || piRow.currency || "usd",
    appliedOnYyyyMmDd: appliedOn,
    staffUserId: null,
    idempotencyKey: null,
  })
  const cust = String(piRow.customer_id ?? "").trim()
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (out.applied && UUID_RE.test(cust)) {
    await clawbackBlitzpayWalletOverpaymentForStripeRefund(admin, {
      organizationId: piRow.organization_id,
      customerId: cust,
      stripePaymentIntentId: piId,
      stripeRefundId: stripeRefund.id,
      refundAmountCents: stripeAmount,
    })
  }
  return out
}

/**
 * Webhook refund path for estimate deposits (no org_invoice_payments row).
 * Idempotent via ledger (organization_id, entry_type, stripe_object_id) on Stripe refund id.
 */
export async function applyBlitzpayStripeRefundToQuoteDeposit(
  admin: SupabaseClient,
  stripeRefund: Stripe.Refund,
  piRow: {
    id: string
    organization_id: string
    org_quote_id: string
    currency: string
  },
): Promise<{ applied: boolean; duplicate: boolean }> {
  if (stripeRefund.status !== "succeeded") {
    return { applied: false, duplicate: false }
  }
  const stripeAmount = Math.round(Number(stripeRefund.amount ?? 0))
  if (stripeAmount <= 0) return { applied: false, duplicate: false }

  const led = await appendBlitzpayLedgerEntry(admin, {
    organizationId: piRow.organization_id,
    entryType: "refund",
    amountCents: BigInt(stripeAmount),
    currency: stripeRefund.currency || piRow.currency || "usd",
    stripeObjectId: stripeRefund.id,
    blitzpayPaymentIntentId: piRow.id,
    orgInvoiceId: null,
    orgQuoteId: piRow.org_quote_id,
    metadata: { revenue_recognition: "estimate_deposit_refund" },
  })

  if (led.duplicate) {
    return { applied: false, duplicate: true }
  }

  const { data: cur, error: curErr } = await admin
    .from("org_quotes")
    .select("blitzpay_deposit_collected_cents")
    .eq("id", piRow.org_quote_id)
    .eq("organization_id", piRow.organization_id)
    .maybeSingle()
  if (!curErr && cur) {
    const prev = Math.max(0, Math.round(Number((cur as { blitzpay_deposit_collected_cents?: number }).blitzpay_deposit_collected_cents ?? 0)))
    const next = Math.max(0, prev - stripeAmount)
    await admin
      .from("org_quotes")
      .update({ blitzpay_deposit_collected_cents: next })
      .eq("id", piRow.org_quote_id)
      .eq("organization_id", piRow.organization_id)
  }

  return { applied: true, duplicate: false }
}
