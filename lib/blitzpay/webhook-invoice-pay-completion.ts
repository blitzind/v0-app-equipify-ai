import "server-only"

import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"
import { insertOrgInvoicePaymentWithActor } from "@/lib/org-quotes-invoices/repository"
import { parseBlitzpayEstimateMetadata } from "@/lib/blitzpay/blitzpay-estimate-stripe-metadata"
import { parseBlitzpayInvoiceMetadata } from "@/lib/blitzpay/stripe-metadata"
import { completeBlitzpayEstimateDepositPaymentIntentSucceeded } from "@/lib/blitzpay/webhook-estimate-deposit-completion"
import {
  appendBlitzpayLedgerEntry,
  fetchBlitzpayPaymentIntentByStripeId,
  updateBlitzpayPaymentIntentMethodDetails,
  updateBlitzpayInvoicePaymentAttemptsForInternalIntent,
} from "@/lib/blitzpay/payment-repository"
import { dispatchBlitzpayPaymentReceiptEmails } from "@/lib/blitzpay/blitzpay-receipt-email-dispatch"
import { syncBlitzpayCustomerPaymentProfileFromPaymentIntent } from "@/lib/blitzpay/blitzpay-payment-profiles"
import { creditBlitzpayWalletOverpaymentFromInvoicePayment } from "@/lib/blitzpay/blitzpay-customer-wallet"
import {
  balanceDueCentsForBlitzpay,
  loadInvoiceForBlitzpayPay,
  sumNetRecordedPaymentsCentsForBlitzpay,
} from "@/lib/blitzpay/invoice-pay-eligibility"

function blitzpayPiReference(piId: string): string {
  return `blitzpay_pi:${piId}`
}

