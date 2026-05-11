import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { computeBlitzpayCollectionsReporting } from "@/lib/blitzpay/blitzpay-collections"
import {
  blitzpayOverdueRecoveryMultiplier,
  blitzpayWalletLiabilityCents,
  buildBlitzpayForecastHorizonsCents,
} from "@/lib/blitzpay/blitzpay-revenue-forecast-math"
import { buildBlitzpayRevenueRecommendations } from "@/lib/blitzpay/blitzpay-revenue-recommendations"
import { fetchBlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
} from "@/lib/billing/invoice-payment-allocation"

const DISPUTE_TERMINAL = new Set(["won", "lost", "charge_refunded", "closed"])

export type BlitzpayOrgRevenueIntelligence = {
  reportingWindowDays: number
  reportingSource: "balance_transactions" | "estimate"
  dashboard: {
    grossCollectedWindowCents: number
    netCollectedWindowCents: number
    refundedVolumeWindowCents: number
    pendingPayoutsCents: number
    openDisputesCount: number
    openDisputesAmountCents: number
    walletLiabilityCents: number
    depositsCollectedWindowCents: number
    overdueCollectibleCents: number
    overdueInvoiceCount: number
    scheduledFuturePaymentsCents: number
    activeInstallmentPlansCount: number
    abandonedCheckoutInvoices: number
    paymentLinksCreatedWindowCount: number
    workOrderCollectPaymentLinksWindowCount: number
    openRecoveryCasesCount: number
    /** Same source as treasury aggregate (`pending` + `in_transit` payout amounts). */
    treasuryEstimateUpcomingTransferCents: number
    /** Phase 2V — mirrored from reporting snapshot (bounded). */
    estimatedRecoverableOverdueCents: number
    likelyFieldCollectibleCents: number
    achAccelerationOpportunityCents: number
    installmentConversionOpportunityCents: number
    technicianAssistedRecoveryRatePct: number
    reminderConversionRatePct: number
    fieldCollectionRecoveryRatePct: number
    workOrdersWithCollectibleBalancesCount: number
    paymentMethodMix: { card: number; us_bank_account: number; unknown: number }
    customerWalletSpendableCreditTotalCents: number
    /** Phase 2W — recurring revenue / renewals (from reporting snapshot, bounded). */
    recurringPlannedInflow30dCents: number
    recurringPlannedInflow90dCents: number
    annualizedRecurringRunRateProxyCents: number
    recurringMixOfCollectedWindowPct: number
    autopayAdoptionPct: number
    renewalSuccessProxyPct: number
    churnRiskScore0to100: number
    recurringStabilityScore0to100: number
    projectedRenewalRevenue90dCents: number
    renewalRecoveryOpportunityCents: number
    autopayRiskExposureCents: number
    /** Phase 2Y — payroll / commission exposure (from reporting snapshot). */
    payrollPendingCommissionCents: number
    payrollLiabilityCents: number
    contractorSettlementExposureCents: number
    recurringRevenueSharePendingCents: number
    estimatedPayrollBurdenCents: number
    commissionVelocity7dCents: number
    recurringMemberPayoutStability0to100: number
    /** Phase 2Z */
    estimatedOperatingCashCents: number
    cashReserveGapCents: number
    cashRunwayStatus: "healthy" | "watch" | "risk"
    expectedOutflows30dCents: number
    payrollReserveCoverageBasisPoints: number
    apReserveCoverageBasisPoints: number
  }
  forecasts: ReturnType<typeof buildBlitzpayForecastHorizonsCents> & {
    achPendingSettlementCents: number
    overdueRecoveryExpectedCents: number
  }
  collections: Awaited<ReturnType<typeof computeBlitzpayCollectionsReporting>> & {
    paymentLinksCreatedWindowCount: number
    workOrderCollectPaymentLinksWindowCount: number
    openRecoveryCasesCount: number
    portalCompletedAttemptsWindow: number
    staffCompletedAttemptsWindow: number
  }
  recommendations: ReturnType<typeof buildBlitzpayRevenueRecommendations>
}

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString()
}

function ymdTodayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

