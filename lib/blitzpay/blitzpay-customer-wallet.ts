import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  balanceDueCentsForBlitzpay,
  loadInvoiceForBlitzpayPay,
  sumNetRecordedPaymentsCentsForBlitzpay,
} from "@/lib/blitzpay/invoice-pay-eligibility"
import { syncBlitzpayPayrollAccrualForOrgInvoice } from "@/lib/blitzpay/blitzpay-payroll-accrual"
import { insertOrgInvoicePaymentWithActor } from "@/lib/org-quotes-invoices/repository"

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return typeof err.message === "string" && err.message.toLowerCase().includes("duplicate")
}

export type BlitzpayWalletLedgerKind =
  | "credit_overpayment_invoice"
  | "credit_manual"
  | "debit_apply_invoice"
  | "debit_refund_clawback"

export const BLITZPAY_WALLET_OVERPAY_CREDIT_PREFIX = "blitzpay_wallet_overpayment_credit:"

function mapWalletRow(row: {
  id: string
  available_credit_cents: number | string
  refundable_credit_cents: number | string
}) {
  return {
    id: row.id,
    available_credit_cents: Math.max(0, Math.round(Number(row.available_credit_cents))),
    refundable_credit_cents: Math.max(0, Math.round(Number(row.refundable_credit_cents))),
  }
}

export async function getOrCreateBlitzpayCustomerWallet(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<{ id: string; available_credit_cents: number; refundable_credit_cents: number }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(customerId, "customerId")
  const { data: existing, error: exErr } = await admin
    .from("blitzpay_customer_wallets")
    .select("id, available_credit_cents, refundable_credit_cents")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .maybeSingle()
  if (exErr) throw new Error(exErr.message)
  if (existing) return mapWalletRow(existing as Parameters<typeof mapWalletRow>[0])

  const now = new Date().toISOString()
  const { data: inserted, error: insErr } = await admin
    .from("blitzpay_customer_wallets")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      available_credit_cents: 0,
      refundable_credit_cents: 0,
      created_at: now,
      updated_at: now,
    })
    .select("id, available_credit_cents, refundable_credit_cents")
    .maybeSingle()

  if (!insErr && inserted) {
    return mapWalletRow(inserted as Parameters<typeof mapWalletRow>[0])
  }
  if (isUniqueViolation(insErr)) {
    const { data: again, error: aErr } = await admin
      .from("blitzpay_customer_wallets")
      .select("id, available_credit_cents, refundable_credit_cents")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .maybeSingle()
    if (aErr) throw new Error(aErr.message)
    if (again) return mapWalletRow(again as Parameters<typeof mapWalletRow>[0])
  }
  if (insErr) throw new Error(insErr.message)
  throw new Error("wallet_create_failed")
}