type BlitzpayPiRow = {
  id: string
  organization_id: string
  org_quote_id?: string | null
  org_invoice_id: string | null
  invoice_amount_cents: string | null
  amount_cents: string
  currency: string
  customer_id: string | null
  stripe_connect_account_id: string
  stripe_customer_id: string | null
  save_payment_method_requested: boolean
  payment_method_type: string | null
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function completeBlitzpayPaymentIntentSucceeded(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
  eventCreatedMs: number,
): Promise<void> {
  const raw = await fetchBlitzpayPaymentIntentByStripeId(admin, pi.id)
  if (!raw) return

  const row = raw as BlitzpayPiRow
  const estMeta = parseBlitzpayEstimateMetadata(pi.metadata as Record<string, string> | undefined)
  if (estMeta && estMeta.organizationId === row.organization_id && row.org_quote_id === estMeta.orgQuoteId) {
    await completeBlitzpayEstimateDepositPaymentIntentSucceeded(admin, pi, row, eventCreatedMs, estMeta)
    return
  }

  const meta = parseBlitzpayInvoiceMetadata(pi.metadata as Record<string, string> | undefined)
  if (!meta || meta.organizationId !== row.organization_id) return
  if (!row.org_invoice_id) return
  const scheduledPaymentId = meta.scheduledPaymentId

  const stripePmType =
    typeof pi.payment_method === "object" && pi.payment_method ?
      (pi.payment_method as Stripe.PaymentMethod).type
    : null
  const stripePmId =
    typeof pi.payment_method === "string" ? pi.payment_method
    : pi.payment_method && typeof pi.payment_method === "object" ? pi.payment_method.id
    : null
  const stripeCustomer =
    typeof pi.customer === "string" ? pi.customer
    : pi.customer && typeof pi.customer === "object" ? pi.customer.id
    : row.stripe_customer_id
  await updateBlitzpayPaymentIntentMethodDetails(admin, pi.id, {
    paymentMethodType: stripePmType === "card" || stripePmType === "us_bank_account" ? stripePmType : null,
    stripePaymentMethodId: stripePmId,
    stripeCustomerId: stripeCustomer,
    achSettlementState:
      stripePmType === "us_bank_account" ? (pi.status === "succeeded" ? "settled" : "pending") : null,
  })
  await syncBlitzpayCustomerPaymentProfileFromPaymentIntent(admin, row, pi)

  const ref = blitzpayPiReference(pi.id)
  const { count, error: cErr } = await admin
    .from("org_invoice_payments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", row.organization_id)
    .eq("invoice_id", row.org_invoice_id)
    .eq("reference", ref)

  if (cErr) throw new Error(cErr.message)

  const received = Math.round(Number(pi.amount_received ?? pi.amount ?? 0))
  const portionCap = Math.round(
    Math.min(Number(row.invoice_amount_cents ?? row.amount_cents), received),
  )

  const inv = await loadInvoiceForBlitzpayPay(admin, row.organization_id, row.org_invoice_id)
  if (!inv) {
    await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
      status: "completed",
      failureCode: null,
    })
    return
  }
  const netPaidBefore = await sumNetRecordedPaymentsCentsForBlitzpay(admin, row.organization_id, row.org_invoice_id)
  const balanceDue = balanceDueCentsForBlitzpay(inv, netPaidBefore)
  const applyAmount = Math.max(0, Math.min(balanceDue, portionCap))
  const overpayCents = Math.max(0, received - applyAmount)

  if (applyAmount <= 0 && received <= 0) {
    await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
      status: "completed",
      failureCode: null,
    })
    return
  }

  if (applyAmount <= 0 && received > 0 && row.customer_id && UUID_RE.test(row.customer_id)) {
    await creditBlitzpayWalletOverpaymentFromInvoicePayment(admin, {
      organizationId: row.organization_id,
      customerId: row.customer_id,
      stripePaymentIntentId: pi.id,
      amountCents: received,
      orgInvoiceId: row.org_invoice_id,
    })
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
      amountCents: applyAmount,
      paidOn,
      paymentMethod: "card",
      reference: ref,
      note: scheduledPaymentId ? "BlitzPay (scheduled payment)" : "BlitzPay (Stripe Checkout)",
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
      amountCents: BigInt(applyAmount),
      currency: row.currency || "usd",
      stripeObjectId: chargeId,
      blitzpayPaymentIntentId: row.id,
      orgInvoiceId: row.org_invoice_id,
      metadata: { stripe_payment_intent_id: pi.id },
    })

    if (overpayCents > 0 && row.customer_id && UUID_RE.test(row.customer_id)) {
      await creditBlitzpayWalletOverpaymentFromInvoicePayment(admin, {
        organizationId: row.organization_id,
        customerId: row.customer_id,
        stripePaymentIntentId: pi.id,
        amountCents: overpayCents,
        orgInvoiceId: row.org_invoice_id,
      })
    }

    void dispatchBlitzpayPaymentReceiptEmails(admin, {
      organizationId: row.organization_id,
      orgInvoiceId: row.org_invoice_id,
      internalBlitzpayPaymentIntentId: row.id,
      stripePaymentIntentId: pi.id,
      invoicePortionCents: applyAmount,
      paidOnYyyyMmDd: paidOn,
      currency: row.currency || "usd",
      sourceKind: "webhook_auto",
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

  if (scheduledPaymentId) {
    const nowIso = new Date().toISOString()
    await admin
      .from("blitzpay_scheduled_invoice_payments")
      .update({
        status: "succeeded",
        processed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", scheduledPaymentId)
      .eq("organization_id", row.organization_id)
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
  const meta = parseBlitzpayInvoiceMetadata(pi.metadata as Record<string, string> | undefined)
  const scheduledPaymentId = meta?.scheduledPaymentId ?? null
  const code =
    pi.last_payment_error && typeof pi.last_payment_error === "object" && "code" in pi.last_payment_error
      ? String((pi.last_payment_error as { code?: string }).code ?? "")
      : null
  const errMsg =
    pi.last_payment_error && typeof pi.last_payment_error === "object" && "message" in pi.last_payment_error
      ? String((pi.last_payment_error as { message?: string }).message ?? "")
      : ""
  await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
    status: "failed",
    failureCode: code,
  })
  if (scheduledPaymentId) {
    const nowIso = new Date().toISOString()
    await admin
      .from("blitzpay_scheduled_invoice_payments")
      .update({
        status: "failed",
        last_error: (errMsg || code || "payment_failed").slice(0, 2000),
        updated_at: nowIso,
      })
      .eq("id", scheduledPaymentId)
      .eq("organization_id", row.organization_id)
  }
}

export async function completeBlitzpayPaymentIntentCanceled(
  admin: SupabaseClient,
  pi: Stripe.PaymentIntent,
): Promise<void> {
  const raw = await fetchBlitzpayPaymentIntentByStripeId(admin, pi.id)
  if (!raw) return
  const row = raw as BlitzpayPiRow
  const meta = parseBlitzpayInvoiceMetadata(pi.metadata as Record<string, string> | undefined)
  const scheduledPaymentId = meta?.scheduledPaymentId ?? null
  await updateBlitzpayInvoicePaymentAttemptsForInternalIntent(admin, row.id, {
    status: "expired",
    failureCode: "canceled",
  })
  if (scheduledPaymentId) {
    const nowIso = new Date().toISOString()
    await admin
      .from("blitzpay_scheduled_invoice_payments")
      .update({
        status: "failed",
        last_error: "canceled",
        updated_at: nowIso,
      })
      .eq("id", scheduledPaymentId)
      .eq("organization_id", row.organization_id)
  }
}