async function sumPendingScheduledInRange(
  admin: SupabaseClient,
  organizationId: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const { data, error } = await admin
    .from("blitzpay_scheduled_invoice_payments")
    .select("invoice_portion_cents")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .gte("scheduled_for", startIso)
    .lte("scheduled_for", endIso)
  if (error) throw new Error(error.message)
  return (data ?? []).reduce((s, r) => s + Math.max(0, Math.round(Number((r as { invoice_portion_cents: number }).invoice_portion_cents))), 0)
}

async function sumInstallmentRemainingDueInRange(
  admin: SupabaseClient,
  organizationId: string,
  startYmd: string,
  endYmd: string,
): Promise<number> {
  const { data: plans, error: pErr } = await admin
    .from("blitzpay_payment_plans")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
  if (pErr) throw new Error(pErr.message)
  const ids = (plans ?? []).map((p) => (p as { id: string }).id)
  if (ids.length === 0) return 0
  let sum = 0
  const chunk = 80
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk)
    const { data: rows, error } = await admin
      .from("blitzpay_payment_plan_installments")
      .select("target_cents, paid_cents, due_on, status, payment_plan_id")
      .in("payment_plan_id", slice)
      .not("due_on", "is", null)
      .gte("due_on", startYmd)
      .lte("due_on", endYmd)
    if (error) throw new Error(error.message)
    for (const r of rows ?? []) {
      const row = r as {
        target_cents: number
        paid_cents: number
        status: string
        payment_plan_id: string
      }
      const st = String(row.status || "").toLowerCase()
      if (st === "paid" || st === "canceled" || st === "waived") continue
      const rem = Math.max(0, Math.round(Number(row.target_cents)) - Math.round(Number(row.paid_cents)))
      sum += rem
    }
  }
  return sum
}

async function computeOverdueCollectible(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ overdueCollectibleCents: number; overdueInvoiceCount: number; largestBalanceCents: number }> {
  const today = ymdTodayUtc()
  const { data: invs, error } = await admin
    .from("org_invoices")
    .select("id, status, amount_cents, tax_amount_cents, due_date")
    .eq("organization_id", organizationId)
    .not("due_date", "is", null)
    .lt("due_date", today)
    .in("status", ["sent", "unpaid", "overdue"])
    .limit(400)
  if (error) throw new Error(error.message)
  const rows = (invs ?? []) as Array<{
    id: string
    status: string
    amount_cents: number
    tax_amount_cents: number | null
    due_date: string
  }>
  if (rows.length === 0) return { overdueCollectibleCents: 0, overdueInvoiceCount: 0, largestBalanceCents: 0 }
  const ids = rows.map((r) => r.id)
  const { data: pays, error: pErr } = await admin
    .from("org_invoice_payments")
    .select("invoice_id, amount_cents")
    .eq("organization_id", organizationId)
    .in("invoice_id", ids)
  if (pErr) throw new Error(pErr.message)
  const payBy = new Map<string, number>()
  for (const p of pays ?? []) {
    const row = p as { invoice_id: string; amount_cents: number }
    const id = row.invoice_id
    payBy.set(id, (payBy.get(id) ?? 0) + Math.round(Number(row.amount_cents)))
  }
  let overdueCollectibleCents = 0
  let overdueInvoiceCount = 0
  let largestBalanceCents = 0
  for (const inv of rows) {
    const total = invoiceGrandTotalCents(inv)
    const gross = payBy.get(inv.id) ?? 0
    const alloc = computeInvoicePaymentAllocation({
      invoiceTotalCents: total,
      paymentsTotalCents: gross,
      dbInvoiceStatus: String(inv.status || ""),
    })
    const bal = Math.max(0, alloc.balanceDueCents)
    if (bal > 0) {
      overdueInvoiceCount += 1
      overdueCollectibleCents += bal
      largestBalanceCents = Math.max(largestBalanceCents, bal)
    }
  }
  return { overdueCollectibleCents, overdueInvoiceCount, largestBalanceCents }
}