export async function appendBlitzpayCustomerWalletLedger(
  admin: SupabaseClient,
  input: {
    organizationId: string
    customerId: string
    entryKind: BlitzpayWalletLedgerKind
    amountCents: number
    idempotencyKey: string
    metadata?: Record<string, unknown>
    orgInvoiceId?: string | null
    orgQuoteId?: string | null
    workOrderId?: string | null
  },
): Promise<{ duplicate: boolean; ledgerId?: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.customerId, "customerId")
  const idem = input.idempotencyKey.trim()
  if (!idem) throw new Error("idempotencyKey required")
  if (!Number.isFinite(input.amountCents) || input.amountCents === 0) {
    return { duplicate: false }
  }

  const wallet = await getOrCreateBlitzpayCustomerWallet(admin, input.organizationId, input.customerId)
  const meta = { ...(input.metadata ?? {}) }
  const now = new Date().toISOString()

  const { data: ins, error: insErr } = await admin
    .from("blitzpay_customer_wallet_ledger")
    .insert({
      organization_id: input.organizationId,
      customer_id: input.customerId,
      wallet_id: wallet.id,
      entry_kind: input.entryKind,
      amount_cents: Math.round(input.amountCents),
      idempotency_key: idem,
      metadata: meta,
      org_invoice_id: input.orgInvoiceId ?? null,
      org_quote_id: input.orgQuoteId ?? null,
      work_order_id: input.workOrderId ?? null,
      created_at: now,
    })
    .select("id")
    .maybeSingle()

  if (insErr) {
    if (isUniqueViolation(insErr)) {
      return { duplicate: true }
    }
    throw new Error(insErr.message)
  }
  if (!ins) {
    return { duplicate: true }
  }
  const ledgerId = (ins as { id: string }).id

  const { data: wFresh, error: wfErr } = await admin
    .from("blitzpay_customer_wallets")
    .select("available_credit_cents, refundable_credit_cents")
    .eq("id", wallet.id)
    .single()
  if (wfErr) throw new Error(wfErr.message)
  const baseAvail = Math.max(0, Math.round(Number((wFresh as { available_credit_cents: number }).available_credit_cents)))
  const baseRef = Math.max(0, Math.round(Number((wFresh as { refundable_credit_cents: number }).refundable_credit_cents)))

  const delta = Math.round(input.amountCents)
  let nextAvail = baseAvail + delta
  let nextRef = baseRef + delta
  nextAvail = Math.max(0, nextAvail)
  nextRef = Math.max(0, Math.min(nextAvail, nextRef))

  const { error: upErr } = await admin
    .from("blitzpay_customer_wallets")
    .update({
      available_credit_cents: nextAvail,
      refundable_credit_cents: nextRef,
      updated_at: now,
    })
    .eq("id", wallet.id)
    .eq("organization_id", input.organizationId)

  if (upErr) throw new Error(upErr.message)
  return { duplicate: false, ledgerId }
}

export async function creditBlitzpayWalletOverpaymentFromInvoicePayment(
  admin: SupabaseClient,
  input: {
    organizationId: string
    customerId: string
    stripePaymentIntentId: string
    amountCents: number
    orgInvoiceId: string
  },
): Promise<{ credited: boolean; duplicate: boolean }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.customerId, "customerId")
  assertUuid(input.orgInvoiceId, "orgInvoiceId")
  const c = Math.max(0, Math.round(input.amountCents))
  if (c <= 0) return { credited: false, duplicate: false }
  const idem = `${BLITZPAY_WALLET_OVERPAY_CREDIT_PREFIX}${input.stripePaymentIntentId}`
  const res = await appendBlitzpayCustomerWalletLedger(admin, {
    organizationId: input.organizationId,
    customerId: input.customerId,
    entryKind: "credit_overpayment_invoice",
    amountCents: c,
    idempotencyKey: idem,
    metadata: {
      source: "invoice_checkout_overpayment",
      org_invoice_id: input.orgInvoiceId,
    },
    orgInvoiceId: input.orgInvoiceId,
  })
  return { credited: !res.duplicate, duplicate: res.duplicate }
}

export async function appendBlitzpayManualWalletCredit(
  admin: SupabaseClient,
  input: {
    organizationId: string
    customerId: string
    amountCents: number
    note: string | null
    actorUserId: string | null
    idempotencyKey: string
  },
): Promise<{ duplicate: boolean }> {
  const c = Math.max(0, Math.round(input.amountCents))
  if (c <= 0) return { duplicate: false }
  return appendBlitzpayCustomerWalletLedger(admin, {
    organizationId: input.organizationId,
    customerId: input.customerId,
    entryKind: "credit_manual",
    amountCents: c,
    idempotencyKey: input.idempotencyKey.trim(),
    metadata: {
      source: "manual_credit",
      note: input.note?.trim() || null,
      actor_user_id: input.actorUserId,
    },
  })
}

