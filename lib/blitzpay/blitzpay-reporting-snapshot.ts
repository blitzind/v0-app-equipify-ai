import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { aggregateBlitzpayTreasuryMetrics } from "@/lib/blitzpay/blitzpay-contractor-treasury"
import { fetchApReportingExtras } from "@/lib/blitzpay/blitzpay-vendor-payables"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { computeBlitzpayCollectionsReporting } from "@/lib/blitzpay/blitzpay-collections"
import { fetchBlitzpayCollectionsAccelerationMetrics } from "@/lib/blitzpay/blitzpay-collections-acceleration-metrics"
import { fetchBlitzpayRecurringRevenueMetrics } from "@/lib/blitzpay/blitzpay-recurring-billing"
import { fetchBlitzpayMembershipReportingSlice } from "@/lib/blitzpay/blitzpay-memberships"
import { summarizeBlitzpayBalanceTransactions } from "@/lib/blitzpay/blitzpay-reconciliation-math"
import { summarizePayrollHealth } from "@/lib/blitzpay/blitzpay-payroll-runs"
import { deriveBlitzpayCashPlanningMetrics, type BlitzpayCashReserveRuleInput } from "@/lib/blitzpay/blitzpay-cash-accounts"
import { fetchBlitzpayPhase2aaReportingRates } from "@/lib/blitzpay/blitzpay-billing-profiles-service"
import { fetchBlitzpayPhase2abCollectionReporting } from "@/lib/blitzpay/blitzpay-collections-service"
import { fetchGlReportingSnapshotFields } from "@/lib/blitzpay/blitzpay-general-ledger-service"

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
  /** Payment links created from work-order collect flow in the reporting window. */
  blitzpayWorkOrderCollectPaymentLinksWindowCount: number
  /** Work orders where field staff marked “invoice email later” in the window. */
  workOrdersFieldInvoiceLaterWindowCount: number
  /** Phase 2R — derived contractor treasury (Stripe ledger mirror; no custody). */
  treasuryAveragePayoutDelayDays: number | null
  treasuryPendingPayoutTotalsCents: number
  treasuryFailedPayoutCount30d: number
  treasuryInstantTransferEligible: boolean
  treasuryReserveExposureCents: number
  treasuryPayoutVelocityPaidCents7d: number
  treasuryPayoutVelocityPaidCents30d: number
  treasuryEstimateUpcomingTransferCents: number
  treasuryPayoutSpeedLane: "standard" | "accelerated" | "unknown"
  /** Phase 2S — internal vendor payables (not Stripe payouts). */
  apOpenOutstandingCents: number
  apDue7OpenCents: number
  apDue30OpenCents: number
  apDue60OpenCents: number
  apVendorInternalVelocity7dCents: number
  apProjectedOutgoingCents7d: number
  /** Phase 2V — deterministic collections acceleration (bounded reads). */
  estimatedRecoverableOverdueCents: number
  likelyFieldCollectibleCents: number
  achAccelerationOpportunityCents: number
  installmentConversionOpportunityCents: number
  technicianAssistedRecoveryRatePct: number
  reminderConversionRatePct: number
  fieldCollectionRecoveryRatePct: number
  workOrdersWithCollectibleBalancesCount: number
  /** Phase 2W — recurring revenue / renewal signals (bounded reads). */
  blitzpayRecurringPlannedInflow30dCents: number
  blitzpayRecurringPlannedInflow90dCents: number
  blitzpayAnnualizedRecurringRunRateProxyCents: number
  blitzpayRecurringMixOfWindowPct: number
  blitzpayAutopayAdoptionPct: number
  blitzpayRenewalSuccessProxyPct: number
  blitzpayChurnRiskScore0to100: number
  blitzpayRecurringStabilityScore0to100: number
  blitzpayProjectedRenewalRevenue90dCents: number
  blitzpayRenewalRecoveryOpportunityCents: number
  blitzpayAutopayRiskExposureCents: number
  /** Phase 2X — native membership recurring metrics (bounded). */
  recurringRevenueCents: number
  annualRecurringRevenueCents: number
  delinquentMembershipRevenueCents: number
  renewalPipelineCents: number
  recoveredMembershipRevenueCents: number
  membershipAutoPayAdoptionBasisPoints: number
  churnRiskRevenueCents: number
  /** Phase 2Y — payroll / commission / contractor settlement signals (bounded reads). */
  payrollPendingCommissionCents: number
  payrollLiabilityCents: number
  contractorSettlementExposureCents: number
  recurringRevenueSharePendingCents: number
  estimatedPayrollBurdenCents: number
  commissionVelocity7dCents: number
  recurringMemberPayoutStability0to100: number
  /** Non-terminal disputes (bounded scan). */
  openDisputesAmountCents: number
  /** Phase 2Z — internal cash planning (not custodial balances). */
  estimatedOperatingCashCents: number
  cashReserveTargetCents: number
  cashReserveGapCents: number
  expectedInflows7dCents: number
  expectedInflows30dCents: number
  expectedOutflows7dCents: number
  expectedOutflows30dCents: number
  cashRunwayStatus: "healthy" | "watch" | "risk"
  payrollReserveCoverageBasisPoints: number
  apReserveCoverageBasisPoints: number
  /** Phase 2AA — customer billing profiles + saved methods + autopay enrollments (bounded; 0–100). */
  autopayEnrollmentRate: number
  savedPaymentMethodRate: number
  billingReadinessRate: number
  delinquencyRiskRate: number
  /** Phase 2AB — collections engine snapshot (bounded; 0–100 or days). */
  collectionSuccessRate: number
  retryRecoveryRate: number
  failedPaymentRate: number
  delinquencyRate: number
  recoveryFlowCompletionRate: number
  averageRecoveryDurationDays: number
  /** Phase 3A — general ledger / internal accounting (bounded). */
  totalAssetsCents: number
  totalLiabilitiesCents: number
  totalEquityCents: number
  deferredRevenueCents: number
  accountsReceivableCents: number
  accountsPayableCents: number
  /** GL account 2200 (ledger); distinct from payroll accrual `payrollLiabilityCents` above. */
  glPayrollLiabilityCents: number
  trialBalanceHealthy: boolean
  unreconciledBatchCount: number
  pendingRevenueRecognitionCount: number
  /** Phase 3B — vendor bills & AP orchestration (bounded). */
  accountsPayableOutstandingCents: number
  approvedBillsAwaitingPaymentCents: number
  overdueVendorBillsCents: number
  averageVendorPaymentDays: number | null
  vendorConcentrationRisk: number
  treasuryCoverageForPayables: number
  payableAgingHealthScore: number
}

