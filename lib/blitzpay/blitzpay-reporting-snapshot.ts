import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { summarizeBlitzpayBalanceTransactions } from "@/lib/blitzpay/blitzpay-reconciliation-math"

export type BlitzpayOrgReportingSnapshot = {
  sinceIso: string | null
  grossProcessedVolumeCents: number
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
  {
    let q = admin
      .from("blitzpay_ledger_entries")
      .select("amount_cents")
      .eq("organization_id", organizationId)
      .eq("entry_type", "payment_captured")
    if (sinceIso) q = q.gte("created_at", sinceIso)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    gross = (data ?? []).reduce((s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)), 0)
  }

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

  return {
    sinceIso,
    grossProcessedVolumeCents: gross,
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
  }
}
