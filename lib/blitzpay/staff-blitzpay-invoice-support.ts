import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { fetchBlitzpayPaymentIntentsForInvoice } from "@/lib/blitzpay/payment-repository"
import { summarizeBlitzpayBalanceTransactions } from "@/lib/blitzpay/blitzpay-reconciliation-math"

export type StaffBlitzpayRefundRow = {
  id: string
  orgInvoicePaymentId: string
  stripeRefundIdTail: string
  amountCents: number
  currency: string
  status: string
  appliedOn: string | null
  createdAt: string
}

export type StaffBlitzpayDisputeRow = {
  id: string
  stripeDisputeIdTail: string
  amountCents: number
  currency: string
  status: string
  openedAt: string | null
  updatedAt: string
}

export async function fetchStaffBlitzpayInvoiceRefunds(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
): Promise<StaffBlitzpayRefundRow[]> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")
  const { data, error } = await admin
    .from("blitzpay_invoice_refunds")
    .select(
      "id, org_invoice_payment_id, stripe_refund_id, amount_cents, currency, status, applied_on, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", orgInvoiceId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => {
    const row = r as {
      id: string
      org_invoice_payment_id: string
      stripe_refund_id: string
      amount_cents: number
      currency: string
      status: string
      applied_on: string | null
      created_at: string
    }
    const rid = String(row.stripe_refund_id ?? "")
    return {
      id: row.id,
      orgInvoicePaymentId: row.org_invoice_payment_id,
      stripeRefundIdTail: rid.length > 8 ? rid.slice(-8) : rid,
      amountCents: Math.round(Number(row.amount_cents)),
      currency: String(row.currency || "usd").toLowerCase(),
      status: row.status,
      appliedOn: row.applied_on,
      createdAt: row.created_at,
    }
  })
}

export async function fetchStaffBlitzpayInvoiceDisputes(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
): Promise<StaffBlitzpayDisputeRow[]> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")
  const { data, error } = await admin
    .from("blitzpay_invoice_disputes")
    .select("id, stripe_dispute_id, amount_cents, currency, status, opened_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", orgInvoiceId)
    .order("created_at", { ascending: false })
    .limit(30)

  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => {
    const row = r as {
      id: string
      stripe_dispute_id: string
      amount_cents: number
      currency: string
      status: string
      opened_at: string | null
      updated_at: string
    }
    const did = String(row.stripe_dispute_id ?? "")
    return {
      id: row.id,
      stripeDisputeIdTail: did.length > 8 ? did.slice(-8) : did,
      amountCents: Math.round(Number(row.amount_cents)),
      currency: String(row.currency || "usd").toLowerCase(),
      status: row.status,
      openedAt: row.opened_at,
      updatedAt: row.updated_at,
    }
  })
}

export type StaffBlitzpayInvoiceDiagnostics = {
  balanceTransactionReconciliation: {
    syncedRowCount: number
    sumStripeFeesCents: number
    sumNetCents: number
    paymentLikeNetCents: number
    refundLikeNetCents: number
    disputeLikeNetCents: number
  } | null
  paymentIntents: Array<{
    id: string
    stripePaymentIntentIdTail: string | null
    checkoutSessionTail: string | null
    status: string
    amountCents: number
    currency: string
    lastStripeEventAt: string | null
    updatedAt: string
  }>
  webhookInboxTail: Array<{
    stripeEventIdTail: string
    eventType: string
    processingStatus: string
    attemptCount: number
    lastError: string | null
    processedAt: string | null
    createdAt: string
  }>
  replaySafetyNotes: string[]
}

export async function fetchStaffBlitzpayInvoiceDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
  orgInvoiceId: string,
): Promise<StaffBlitzpayInvoiceDiagnostics> {
  assertUuid(organizationId, "organizationId")
  assertUuid(orgInvoiceId, "orgInvoiceId")

  const rawPis = await fetchBlitzpayPaymentIntentsForInvoice(admin, organizationId, orgInvoiceId, 25)
  const paymentIntents = (rawPis as Array<Record<string, unknown>>).map((p) => {
    const piId = String(p.stripe_payment_intent_id ?? "")
    const csId = String(p.stripe_checkout_session_id ?? "")
    return {
      id: String(p.id ?? ""),
      stripePaymentIntentIdTail: piId.length > 8 ? piId.slice(-8) : piId || null,
      checkoutSessionTail: csId.length > 8 ? csId.slice(-8) : csId || null,
      status: String(p.status ?? ""),
      amountCents: Math.round(Number(p.amount_cents ?? 0)),
      currency: String(p.currency ?? "usd").toLowerCase(),
      lastStripeEventAt: p.last_stripe_event_at ? String(p.last_stripe_event_at) : null,
      updatedAt: String(p.updated_at ?? ""),
    }
  })

  const internalPiIds = paymentIntents.map((p) => p.id).filter((id) => id.length > 0)
  let balanceTransactionReconciliation: StaffBlitzpayInvoiceDiagnostics["balanceTransactionReconciliation"] = null
  if (internalPiIds.length > 0) {
    const { data: btRows, error: btErr } = await admin
      .from("blitzpay_balance_transactions")
      .select("balance_type, gross_cents, fee_cents, net_cents")
      .eq("organization_id", organizationId)
      .in("blitzpay_payment_intent_id", internalPiIds)
    if (!btErr && btRows && btRows.length > 0) {
      const t = summarizeBlitzpayBalanceTransactions(
        btRows as Array<{ balance_type: string; gross_cents: number; fee_cents: number; net_cents: number }>,
      )
      balanceTransactionReconciliation = {
        syncedRowCount: btRows.length,
        sumStripeFeesCents: t.sumStripeFeesCents,
        sumNetCents: t.sumNetCents,
        paymentLikeNetCents: t.paymentLikeNetCents,
        refundLikeNetCents: t.refundLikeNetCents,
        disputeLikeNetCents: t.disputeLikeNetCents,
      }
    }
  }

  const { data: orgRow } = await admin
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", organizationId)
    .maybeSingle()
  const connectAcct = String(
    (orgRow as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id ?? "",
  ).trim()

  let webhookInboxTail: StaffBlitzpayInvoiceDiagnostics["webhookInboxTail"] = []
  if (connectAcct) {
    const { data: inbox, error: inErr } = await admin
      .from("blitzpay_webhook_inbox")
      .select("stripe_event_id, event_type, processing_status, attempt_count, last_error, processed_at, created_at")
      .eq("stripe_connect_account", connectAcct)
      .order("created_at", { ascending: false })
      .limit(25)
    if (!inErr && inbox) {
      webhookInboxTail = (inbox as Array<Record<string, unknown>>).map((row) => {
        const eid = String(row.stripe_event_id ?? "")
        return {
          stripeEventIdTail: eid.length > 10 ? eid.slice(-10) : eid,
          eventType: String(row.event_type ?? ""),
          processingStatus: String(row.processing_status ?? ""),
          attemptCount: Math.round(Number(row.attempt_count ?? 0)),
          lastError: row.last_error ? String(row.last_error) : null,
          processedAt: row.processed_at ? String(row.processed_at) : null,
          createdAt: String(row.created_at ?? ""),
        }
      })
    }
  }

  return {
    balanceTransactionReconciliation,
    paymentIntents,
    webhookInboxTail,
    replaySafetyNotes: [
      "Stripe Connect events dedupe at ingress via blitzpay_stripe_webhook_events (evt_… id).",
      "Allocation uses org_invoice_payments.reference = blitzpay_pi:<id> uniqueness.",
      "Refunds use unique stripe_refund_id + ledger (organization_id, entry_type, stripe_object_id).",
      "Payout rows upsert on stripe_payout_id; balance transactions upsert on (organization_id, stripe_balance_transaction_id).",
      "Webhook inbox rows mark done/dead for this Connect account — safe Stripe retries on 500 after delete.",
    ],
  }
}