/**
 * Lightweight internal aggregates for support / future dashboards (no charts).
 */
export async function fetchBlitzpayOrgReportingSnapshot(
  admin: SupabaseClient,
  organizationId: string,
  options?: { sinceIso?: string | null; collectionsPulse?: { reminderEffectivenessRatePct: number } },
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
  let blitzpayWorkOrderCollectPaymentLinksWindowCount = 0
  let workOrdersFieldInvoiceLaterWindowCount = 0
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

  if (sinceIso) {
    const { count: wpl, error: wplErr } = await admin
      .from("blitzpay_payment_links")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .contains("metadata", { source: "work_order_collect" })
      .gte("created_at", sinceIso)
    if (!wplErr && wpl != null) blitzpayWorkOrderCollectPaymentLinksWindowCount = wpl

    const { count: wil, error: wilErr } = await admin
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("blitzpay_field_invoice_later_at", "is", null)
      .gte("blitzpay_field_invoice_later_at", sinceIso)
    if (!wilErr && wil != null) workOrdersFieldInvoiceLaterWindowCount = wil
  }

  let treasuryAveragePayoutDelayDays: number | null = null
  let treasuryPendingPayoutTotalsCents = 0
  let treasuryFailedPayoutCount30d = 0
  let treasuryInstantTransferEligible = false
  let treasuryReserveExposureCents = 0
  let treasuryPayoutVelocityPaidCents7d = 0
  let treasuryPayoutVelocityPaidCents30d = 0
  let treasuryEstimateUpcomingTransferCents = 0
  let treasuryPayoutSpeedLane: "standard" | "accelerated" | "unknown" = "unknown"
  let tmSnapshot: Awaited<ReturnType<typeof aggregateBlitzpayTreasuryMetrics>> | null = null
  try {
    tmSnapshot = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
    treasuryAveragePayoutDelayDays = tmSnapshot.avgPayoutDelayDays
    treasuryPendingPayoutTotalsCents = tmSnapshot.pendingPayoutTotalCents
    treasuryFailedPayoutCount30d = tmSnapshot.failedPayoutCount30d
    treasuryInstantTransferEligible = tmSnapshot.instantTransferEligible
    treasuryReserveExposureCents = tmSnapshot.heldReserveCents
    treasuryPayoutVelocityPaidCents7d = tmSnapshot.payoutVelocityPaidCents7d
    treasuryPayoutVelocityPaidCents30d = tmSnapshot.payoutVelocityPaidCents30d
    treasuryEstimateUpcomingTransferCents = tmSnapshot.estimateUpcomingTransferCents
    treasuryPayoutSpeedLane = tmSnapshot.payoutSpeedLane
  } catch {
    /* migrations may lag in some sandboxes */
  }

  let apOpenOutstandingCents = 0
  let apDue7OpenCents = 0
  let apDue30OpenCents = 0
  let apDue60OpenCents = 0
  let apVendorInternalVelocity7dCents = 0
  let apProjectedOutgoingCents7d = 0
  try {
    const apx = await fetchApReportingExtras(admin, organizationId)
    apOpenOutstandingCents = apx.apOpenOutstandingCents
    apDue7OpenCents = apx.apDue7OpenCents
    apDue30OpenCents = apx.apDue30OpenCents
    apDue60OpenCents = apx.apDue60OpenCents
    apVendorInternalVelocity7dCents = apx.apVendorInternalVelocity7dCents
    apProjectedOutgoingCents7d = apx.apProjectedOutgoingCents7d
  } catch {
    /* vendor payables migration may lag */
  }

  const pulse = options?.collectionsPulse
    ? options.collectionsPulse
    : { reminderEffectivenessRatePct: (await computeBlitzpayCollectionsReporting(admin, organizationId)).reminderEffectivenessRatePct }

  let estimatedRecoverableOverdueCents = 0
  let likelyFieldCollectibleCents = 0
  let achAccelerationOpportunityCents = 0
  let installmentConversionOpportunityCents = 0
  let technicianAssistedRecoveryRatePct = 0
  let reminderConversionRatePct = 0
  let fieldCollectionRecoveryRatePct = 0
  let workOrdersWithCollectibleBalancesCount = 0
  try {
    const accel = await fetchBlitzpayCollectionsAccelerationMetrics(admin, organizationId, {
      sinceIso,
      paymentMethodMix,
      activeInstallmentPlansCount: blitzpayActivePaymentPlansCount,
      collectionsPulse: pulse,
    })
    estimatedRecoverableOverdueCents = accel.estimatedRecoverableOverdueCents
    likelyFieldCollectibleCents = accel.likelyFieldCollectibleCents
    achAccelerationOpportunityCents = accel.achAccelerationOpportunityCents
    installmentConversionOpportunityCents = accel.installmentConversionOpportunityCents
    technicianAssistedRecoveryRatePct = accel.technicianAssistedRecoveryRatePct
    reminderConversionRatePct = accel.reminderConversionRatePct
    fieldCollectionRecoveryRatePct = accel.fieldCollectionRecoveryRatePct
    workOrdersWithCollectibleBalancesCount = accel.workOrdersWithCollectibleBalancesCount
  } catch {
    /* sandboxes without full BlitzPay schema */
  }

  const todayYmdForRecurring = new Date().toISOString().slice(0, 10)
  let overdueInvoiceCountApprox = 0
  {
    const { count: oc, error: ocErr } = await admin
      .from("org_invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("due_date", "is", null)
      .lt("due_date", todayYmdForRecurring)
      .in("status", ["sent", "unpaid", "overdue"])
    if (!ocErr && oc != null) overdueInvoiceCountApprox = oc
  }

  const reportingWindowDaysRec = sinceIso
    ? Math.min(90, Math.max(7, Math.round((Date.now() - Date.parse(sinceIso)) / 86400_000)))
    : 30

  let blitzpayRecurringPlannedInflow30dCents = 0
  let blitzpayRecurringPlannedInflow90dCents = 0
  let blitzpayAnnualizedRecurringRunRateProxyCents = 0
  let blitzpayRecurringMixOfWindowPct = 0
  let blitzpayAutopayAdoptionPct = 0
  let blitzpayRenewalSuccessProxyPct = 0
  let blitzpayChurnRiskScore0to100 = 0
  let blitzpayRecurringStabilityScore0to100 = 0
  let blitzpayProjectedRenewalRevenue90dCents = 0
  let blitzpayRenewalRecoveryOpportunityCents = 0
  let blitzpayAutopayRiskExposureCents = 0
  try {
    const r = await fetchBlitzpayRecurringRevenueMetrics(admin, organizationId, {
      reportingWindowDays: reportingWindowDaysRec,
      grossCollectedWindowCents: gross,
      overdueInvoiceCount: overdueInvoiceCountApprox,
    })
    blitzpayRecurringPlannedInflow30dCents = r.recurringPlannedInflow30dCents
    blitzpayRecurringPlannedInflow90dCents = r.recurringPlannedInflow90dCents
    blitzpayAnnualizedRecurringRunRateProxyCents = r.annualizedRecurringRunRateProxyCents
    blitzpayRecurringMixOfWindowPct = r.recurringMixOfCollectedWindowPct
    blitzpayAutopayAdoptionPct = r.autopayAdoptionPct
    blitzpayRenewalSuccessProxyPct = r.renewalSuccessProxyPct
    blitzpayChurnRiskScore0to100 = r.churnRiskScore0to100
    blitzpayRecurringStabilityScore0to100 = r.recurringStabilityScore0to100
    blitzpayProjectedRenewalRevenue90dCents = r.projectedRenewalRevenue90dCents
    blitzpayRenewalRecoveryOpportunityCents = Math.min(
      r.projectedRenewalRevenue90dCents,
      Math.round(estimatedRecoverableOverdueCents * 0.3 + r.recurringPlannedInflow30dCents * 0.12),
    )
    blitzpayAutopayRiskExposureCents = Math.min(
      estimatedRecoverableOverdueCents,
      Math.round(r.failedRenewalExposureCents + r.recurringPlannedInflow30dCents * (1 - r.autopayAdoptionPct / 100)),
    )
  } catch {
    /* recurring reads optional in partial sandboxes */
  }

  let recurringRevenueCents = 0
  let annualRecurringRevenueCents = 0
  let delinquentMembershipRevenueCents = 0
  let renewalPipelineCents = 0
  let recoveredMembershipRevenueCents = 0
  let membershipAutoPayAdoptionBasisPoints = 0
  let churnRiskRevenueCents = 0
  try {
    const mx = await fetchBlitzpayMembershipReportingSlice(admin, organizationId)
    recurringRevenueCents = mx.recurringRevenueCents
    annualRecurringRevenueCents = mx.annualRecurringRevenueCents
    delinquentMembershipRevenueCents = mx.delinquentMembershipRevenueCents
    renewalPipelineCents = mx.renewalPipelineCents
    recoveredMembershipRevenueCents = mx.recoveredMembershipRevenueCents
    membershipAutoPayAdoptionBasisPoints = mx.membershipAutoPayAdoptionBasisPoints
    churnRiskRevenueCents = mx.churnRiskRevenueCents
  } catch {
    /* membership tables optional until migration applied */
  }

  let payrollPendingCommissionCents = 0
  let payrollLiabilityCents = 0
  let contractorSettlementExposureCents = 0
  let recurringRevenueSharePendingCents = 0
  let estimatedPayrollBurdenCents = 0
  let commissionVelocity7dCents = 0
  let recurringMemberPayoutStability0to100 = 0
  try {
    const ph = await summarizePayrollHealth(admin, organizationId)
    payrollPendingCommissionCents = ph.pendingCommissionCents
    contractorSettlementExposureCents = ph.contractorSettlementPendingCents
    recurringRevenueSharePendingCents = ph.revenueSharePendingCents
    commissionVelocity7dCents = ph.commissionVelocity7dCents
    payrollLiabilityCents =
      ph.pendingCommissionCents + ph.contractorSettlementPendingCents + ph.revenueSharePendingCents
    estimatedPayrollBurdenCents = payrollLiabilityCents
    recurringMemberPayoutStability0to100 = blitzpayRecurringStabilityScore0to100
  } catch {
    /* payroll tables optional until migration applied */
  }

  const DISPUTE_TERMINAL = new Set(["won", "lost", "charge_refunded", "closed"])
  let openDisputesAmountCents = 0
  try {
    const { data: drows, error: dErr } = await admin
      .from("blitzpay_invoice_disputes")
      .select("amount_cents, status")
      .eq("organization_id", organizationId)
      .limit(80)
    if (!dErr && drows) {
      for (const d of drows as Array<{ amount_cents: number; status: string }>) {
        if (DISPUTE_TERMINAL.has(String(d.status))) continue
        openDisputesAmountCents += Math.max(0, Math.round(Number(d.amount_cents)))
      }
    }
  } catch {
    openDisputesAmountCents = 0
  }

  let cashReserveRulesForMetrics: BlitzpayCashReserveRuleInput[] = []
  try {
    const { data: crRows, error: crErr } = await admin
      .from("blitzpay_cash_reserve_rules")
      .select("rule_type, basis_points, fixed_amount_cents, active")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .limit(48)
    if (!crErr && crRows) {
      cashReserveRulesForMetrics = (crRows as Array<{ rule_type: string; basis_points: number | null; fixed_amount_cents: number | null; active: boolean }>).map(
        (r) => ({
          ruleType: r.rule_type as BlitzpayCashReserveRuleInput["ruleType"],
          basisPoints: r.basis_points != null ? Math.round(Number(r.basis_points)) : null,
          fixedAmountCents: r.fixed_amount_cents != null ? Math.round(Number(r.fixed_amount_cents)) : null,
          active: Boolean(r.active),
        }),
      )
    }
  } catch {
    cashReserveRulesForMetrics = []
  }

  const walletL = customerWalletSpendableCreditTotalCents
  const depL = customerUnappliedEstimateDepositTotalCents
  const overlapWd = Math.min(walletL, depL)
  let autopayEnrollmentRate = 0
  let savedPaymentMethodRate = 0
  let billingReadinessRate = 0
  let delinquencyRiskRate = 0
  let collectionSuccessRate = 0
  let retryRecoveryRate = 0
  let failedPaymentRate = 0
  let delinquencyRate = 0
  let recoveryFlowCompletionRate = 0
  let averageRecoveryDurationDays = 0
  try {
    const r3 = await fetchBlitzpayPhase2aaReportingRates(admin, organizationId)
    autopayEnrollmentRate = r3.autopayEnrollmentRate
    savedPaymentMethodRate = r3.savedPaymentMethodRate
    billingReadinessRate = r3.billingReadinessRate
    delinquencyRiskRate = r3.delinquencyRiskRate
  } catch {
    /* Phase 2AA tables optional until migration applied */
  }

  try {
    const r3b = await fetchBlitzpayPhase2abCollectionReporting(admin, organizationId)
    collectionSuccessRate = r3b.collectionSuccessRate
    retryRecoveryRate = r3b.retryRecoveryRate
    failedPaymentRate = r3b.failedPaymentRate
    delinquencyRate = r3b.delinquencyRate
    recoveryFlowCompletionRate = r3b.recoveryFlowCompletionRate
    averageRecoveryDurationDays = r3b.averageRecoveryDurationDays
  } catch {
    /* Phase 2AB tables optional until migration applied */
  }

  let totalAssetsCents = 0
  let totalLiabilitiesCents = 0
  let totalEquityCents = 0
  let deferredRevenueCents = 0
  let accountsReceivableCents = 0
  let accountsPayableCents = 0
  let glPayrollLiabilityCents = 0
  let trialBalanceHealthy = true
  let unreconciledBatchCount = 0
  let pendingRevenueRecognitionCount = 0
  try {
    const gl = await fetchGlReportingSnapshotFields(admin, organizationId)
    totalAssetsCents = gl.totalAssetsCents
    totalLiabilitiesCents = gl.totalLiabilitiesCents
    totalEquityCents = gl.totalEquityCents
    deferredRevenueCents = gl.deferredRevenueCents
    accountsReceivableCents = gl.accountsReceivableCents
    accountsPayableCents = gl.accountsPayableCents
    glPayrollLiabilityCents = gl.glPayrollLiabilityCents
    trialBalanceHealthy = gl.trialBalanceHealthy
    unreconciledBatchCount = gl.unreconciledBatchCount
    pendingRevenueRecognitionCount = gl.pendingRevenueRecognitionCount
  } catch {
    /* Phase 3A GL tables optional until migration applied */
  }

  let accountsPayableOutstandingCents = 0
  let approvedBillsAwaitingPaymentCents = 0
  let overdueVendorBillsCents = 0
  let averageVendorPaymentDays: number | null = null
  let vendorConcentrationRisk = 0
  let treasuryCoverageForPayables = 0
  let payableAgingHealthScore = 0
  try {
    const { fetchApReportingSnapshotFields } = await import("@/lib/blitzpay/blitzpay-ap-service")
    const ap = await fetchApReportingSnapshotFields(admin, organizationId)
    accountsPayableOutstandingCents = ap.accountsPayableOutstandingCents
    approvedBillsAwaitingPaymentCents = ap.approvedBillsAwaitingPaymentCents
    overdueVendorBillsCents = ap.overdueVendorBillsCents
    averageVendorPaymentDays = ap.averageVendorPaymentDays
    vendorConcentrationRisk = ap.vendorConcentrationRisk
    treasuryCoverageForPayables = ap.treasuryCoverageForPayables
    payableAgingHealthScore = ap.payableAgingHealthScore
  } catch {
    /* Phase 3B AP tables optional until migration applied */
  }

  const cash2z = deriveBlitzpayCashPlanningMetrics({
    treasuryOperatingCents: tmSnapshot?.operatingBalanceCents ?? 0,
    heldReserveCents: tmSnapshot?.heldReserveCents ?? 0,
    reserveTargetFromSettingsCents: tmSnapshot?.reserveTargetCents ?? 0,
    pendingPayoutTotalCents: tmSnapshot?.pendingPayoutTotalCents ?? 0,
    walletSpendableLiabilityCents: walletL,
    unappliedEstimateDepositCents: depL,
    walletDepositOverlapCents: overlapWd,
    netCollectedWindowCents: Math.max(0, gross - refunded),
    payrollLiabilityCents,
    apOpenOutstandingCents,
    disputeExposureCents: openDisputesAmountCents,
    reserveRules: cashReserveRulesForMetrics,
    apDue7OpenCents,
    apDue30OpenCents,
    treasuryPendingPayoutTotalsCents,
    treasuryEstimateUpcomingTransferCents,
    recurringPlannedInflow30dCents: blitzpayRecurringPlannedInflow30dCents,
  })

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
    blitzpayWorkOrderCollectPaymentLinksWindowCount,
    workOrdersFieldInvoiceLaterWindowCount,
    treasuryAveragePayoutDelayDays,
    treasuryPendingPayoutTotalsCents,
    treasuryFailedPayoutCount30d,
    treasuryInstantTransferEligible,
    treasuryReserveExposureCents,
    treasuryPayoutVelocityPaidCents7d,
    treasuryPayoutVelocityPaidCents30d,
    treasuryEstimateUpcomingTransferCents,
    treasuryPayoutSpeedLane,
    apOpenOutstandingCents,
    apDue7OpenCents,
    apDue30OpenCents,
    apDue60OpenCents,
    apVendorInternalVelocity7dCents,
    apProjectedOutgoingCents7d,
    estimatedRecoverableOverdueCents,
    likelyFieldCollectibleCents,
    achAccelerationOpportunityCents,
    installmentConversionOpportunityCents,
    technicianAssistedRecoveryRatePct,
    reminderConversionRatePct,
    fieldCollectionRecoveryRatePct,
    workOrdersWithCollectibleBalancesCount,
    blitzpayRecurringPlannedInflow30dCents,
    blitzpayRecurringPlannedInflow90dCents,
    blitzpayAnnualizedRecurringRunRateProxyCents,
    blitzpayRecurringMixOfWindowPct,
    blitzpayAutopayAdoptionPct,
    blitzpayRenewalSuccessProxyPct,
    blitzpayChurnRiskScore0to100,
    blitzpayRecurringStabilityScore0to100,
    blitzpayProjectedRenewalRevenue90dCents,
    blitzpayRenewalRecoveryOpportunityCents,
    blitzpayAutopayRiskExposureCents,
    recurringRevenueCents,
    annualRecurringRevenueCents,
    delinquentMembershipRevenueCents,
    renewalPipelineCents,
    recoveredMembershipRevenueCents,
    membershipAutoPayAdoptionBasisPoints,
    churnRiskRevenueCents,
    payrollPendingCommissionCents,
    payrollLiabilityCents,
    contractorSettlementExposureCents,
    recurringRevenueSharePendingCents,
    estimatedPayrollBurdenCents,
    commissionVelocity7dCents,
    recurringMemberPayoutStability0to100,
    openDisputesAmountCents,
    estimatedOperatingCashCents: cash2z.estimatedOperatingCashCents,
    cashReserveTargetCents: cash2z.cashReserveTargetCents,
    cashReserveGapCents: cash2z.cashReserveGapCents,
    expectedInflows7dCents: cash2z.expectedInflows7dCents,
    expectedInflows30dCents: cash2z.expectedInflows30dCents,
    expectedOutflows7dCents: cash2z.expectedOutflows7dCents,
    expectedOutflows30dCents: cash2z.expectedOutflows30dCents,
    cashRunwayStatus: cash2z.cashRunwayStatus,
    payrollReserveCoverageBasisPoints: cash2z.payrollReserveCoverageBasisPoints,
    apReserveCoverageBasisPoints: cash2z.apReserveCoverageBasisPoints,
    autopayEnrollmentRate,
    savedPaymentMethodRate,
    billingReadinessRate,
    delinquencyRiskRate,
    collectionSuccessRate,
    retryRecoveryRate,
    failedPaymentRate,
    delinquencyRate,
    recoveryFlowCompletionRate,
    averageRecoveryDurationDays,
    totalAssetsCents,
    totalLiabilitiesCents,
    totalEquityCents,
    deferredRevenueCents,
    accountsReceivableCents,
    accountsPayableCents,
    glPayrollLiabilityCents,
    trialBalanceHealthy,
    unreconciledBatchCount,
    pendingRevenueRecognitionCount,
    accountsPayableOutstandingCents,
    approvedBillsAwaitingPaymentCents,
    overdueVendorBillsCents,
    averageVendorPaymentDays,
    vendorConcentrationRisk,
    treasuryCoverageForPayables,
    payableAgingHealthScore,
  }
}
