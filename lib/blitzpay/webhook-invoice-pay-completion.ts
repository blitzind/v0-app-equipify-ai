import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { insertOrgInvoicePaymentWithActor } from "@/lib/org-quotes-invoices/repository"
import { parseBlitzpayInvoiceMetadata } from "@/lib/blitzpay/stripe-metadata"
import {
  appendBlitzpayLedgerEntry,
  fetchBlitzpayPaymentIntentByStripeId,
  updateBlitzpayInvoicePaymentAttemptsForInternalIntent,
} from "@/lib/blitzpay/payment-repository"

function blitzpayPiReference(piId: string): string {
  return `blitzpay_pi:${piId}`
}

type BlitzpayPiRow = {
  id: string
  organization_id: string
  org_invoice_id: string | null
  invoice_amount_cents: string | null
  amount_cents: string
  currency: string
}

export async function completeBlitzpayPaymentIntentSucceeded(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
  eventCreatedMs: number,
): Promise<void> {
  const raw = await fetchBlitzpayPaymentIntentByStripeId(admin, pi.id)
  if (!raw) return

  const row = raw as BlitzpayPiRow
  const meta = parseBlitzpayInvoiceMetadata(pi.metadata as Record<string, string> | undefined)
  if (!meta || meta.organizationId !== row.organization_id) return
  if (!row.org_invoice_id) return

  const ref = blitzpayPiReference(pi.id)
  const { count, error: cErr } = await admin
    .from("org_invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", row.organization_id)
    .eq("invoice_id", row.org_invoice_id)
    .eq("reference", ref)

  if (cErr) throw new Error(cErr.message)

  const invoicePortionCents = Math.round(
    Math.min(
      Number(row.invoice_amount_cents ?? row.amount_cents),
      Number(pi.amount_received ?? pi.amount ?? 0),
    ),
  )

  if (invoicePortionCents <= 0) {
    await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
      status: "completed",
      failureCode: null,
    })
    return
  }

  if ((count ?? 0) === 0) {
    const paidOn = new Date(eventCreatedMs * 1000).toISOString().slice(0, 10)
    const ins = await insertOrgInvoicePaymentWithActor(admin, {
      organizationId: row.organization_id,
      invoiceId: row.org_invoice_id,
      amountCents: invoicePortionCents,
      paidOn,
      paymentMethod: "card",
      reference: ref,
      note: "BlitzPay (Stripe Checkout)",
      createdByUserId: null,
    })
    if (ins.error) {
      throw new Error(ins.error)
    }

    const chargeId =
      typeof pi.latest_charge === "string"
        ? pi.latest_charge
        : pi.latest_charge && typeof pi.latest_charge === "object" && "id" in pi.latest_charge
          ? String((pi.latest_charge as { id: string }).id)
          : pi.id

    await appendBlitzpayLedgerEntry(admin, {
      organizationId: row.organization_id,
      entryType: "payment_captured",
      amountCents: BigInt(invoicePortionCents),
      currency: row.currency || "usd",
      stripeObjectId: chargeId,
      blitzpayPaymentIntentId: row.id,
      orgInvoiceId: row.org_invoice_id,
      metadata: { stripe_payment_intent_id: pi.id },
    })

    const appFee = pi.application_fee_amount
    if (typeof appFee === "number" && appFee > 0) {
      await appendBlitzpayLedgerEntry(admin, {
        organizationId: row.organization_id,
        entryType: "application_fee_received",
        amountCents: BigInt(appFee),
        currency: row.currency || "usd",
        stripeObjectId: chargeId,
        blitzpayPaymentIntentId: row.id,
        orgInvoiceId: row.org_invoice_id,
        metadata: { stripe_payment_intent_id: pi.id },
      })
    }
  }

  await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
    status: "completed",
    failureCode: null,
  })
}

export async function completeBlitzpayPaymentIntentFailed(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const raw = await fetchBlitzpayPaymentIntentByStripeId(admin, pi.id)
  if (!raw) return
  const row = raw as BlitzpayPiRow
  const code =
    pi.last_payment_error && typeof pi.last_payment_error === "object" && "code" in pi.last_payment_error
      ? String((pi.last_payment_error as { code?: string }).code ?? "")
      : null
  await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
    status: "failed",
    failureCode: code,
  })
}

export async function completeBlitzpayPaymentIntentCanceled(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const raw = await fetchBlitzpayPaymentIntentByStripeId(admin, pi.id)
  if (!raw) return
  const row = raw as BlitzpayPiRow
  await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
    status: "expired",
    failureCode: "canceled",
  })
}