async function achPendingSettlementCents(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { data, error } = await admin
    .from("blitzpay_payment_intents")
    .select("amount_cents, ach_settlement_state, payment_method_type")
    .eq("organization_id", organizationId)
    .eq("status", "succeeded")
    .eq("payment_method_type", "us_bank_account")
  if (error) throw new Error(error.message)
  let sum = 0
  for (const r of data ?? []) {
    const row = r as { amount_cents: number; ach_settlement_state?: string | null }
    if (String(row.ach_settlement_state || "").toLowerCase() !== "settled") {
      sum += Math.max(0, Math.round(Number(row.amount_cents)))
    }
  }
  return sum
}

export async function fetchBlitzpayOrgRevenueIntelligence(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayOrgRevenueIntelligence> {
  assertUuid(organizationId, "organizationId")
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()
  const nowIso = new Date().toISOString()

  const collections = await computeBlitzpayCollectionsReporting(admin, organizationId)

  const [
    reporting,
    overdue,
    disputes,
    paymentLinksWindow,
    recoveryOpen,
    sched7,
    sched30,
    sched60,
    inst7,
    inst30,
    inst60,
    achPending,
  ] = await Promise.all([
    fetchBlitzpayOrgReportingSnapshot(admin, organizationId, {
      sinceIso,
      collectionsPulse: { reminderEffectivenessRatePct: collections.reminderEffectivenessRatePct },
    }),
    computeOverdueCollectible(admin, organizationId),
    admin
      .from("blitzpay_invoice_disputes")
      .select("amount_cents, status")
      .eq("organization_id", organizationId),
    admin
      .from("blitzpay_payment_links")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", sinceIso),
    admin
      .from("blitzpay_recovery_cases")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "open"),
    sumPendingScheduledInRange(admin, organizationId, nowIso, isoDaysFromNow(7)),
    sumPendingScheduledInRange(admin, organizationId, nowIso, isoDaysFromNow(30)),
    sumPendingScheduledInRange(admin, organizationId, nowIso, isoDaysFromNow(60)),
    sumInstallmentRemainingDueInRange(admin, organizationId, ymdTodayUtc(), isoDaysFromNow(7).slice(0, 10)),
    sumInstallmentRemainingDueInRange(admin, organizationId, ymdTodayUtc(), isoDaysFromNow(30).slice(0, 10)),
    sumInstallmentRemainingDueInRange(admin, organizationId, ymdTodayUtc(), isoDaysFromNow(60).slice(0, 10)),
    achPendingSettlementCents(admin, organizationId),
  ])

  let openDisputesCount = 0
  let openDisputesAmountCents = 0
  for (const d of disputes.data ?? []) {
    const row = d as { amount_cents: number; status: string }
    const st = String(row.status || "").toLowerCase()
    if (!DISPUTE_TERMINAL.has(st)) {
      openDisputesCount += 1
      openDisputesAmountCents += Math.max(0, Math.round(Number(row.amount_cents)))
    }
  }

  const pendingPayoutsCents = reporting.treasuryPendingPayoutTotalsCents

  const scheduledFuturePaymentsCents = await sumPendingScheduledInRange(
    admin,
    organizationId,
    nowIso,
    isoDaysFromNow(365 * 3),
  )

  const walletLiability = blitzpayWalletLiabilityCents(
    reporting.customerWalletSpendableCreditTotalCents,
    reporting.customerWalletRefundableCreditTotalCents,
  )

  const recoveryMult = blitzpayOverdueRecoveryMultiplier(collections.reminderEffectivenessRatePct)
  const overdueRecoveryExpectedCents = Math.round(overdue.overdueCollectibleCents * recoveryMult)

  const gross = reporting.grossProcessedVolumeCents
  const estimateDepositShareApprox = gross > 0 ? Math.min(1, reporting.estimateDepositCapturedCents / gross) : 0

  const dep = reporting.customerUnappliedEstimateDepositTotalCents
  const horizons = buildBlitzpayForecastHorizonsCents({
    scheduledPendingDueWithin7Cents: sched7,
    scheduledPendingDueWithin30Cents: sched30,
    scheduledPendingDueWithin60Cents: sched60,
    installmentRemainingDueWithin7Cents: inst7,
    installmentRemainingDueWithin30Cents: inst30,
    installmentRemainingDueWithin60Cents: inst60,
    overdueRecoveryExpectedCents,
    estimateDepositPipelineCents7: Math.round(dep * 0.12),
    estimateDepositPipelineCents30: dep,
    estimateDepositPipelineCents60: dep,
  })

  const recurringStability = reporting.blitzpayRecurringStabilityScore0to100
  const recurring30 = reporting.blitzpayRecurringPlannedInflow30dCents
  const churnAdjBump30 = Math.round(recurring30 * 0.06 * (recurringStability / 100))
  const horizonsChurnAdjusted = {
    next7DaysExpectedCents: horizons.next7DaysExpectedCents + Math.round(recurring30 * 0.02 * (recurringStability / 100)),
    next30DaysExpectedCents: horizons.next30DaysExpectedCents + churnAdjBump30,
    next60DaysExpectedCents: horizons.next60DaysExpectedCents + Math.round(recurring30 * 0.1 * (recurringStability / 100)),
  }

  const ach = reporting.achSettlement
  const achTotal = ach.pending + ach.settled + ach.failed
  const achSettledRatio = achTotal === 0 ? 1 : ach.settled / achTotal

  const recommendations = buildBlitzpayRevenueRecommendations({
    overdueCollectibleCents: overdue.overdueCollectibleCents,
    overdueInvoiceCount: overdue.overdueInvoiceCount,
    achPendingCount: ach.pending,
    achSettledRatio,
    estimateDepositShareApprox,
    walletLiabilityCents: walletLiability,
    walletCreditInflowWindowCents: reporting.customerWalletCreditInflowWindowCents,
    activeInstallmentPlansCount: reporting.blitzpayActivePaymentPlansCount,
    largeOpenInvoiceBalanceCents: overdue.largestBalanceCents,
    reminderEffectivenessRatePct: collections.reminderEffectivenessRatePct,
  })

  return {
    reportingWindowDays,
    reportingSource: reporting.reportingSource,
    dashboard: {
      grossCollectedWindowCents: reporting.grossProcessedVolumeCents,
      netCollectedWindowCents: reporting.netCollectedCents,
      refundedVolumeWindowCents: reporting.refundedVolumeCents,
      pendingPayoutsCents,
      openDisputesCount,
      openDisputesAmountCents,
      walletLiabilityCents: walletLiability,
      depositsCollectedWindowCents: reporting.estimateDepositCapturedCents,
      overdueCollectibleCents: overdue.overdueCollectibleCents,
      overdueInvoiceCount: overdue.overdueInvoiceCount,
      scheduledFuturePaymentsCents,
      activeInstallmentPlansCount: reporting.blitzpayActivePaymentPlansCount,
      abandonedCheckoutInvoices: collections.abandonedCheckoutInvoices,
      paymentLinksCreatedWindowCount: paymentLinksWindow.count ?? 0,
      workOrderCollectPaymentLinksWindowCount: reporting.blitzpayWorkOrderCollectPaymentLinksWindowCount,
      openRecoveryCasesCount: recoveryOpen.count ?? 0,
      treasuryEstimateUpcomingTransferCents: reporting.treasuryEstimateUpcomingTransferCents,
      estimatedRecoverableOverdueCents: reporting.estimatedRecoverableOverdueCents,
      likelyFieldCollectibleCents: reporting.likelyFieldCollectibleCents,
      achAccelerationOpportunityCents: reporting.achAccelerationOpportunityCents,
      installmentConversionOpportunityCents: reporting.installmentConversionOpportunityCents,
      technicianAssistedRecoveryRatePct: reporting.technicianAssistedRecoveryRatePct,
      reminderConversionRatePct: reporting.reminderConversionRatePct,
      fieldCollectionRecoveryRatePct: reporting.fieldCollectionRecoveryRatePct,
      workOrdersWithCollectibleBalancesCount: reporting.workOrdersWithCollectibleBalancesCount,
      paymentMethodMix: reporting.paymentMethodMix,
      customerWalletSpendableCreditTotalCents: reporting.customerWalletSpendableCreditTotalCents,
      recurringPlannedInflow30dCents: reporting.blitzpayRecurringPlannedInflow30dCents,
      recurringPlannedInflow90dCents: reporting.blitzpayRecurringPlannedInflow90dCents,
      annualizedRecurringRunRateProxyCents: reporting.blitzpayAnnualizedRecurringRunRateProxyCents,
      recurringMixOfCollectedWindowPct: reporting.blitzpayRecurringMixOfWindowPct,
      autopayAdoptionPct: reporting.blitzpayAutopayAdoptionPct,
      renewalSuccessProxyPct: reporting.blitzpayRenewalSuccessProxyPct,
      churnRiskScore0to100: reporting.blitzpayChurnRiskScore0to100,
      recurringStabilityScore0to100: reporting.blitzpayRecurringStabilityScore0to100,
      projectedRenewalRevenue90dCents: reporting.blitzpayProjectedRenewalRevenue90dCents,
      renewalRecoveryOpportunityCents: reporting.blitzpayRenewalRecoveryOpportunityCents,
      autopayRiskExposureCents: reporting.blitzpayAutopayRiskExposureCents,
      payrollPendingCommissionCents: reporting.payrollPendingCommissionCents,
      payrollLiabilityCents: reporting.payrollLiabilityCents,
      contractorSettlementExposureCents: reporting.contractorSettlementExposureCents,
      recurringRevenueSharePendingCents: reporting.recurringRevenueSharePendingCents,
      estimatedPayrollBurdenCents: reporting.estimatedPayrollBurdenCents,
      commissionVelocity7dCents: reporting.commissionVelocity7dCents,
      recurringMemberPayoutStability0to100: reporting.recurringMemberPayoutStability0to100,
      estimatedOperatingCashCents: reporting.estimatedOperatingCashCents,
      cashReserveGapCents: reporting.cashReserveGapCents,
      cashRunwayStatus: reporting.cashRunwayStatus,
      expectedOutflows30dCents: reporting.expectedOutflows30dCents,
      payrollReserveCoverageBasisPoints: reporting.payrollReserveCoverageBasisPoints,
      apReserveCoverageBasisPoints: reporting.apReserveCoverageBasisPoints,
    },
    forecasts: {
      ...horizonsChurnAdjusted,
      achPendingSettlementCents: achPending,
      overdueRecoveryExpectedCents,
    },
    collections: {
      ...collections,
      paymentLinksCreatedWindowCount: paymentLinksWindow.count ?? 0,
      workOrderCollectPaymentLinksWindowCount: reporting.blitzpayWorkOrderCollectPaymentLinksWindowCount,
      openRecoveryCasesCount: recoveryOpen.count ?? 0,
      portalCompletedAttemptsWindow: reporting.paymentSourceSplit.customer_portal,
      staffCompletedAttemptsWindow: reporting.paymentSourceSplit.staff_dashboard,
    },
    recommendations,
  }
}

