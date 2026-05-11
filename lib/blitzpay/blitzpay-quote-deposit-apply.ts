import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { insertOrgInvoicePaymentWithActor } from "@/lib/org-quotes-invoices/repository"
import {
  balanceDueCentsForBlitzpay,
  loadInvoiceForBlitzpayPay,
  sumNetRecordedPaymentsCentsForBlitzpay,
} from "@/lib/blitzpay/invoice-pay-eligibility"

const APPLY_REF_PREFIX = "blitzpay_quote_deposit_apply:"

export function blitzpayQuoteDepositApplyReference(quoteId: string): string {
  return `${APPLY_REF_PREFIX}${quoteId}`
}

/**
 * Applies collected BlitzPay estimate deposit as an org_invoice_payments credit row (idempotent per quote).
 * Does not create duplicate credits if called twice for the same quote+invoice.
 */
export async function applyBlitzpayQuoteDepositCreditToInvoice(
  admin: SupabaseClient,
  input: {
    organizationId: string
    quoteId: string
    invoiceId: string
    actorUserId: string | null
  },
): Promise<{ ok: true; appliedCents: number } | { ok: false; code: string; message: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.quoteId, "quoteId")
  assertUuid(input.invoiceId, "invoiceId")

  const { data: q, error: qErr } = await admin
    .from("org_quotes")
    .select(
      "id, organization_id, customer_id, blitzpay_deposit_collected_cents, blitzpay_converted_invoice_id, archived_at",
    )
    .eq("id", input.quoteId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (qErr) return { ok: false, code: "query_failed", message: qErr.message }
  const quote = q as {
    id: string
    customer_id?: string
    blitzpay_deposit_collected_cents?: string | number
    blitzpay_converted_invoice_id?: string | null
    archived_at?: string | null
  } | null
  if (!quote || quote.archived_at) return { ok: false, code: "quote_not_found", message: "Quote not found." }

  const collected = Math.max(0, Math.round(Number(quote.blitzpay_deposit_collected_cents ?? 0)))
  if (collected <= 0) {
    return { ok: true, appliedCents: 0 }
  }

  const ref = blitzpayQuoteDepositApplyReference(input.quoteId)
  const { count: existingApply, error: exErr } = await admin
    .from("org_invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("invoice_id", input.invoiceId)
    .eq("reference", ref)
  if (exErr) return { ok: false, code: "query_failed", message: exErr.message }
  if ((existingApply ?? 0) > 0) {
    return { ok: true, appliedCents: 0 }
  }

  const inv = await loadInvoiceForBlitzpayPay(admin, input.organizationId, input.invoiceId)
  if (!inv) return { ok: false, code: "invoice_not_found", message: "Invoice not found." }
  if (String(inv.customer_id) !== String(quote.customer_id ?? "")) {
    return { ok: false, code: "customer_mismatch", message: "Invoice customer does not match quote customer." }
  }

  const netPaid = await sumNetRecordedPaymentsCentsForBlitzpay(admin, input.organizationId, input.invoiceId)
  const balanceDue = balanceDueCentsForBlitzpay(inv, netPaid)
  const applyCents = Math.min(collected, Math.max(0, balanceDue))
  if (applyCents <= 0) {
    await admin
      .from("org_quotes")
      .update({ blitzpay_converted_invoice_id: input.invoiceId })
      .eq("id", input.quoteId)
      .eq("organization_id", input.organizationId)
    return { ok: true, appliedCents: 0 }
  }

  const paidOn = new Date().toISOString().slice(0, 10)
  const ins = await insertOrgInvoicePaymentWithActor(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    amountCents: applyCents,
    paidOn,
    paymentMethod: "card",
    reference: ref,
    note: "BlitzPay estimate deposit applied from quote",
    createdByUserId: input.actorUserId,
  })
  if (ins.error) {
    return { ok: false, code: "payment_insert_failed", message: ins.error }
  }

  await admin
    .from("org_quotes")
    .update({ blitzpay_converted_invoice_id: input.invoiceId })
    .eq("id", input.quoteId)
    .eq("organization_id", input.organizationId)

  return { ok: true, appliedCents: applyCents }
}