export async function sumUnappliedEstimateDepositCentsForCustomer(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<number> {
  assertUuid(organizationId, "organizationId")
  assertUuid(customerId, "customerId")
  const { data, error } = await admin
    .from("org_quotes")
    .select("blitzpay_deposit_collected_cents")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .is("archived_at", null)
    .is("blitzpay_converted_invoice_id", null)

  if (error) throw new Error(error.message)
  return (data ?? []).reduce(
    (s, r) => s + Math.max(0, Math.round(Number((r as { blitzpay_deposit_collected_cents?: number }).blitzpay_deposit_collected_cents ?? 0))),
    0,
  )
}

export type BlitzpayCustomerWalletSummary = {
  availableCreditCents: number
  refundableCreditCents: number
  unappliedEstimateDepositCents: number
  /** Sum of positive ledger rows (credits posted). */
  lifetimeCreditsCents: number
  /** Absolute sum of debit_apply_invoice amounts. */
  appliedToInvoicesCents: number
  recentActivity: Array<{
    id: string
    entryKind: string
    amountCents: number
    createdAt: string
    label: string
  }>
}

function ledgerLabel(kind: string, amount: number): string {
  if (kind === "credit_overpayment_invoice") {
    return amount >= 0 ? "Credit from invoice overpayment" : "Adjustment"
  }
  if (kind === "credit_manual") return "Manual account credit"
  if (kind === "debit_apply_invoice") return "Applied to an invoice"
  if (kind === "debit_refund_clawback") return "Adjustment from refund"
  return "Account activity"
}

export async function fetchBlitzpayCustomerWalletSummary(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<BlitzpayCustomerWalletSummary> {
  const wallet = await getOrCreateBlitzpayCustomerWallet(admin, organizationId, customerId)
  const unapplied = await sumUnappliedEstimateDepositCentsForCustomer(admin, organizationId, customerId)

  const { data: ledRows, error: ledErr } = await admin
    .from("blitzpay_customer_wallet_ledger")
    .select("id, entry_kind, amount_cents, created_at")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(25)

  if (ledErr) throw new Error(ledErr.message)

  let lifetimeCredits = 0
  let appliedInvoices = 0
  for (const r of ledRows ?? []) {
    const row = r as { entry_kind: string; amount_cents: number | string }
    const amt = Math.round(Number(row.amount_cents))
    if (amt > 0) lifetimeCredits += amt
    if (row.entry_kind === "debit_apply_invoice" && amt < 0) {
      appliedInvoices += -amt
    }
  }

  const recentActivity = (ledRows ?? []).slice(0, 12).map((r) => {
    const row = r as { id: string; entry_kind: string; amount_cents: number | string; created_at: string }
    const amt = Math.round(Number(row.amount_cents))
    return {
      id: row.id,
      entryKind: row.entry_kind,
      amountCents: amt,
      createdAt: row.created_at,
      label: ledgerLabel(row.entry_kind, amt),
    }
  })

  return {
    availableCreditCents: wallet.available_credit_cents,
    refundableCreditCents: wallet.refundable_credit_cents,
    unappliedEstimateDepositCents: unapplied,
    lifetimeCreditsCents: lifetimeCredits,
    appliedToInvoicesCents: appliedInvoices,
    recentActivity,
  }
}

/**
 * Applies wallet balance to an invoice as an org_invoice_payments row (replay-safe via idempotencyKey).
 */
export async function applyBlitzpayWalletCreditToInvoice(
  admin: SupabaseClient,
  input: {
    organizationId: string
    customerId: string
    invoiceId: string
    amountCents: number
    idempotencyKey: string
    actorUserId: string | null
  },
): Promise<{ ok: true; appliedCents: number; paymentReference: string } | { ok: false; code: string; message: string }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.customerId, "customerId")
  assertUuid(input.invoiceId, "invoiceId")
  const idem = input.idempotencyKey.trim()
  if (!idem) return { ok: false, code: "bad_request", message: "idempotencyKey is required." }

  const wallet = await getOrCreateBlitzpayCustomerWallet(admin, input.organizationId, input.customerId)
  const requested = Math.max(0, Math.round(input.amountCents))
  if (requested < 1) return { ok: false, code: "invalid_amount", message: "Amount must be at least 1 cent." }
  const spendable = Math.max(0, wallet.available_credit_cents)
  if (spendable < 1) return { ok: false, code: "insufficient_wallet", message: "No account credit available to apply." }

  const inv = await loadInvoiceForBlitzpayPay(admin, input.organizationId, input.invoiceId)
  if (!inv) return { ok: false, code: "invoice_not_found", message: "Invoice not found." }
  if (String(inv.customer_id) !== input.customerId) {
    return { ok: false, code: "customer_mismatch", message: "Invoice does not belong to this customer." }
  }

  const netPaid = await sumNetRecordedPaymentsCentsForBlitzpay(admin, input.organizationId, input.invoiceId)
  const balanceDue = balanceDueCentsForBlitzpay(inv, netPaid)
  if (balanceDue < 1) {
    return { ok: false, code: "invoice_paid", message: "This invoice has no balance due." }
  }

  const applyCents = Math.min(requested, spendable, balanceDue)
  if (applyCents < 1) {
    return { ok: false, code: "nothing_to_apply", message: "Nothing to apply after caps." }
  }

  const ledgerIdem = `blitzpay_wallet_apply_ledger:${idem}`
  const payRef = `blitzpay_wallet_apply:${idem}`

  const led = await appendBlitzpayCustomerWalletLedger(admin, {
    organizationId: input.organizationId,
    customerId: input.customerId,
    entryKind: "debit_apply_invoice",
    amountCents: -applyCents,
    idempotencyKey: ledgerIdem,
    metadata: { org_invoice_id: input.invoiceId, wallet_apply_idempotency: idem },
    orgInvoiceId: input.invoiceId,
  })
  if (led.duplicate) {
    return { ok: true, appliedCents: 0, paymentReference: payRef }
  }

  const paidOn = new Date().toISOString().slice(0, 10)
  const ins = await insertOrgInvoicePaymentWithActor(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    amountCents: applyCents,
    paidOn,
    paymentMethod: "card",
    reference: payRef,
    note: "BlitzPay account credit applied to invoice",
    createdByUserId: input.actorUserId,
  })
  if (ins.error) {
    await appendBlitzpayCustomerWalletLedger(admin, {
      organizationId: input.organizationId,
      customerId: input.customerId,
      entryKind: "credit_manual",
      amountCents: applyCents,
      idempotencyKey: `blitzpay_wallet_apply_rollback:${idem}`,
      metadata: { reason: "payment_insert_failed", org_invoice_id: input.invoiceId },
      orgInvoiceId: input.invoiceId,
    }).catch(() => {})
    return { ok: false, code: "payment_insert_failed", message: ins.error }
  }

  try {
    await syncBlitzpayPayrollAccrualForOrgInvoice(admin, {
      organizationId: input.organizationId,
      orgInvoiceId: input.invoiceId,
    })
  } catch {
    /* best-effort accrual refresh */
  }

  return { ok: true, appliedCents: applyCents, paymentReference: payRef }
}