export type BlitzpayPlatformRevenueRollup = {
  reportingWindowDays: number
  ledgerPaymentCapturedCentsWindow: number
  succeededPaymentIntentsCountWindow: number
  openDisputesPlatformCount: number
  walletLiabilityTotalCentsApprox: number
  /** Sum of in-flight payout amounts (bounded read; Stripe mirror). */
  treasuryPendingInFlightPayoutCentsApprox: number
  treasuryFailedPayouts30dCount: number
  treasuryInstantPayoutInterestOrgsCount: number
  /** Phase 2S — bounded scan of open vendor payables (internal AP, not customer portal). */
  apOpenPayablesOrgsApprox: number
  apOpenOutstandingCentsTotalApprox: number
  apOverdueOpenLinesApprox: number
}

/**
 * Platform-wide rollups for BlitzPay Ops (bounded reads).
 */
export async function fetchBlitzpayPlatformRevenueRollup(
  admin: SupabaseClient,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayPlatformRevenueRollup> {
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()

  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString()

  const todayYmd = new Date().toISOString().slice(0, 10)

  const [
    { data: led },
    { count: piCount },
    disputesRes,
    { data: wallets },
    { data: inflightRows },
    { count: failedPayout30 },
    { count: instantInterestOrgs },
  ] = await Promise.all([
    admin
      .from("blitzpay_ledger_entries")
      .select("amount_cents")
      .eq("entry_type", "payment_captured")
      .gte("created_at", sinceIso)
      .limit(8000),
    admin
      .from("blitzpay_payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("status", "succeeded")
      .gte("created_at", sinceIso),
    admin.from("blitzpay_invoice_disputes").select("status").limit(3000),
    admin.from("blitzpay_customer_wallets").select("available_credit_cents, refundable_credit_cents").limit(5000),
    admin
      .from("blitzpay_payouts")
      .select("amount_cents")
      .in("status", ["pending", "in_transit"])
      .limit(4000),
    admin
      .from("blitzpay_payouts")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("stripe_created_at", since30d),
    admin
      .from("blitzpay_org_settings")
      .select("organization_id", { count: "exact", head: true })
      .eq("blitzpay_instant_payout_interest", true),
  ])

  let apRows: Array<{ organization_id?: string; amount_cents?: number; due_date?: string; status?: string }> = []
  try {
    const { data, error } = await admin
      .from("blitzpay_vendor_payables")
      .select("organization_id, amount_cents, due_date, status")
      .in("status", ["draft", "pending_approval", "approved", "scheduled"])
      .limit(8000)
    if (!error && data) apRows = data as typeof apRows
  } catch {
    /* table may not exist before migration */
  }

  let ledgerPaymentCapturedCentsWindow = 0
  for (const r of led ?? []) {
    ledgerPaymentCapturedCentsWindow += Math.max(0, Math.round(Number((r as { amount_cents: number }).amount_cents)))
  }

  let openDisputesPlatformCount = 0
  for (const d of disputesRes.data ?? []) {
    const st = String((d as { status?: string }).status ?? "").toLowerCase()
    if (!DISPUTE_TERMINAL.has(st)) openDisputesPlatformCount += 1
  }

  let treasuryPendingInFlightPayoutCentsApprox = 0
  for (const r of inflightRows ?? []) {
    treasuryPendingInFlightPayoutCentsApprox += Math.max(
      0,
      Math.round(Number((r as { amount_cents: number }).amount_cents)),
    )
  }

  let walletLiabilityTotalCentsApprox = 0
  for (const w of wallets ?? []) {
    const row = w as { available_credit_cents?: number; refundable_credit_cents?: number }
    walletLiabilityTotalCentsApprox += blitzpayWalletLiabilityCents(
      Math.round(Number(row.available_credit_cents ?? 0)),
      Math.round(Number(row.refundable_credit_cents ?? 0)),
    )
  }

  const orgsWithAp = new Set<string>()
  let apOpenOutstandingCentsTotalApprox = 0
  let apOverdueOpenLinesApprox = 0
  const todayMs = Date.parse(`${todayYmd}T00:00:00.000Z`)
  for (const r of apRows) {
    const row = r
    const oid = String(row.organization_id ?? "")
    if (!oid) continue
    orgsWithAp.add(oid)
    apOpenOutstandingCentsTotalApprox += Math.max(0, Math.round(Number(row.amount_cents ?? 0)))
    const due = String(row.due_date ?? "").slice(0, 10)
    const dueMs = Date.parse(`${due}T00:00:00.000Z`)
    if (Number.isFinite(dueMs) && dueMs < todayMs) apOverdueOpenLinesApprox += 1
  }

  return {
    reportingWindowDays,
    ledgerPaymentCapturedCentsWindow,
    succeededPaymentIntentsCountWindow: piCount ?? 0,
    openDisputesPlatformCount,
    walletLiabilityTotalCentsApprox,
    treasuryPendingInFlightPayoutCentsApprox,
    treasuryFailedPayouts30dCount: failedPayout30.count ?? 0,
    treasuryInstantPayoutInterestOrgsCount: instantInterestOrgs.count ?? 0,
    apOpenPayablesOrgsApprox: orgsWithAp.size,
    apOpenOutstandingCentsTotalApprox,
    apOverdueOpenLinesApprox,
  }
}
