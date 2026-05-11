import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { summarizeBlitzpayBalanceTransactions } from "@/lib/blitzpay/blitzpay-reconciliation-math"

export type BlitzpayOrgReportingSnapshot = {
  sinceIso: string | null
  grossProcessedVolumeCents: number
  /** `payment_captured` ledger rows tagged as estimate deposits (not invoice service revenue). */
  estimateDepositCapturedCents: number
  /** `payment_captured` excluding estimate-deposit recognition (invoice path + legacy rows without tag). */
  invoiceStylePaymentCapturedCents: number
  refundedVolumeCents: number
  netCollectedCents: number
  convenienceFeeCollectedCents: number
  estimatedStripeFeesCents: number
  refundedFeesCents: number
  estimatedNetMerchantPayoutCents: number
  /** When balance transactions were synced for this window, fees/net prefer Stripe ledger sums. */
  reportingSource: "balance_transactions" | "estimate"
  /** Sum of paid payout amounts (po_) with `stripe_created_at` in window — cash to bank. */
  paidOutToBankCents: number
  /** Net of connected-account balance activity (excludes payout rows) from synced `blitzpay_balance_transactions`. */
  connectedAccountNetActivityCents: number | null
  onlinePaymentCount: number
  paymentSourceSplit: { customer_portal: number; staff_dashboard: number }
  paymentMethodMix: { card: number; us_bank_account: number; unknown: number }
  achSettlement: { pending: number; settled: number; failed: number }
  /** Quotes with any BlitzPay deposit collected (current totals; not window-scoped). */
  quotesWithBlitzpayDepositCollected: number
  /** Quotes flagged financing-ready (current rows; not window-scoped). */
  financingReadyQuotesCount: number
  /** Sum of `available_credit_cents` across org wallets (customer credit liability). */
  customerWalletSpendableCreditTotalCents: number
  /** Sum of `refundable_credit_cents` across org wallets (hosted-pay overpayment bucket). */
  customerWalletRefundableCreditTotalCents: number
  /** Deposits held on quotes not yet converted to invoices (current; not window-scoped). */
  customerUnappliedEstimateDepositTotalCents: number
  /** Sum of wallet debits applied to invoices in the reporting window (requires `sinceIso`). */
  customerWalletAppliedToInvoicesWindowCents: number
  /** Credits posted to wallets in the window (overpayment + manual; requires `sinceIso`). */
  customerWalletCreditInflowWindowCents: number
  /** Active installment / staged plans for the org (current). */
  blitzpayActivePaymentPlansCount: number
  /** Lifetime sum of `paid_cents` on installments for org plans. */
  blitzpayPaymentPlanInstallmentsPaidCentsTotal: number
  /** Financing sessions recorded for the org (all time). */
  blitzpayFinancingSessionsTotal: number
  /** Sessions in funded or payout_released state. */
  blitzpayFinancingSessionsFundedOrReleasedCount: number
  /** Sessions created in the reporting window (requires `sinceIso`). */
  blitzpayFinancingSessionsCreatedWindowCount: number
  /** Open quotes (not archived, not converted) with deposit collected > 0. */
  estimateDepositBeforeWorkQuoteCount: number
  /** Open quotes (not archived, not converted) with positive total. */
  estimateOpenQuotesWithTotalCount: number
}

/**
 * Lightweight internal aggregates for support / future dashboards (no charts).
 */
export async function fetchBlitzpayOrgReportingSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  options?: { sinceIso?: string | null },
): Promise<BlitzpayOrgReportingSnapshot> {
  assertUuid(organizationId, "organizationId")
  const sinceIso = options?.sinceIso?.trim() ? options.sinceIso.trim() : null

  let gross = 0
  let estimateDepositCapturedCents = 0
  {
    let q = admin
      .from("blitzpay_ledger_entries")
      .select("amount_cents, metadata")
      .eq("organization_id", organizationId)
      .eq("entry_type", "payment_captured")
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ amount_cents: number; metadata?: Record<string, unknown> | null }>
    gross = rows.reduce((s, r) => s + Math.round(Number(r.amount_cents)), 0)
    estimateDepositCapturedCents = rows.reduce((s, r) => {
      const tag = String((r.metadata as { revenue_recognition?: string } | null)?.revenue_recognition ?? "")
      return s + (tag === "estimate_deposit" ? Math.round(Number(r.amount_cents)) : 0)
    }, 0)
  }
  const invoiceStylePaymentCapturedCents = Math.max(0, gross - estimateDepositCapturedCents)

  let refunded = 0
  {
    let q = admin
      .from("blitzpay_ledger_entries")
      .select("amount_cents")
      .eq("organization_id", organizationId)
      .eq("entry_type", "refund")
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    refunded = (data ?? []).reduce((s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)), 0)
  }

  let convenienceFeeCollectedCents = 0
  let estimatedStripeFeesCents = 0
  let refundedFeesCents = 0
  let onlinePaymentCount = 0
  const paymentMethodMix = { card: 0, us_bank_account: 0, unknown: 0 }
  const achSettlement = { pending: 0, settled: 0, failed: 0 }
  {
    let q = admin.from("org_invoice_payments").select("id, reference").eq("organization_id", organizationId)
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{ reference?: string | null }>
    const blitzRows = rows.filter((r) => String(r.reference ?? "").startsWith("blitzpay_pi:"))
    onlinePaymentCount = blitzRows.length
    if (blitzRows.length > 0) {
      const piIds = blitzRows
        .map((r) => String(r.reference ?? ""))
        .map((ref) => ref.replace(/^blitzpay_pi:/, ""))
        .filter((id) => id.startsWith("pi_"))
      if (piIds.length > 0) {
        const { data: pis, error: piErr } = await admin
          .from("blitzpay_payment_intents")
          .select("stripe_payment_intent_id, amount_cents, convenience_fee_cents, payment_method_type, ach_settlement_state")
          .eq("organization_id", organizationId)
          .in("stripe_payment_intent_id", piIds)
        if (piErr) throw new Error(piErr.message)
        for (const p of (pis ?? []) as Array<{
          amount_cents: string | number
          convenience_fee_cents: string | number
          payment_method_type?: string | null
          ach_settlement_state?: string | null
        }>) {
          const amt = Math.max(0, Math.round(Number(p.amount_cents)))
          const conv = Math.max(0, Math.round(Number(p.convenience_fee_cents)))
          convenienceFeeCollectedCents += conv
          estimatedStripeFeesCents += Math.round(amt * 0.029) + 30
          if (p.payment_method_type === "card") paymentMethodMix.card += 1
          else if (p.payment_method_type === "us_bank_account") {
            paymentMethodMix.us_bank_account += 1
            if (p.ach_settlement_state === "settled") achSettlement.settled += 1
            else if (p.ach_settlement_state === "failed") achSettlement.failed += 1
            else achSettlement.pending += 1
          } else paymentMethodMix.unknown += 1
        }
      }
    }
  }

  refundedFeesCents = Math.min(estimatedStripeFeesCents, Math.round(refunded * 0.029))

  let paidOutToBankCents = 0
  let balanceTxTotals = null as ReturnType<typeof summarizeBlitzpayBalanceTransactions> | null
  {
    let qBt = admin
      .from("blitzpay_balance_transactions")
      .select("balance_type, gross_cents, fee_cents, net_cents")
      .eq("organization_id", organizationId)
    if (sinceIso) qBt = qBt.gte("stripe_created_at", sinceIso)
    const { data: btRows, error: btErr } = await qBt
    if (btErr) throw new Error(btErr.message)
    if (btRows && btRows.length > 0) {
      balanceTxTotals = summarizeBlitzpayBalanceTransactions(
        btRows as Array<{ balance_type: string; gross_cents: number; fee_cents: number; net_cents: number }>,
      )
    }
  }
  {
    let q = admin
      .from("blitzpay_payouts")
      .select("amount_cents")
      .eq("organization_id", organizationId)
      .eq("status", "paid")
    if (sinceIso) q = q.gte("stripe_created_at", sinceIso)
    const { data: paidRows, error: poErr } = await q
    if (poErr) throw new Error(poErr.message)
    paidOutToBankCents = (paidRows ?? []).reduce(
      (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
      0,
    )
  }

  let portalCompleted = 0
  let staffCompleted = 0
  {
    let q = admin
      .from("blitzpay_invoice_payment_attempts")
      .select("channel, status, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "completed")
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const ch = String((r as { channel: string }).channel || "")
      if (ch === "portal_link" || ch === "scheduled_off_session") portalCompleted += 1
      else staffCompleted += 1
    }
  }

  const ledgerBacked = balanceTxTotals != null && balanceTxTotals.activityRowCount > 0
  const connectedAccountNetActivityCents = ledgerBacked ? balanceTxTotals.sumNetCents : null
  const stripeFeesForDisplay = ledgerBacked ? balanceTxTotals.sumStripeFeesCents : estimatedStripeFeesCents
  const netMerchant = ledgerBacked
    ? Math.max(0, balanceTxTotals.sumNetCents)
    : Math.max(0, gross - refunded - estimatedStripeFeesCents + refundedFeesCents)

  let quotesWithBlitzpayDepositCollected = 0
  let financingReadyQuotesCount = 0
  let customerUnappliedEstimateDepositTotalCents = 0
  let estimateDepositBeforeWorkQuoteCount = 0
  let estimateOpenQuotesWithTotalCount = 0
  {
    const { data: qRows, error: qErr } = await admin
      .from("org_quotes")
      .select(
        "blitzpay_deposit_collected_cents, blitzpay_financing_ready, blitzpay_converted_invoice_id, amount_cents",
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null)
    if (!qErr && qRows) {
      for (const r of qRows as Array<{
        blitzpay_deposit_collected_cents?: number | string
        blitzpay_financing_ready?: boolean | null
        blitzpay_converted_invoice_id?: string | null
        amount_cents?: number | string
      }>) {
        const c = Math.max(0, Math.round(Number(r.blitzpay_deposit_collected_cents ?? 0)))
        const amt = Math.max(0, Math.round(Number(r.amount_cents ?? 0)))
        if (c > 0) quotesWithBlitzpayDepositCollected += 1
        if (Boolean(r.blitzpay_financing_ready)) financingReadyQuotesCount += 1
        if (!r.blitzpay_converted_invoice_id) {
          customerUnappliedEstimateDepositTotalCents += c
          if (amt > 0) estimateOpenQuotesWithTotalCount += 1
          if (c > 0 && amt > 0) estimateDepositBeforeWorkQuoteCount += 1
        }
      }
    }
  }

  let customerWalletSpendableCreditTotalCents = 0
  let customerWalletRefundableCreditTotalCents = 0
  {
    const { data: wRows, error: wErr } = await admin
      .from("blitzpay_customer_wallets")
      .select("available_credit_cents, refundable_credit_cents")
      .eq("organization_id", organizationId)
    if (!wErr && wRows) {
      for (const r of wRows as Array<{
        available_credit_cents?: number | string
        refundable_credit_cents?: number | string
      }>) {
        customerWalletSpendableCreditTotalCents += Math.max(0, Math.round(Number(r.available_credit_cents ?? 0)))
        customerWalletRefundableCreditTotalCents += Math.max(0, Math.round(Number(r.refundable_credit_cents ?? 0)))
      }
    }
  }

  let customerWalletAppliedToInvoicesWindowCents = 0
  let customerWalletCreditInflowWindowCents = 0
  if (sinceIso) {
    const { data: lRows, error: lErr } = await admin
      .from("blitzpay_customer_wallet_ledger")
      .select("entry_kind, amount_cents")
      .eq("organization_id", organizationId)
      .gte("created_at", sinceIso)
    if (!lErr && lRows) {
      for (const r of lRows as Array<{ entry_kind: string; amount_cents: number | string }>) {
        const amt = Math.round(Number(r.amount_cents))
        if (r.entry_kind === "debit_apply_invoice" && amt < 0) {
          customerWalletAppliedToInvoicesWindowCents += -amt
        }
        if (
          (r.entry_kind === "credit_overpayment_invoice" || r.entry_kind === "credit_manual") &&
          amt > 0
        ) {
          customerWalletCreditInflowWindowCents += amt
        }
      }
    }
  }

  let blitzpayActivePaymentPlansCount = 0
  let blitzpayPaymentPlanInstallmentsPaidCentsTotal = 0
  let blitzpayFinancingSessionsTotal = 0
  let blitzpayFinancingSessionsFundedOrReleasedCount = 0
  let blitzpayFinancingSessionsCreatedWindowCount = 0
  {
    const { count, error: pcErr } = await admin
      .from("blitzpay_payment_plans")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "active")
    if (!pcErr && count != null) blitzpayActivePaymentPlansCount = count
  }
  {
    const { data: planRows, error: prErr } = await admin
      .from("blitzpay_payment_plans")
      .select("id")
      .eq("organization_id", organizationId)
    if (!prErr && planRows && planRows.length > 0) {
      const ids = (planRows as Array<{ id: string }>).map((p) => p.id)
      const chunk = 200
      for (let i = 0; i < ids.length; i += chunk) {
        const slice = ids.slice(i, i + chunk)
        const { data: instRows, error: irErr } = await admin
          .from("blitzpay_payment_plan_installments")
          .select("paid_cents")
          .in("payment_plan_id", slice)
        if (irErr) break
        for (const r of instRows ?? []) {
          blitzpayPaymentPlanInstallmentsPaidCentsTotal += Math.max(
            0,
            Math.round(Number((r as { paid_cents: number }).paid_cents ?? 0)),
          )
        }
      }
    }
  }
  {
    const { count, error: fsErr } = await admin
      .from("blitzpay_financing_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
    if (!fsErr && count != null) blitzpayFinancingSessionsTotal = count
    const { count: fr, error: frErr } = await admin
      .from("blitzpay_financing_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["funded", "payout_released"])
    if (!frErr && fr != null) blitzpayFinancingSessionsFundedOrReleasedCount = fr
    if (sinceIso) {
      const { count: fw, error: fwErr } = await admin
        .from("blitzpay_financing_sessions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", sinceIso)
      if (!fwErr && fw != null) blitzpayFinancingSessionsCreatedWindowCount = fw
    }
  }

  return {
    sinceIso,
    grossProcessedVolumeCents: gross,
    estimateDepositCapturedCents,
    invoiceStylePaymentCapturedCents,
    refundedVolumeCents: refunded,
    netCollectedCents: Math.max(0, gross - refunded),
    convenienceFeeCollectedCents,
    estimatedStripeFeesCents: stripeFeesForDisplay,
    refundedFeesCents: ledgerBacked ? Math.min(stripeFeesForDisplay, refundedFeesCents) : refundedFeesCents,
    estimatedNetMerchantPayoutCents: netMerchant,
    reportingSource: ledgerBacked ? "balance_transactions" : "estimate",
    paidOutToBankCents,
    connectedAccountNetActivityCents,
    onlinePaymentCount,
    paymentSourceSplit: {
      customer_portal: portalCompleted,
      staff_dashboard: staffCompleted,
    },
    paymentMethodMix,
    achSettlement,
    quotesWithBlitzpayDepositCollected,
    financingReadyQuotesCount,
    customerWalletSpendableCreditTotalCents,
    customerWalletRefundableCreditTotalCents,
    customerUnappliedEstimateDepositTotalCents,
    customerWalletAppliedToInvoicesWindowCents,
    customerWalletCreditInflowWindowCents,
    blitzpayActivePaymentPlansCount,
    blitzpayPaymentPlanInstallmentsPaidCentsTotal,
    blitzpayFinancingSessionsTotal,
    blitzpayFinancingSessionsFundedOrReleasedCount,
    blitzpayFinancingSessionsCreatedWindowCount,
    estimateDepositBeforeWorkQuoteCount,
    estimateOpenQuotesWithTotalCount,
  }
}