export async function clawbackBlitzpayWalletOverpaymentForStripeRefund(
  admin: SupabaseClient,
  input: {
    organizationId: string
    customerId: string
    stripePaymentIntentId: string
    stripeRefundId: string
    refundAmountCents: number
  },
): Promise<{ clawedCents: number; duplicate: boolean }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.customerId, "customerId")
  const refundCents = Math.max(0, Math.round(input.refundAmountCents))
  if (refundCents <= 0) return { clawedCents: 0, duplicate: false }

  const creditIdem = `${BLITZPAY_WALLET_OVERPAY_CREDIT_PREFIX}${input.stripePaymentIntentId}`
  const { data: creditRow, error: crErr } = await admin
    .from("blitzpay_customer_wallet_ledger")
    .select("amount_cents")
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", creditIdem)
    .maybeSingle()
  if (crErr || !creditRow) {
    return { clawedCents: 0, duplicate: false }
  }
  const credited = Math.max(0, Math.round(Number((creditRow as { amount_cents: number }).amount_cents)))
  if (credited <= 0) return { clawedCents: 0, duplicate: false }

  const claw = Math.min(credited, refundCents)
  if (claw < 1) return { clawedCents: 0, duplicate: false }

  const idem = `blitzpay_wallet_refund_clawback:${input.stripeRefundId}`
  const res = await appendBlitzpayCustomerWalletLedger(admin, {
    organizationId: input.organizationId,
    customerId: input.customerId,
    entryKind: "debit_refund_clawback",
    amountCents: -claw,
    idempotencyKey: idem,
    metadata: {
      source: "stripe_refund",
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_refund_id: input.stripeRefundId,
    },
  })
  return { clawedCents: res.duplicate ? 0 : claw, duplicate: res.duplicate }
}
