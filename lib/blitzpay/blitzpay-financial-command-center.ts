import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildCombinedArApCashForecast } from "@/lib/blitzpay/blitzpay-command-center-math"
import {
  buildFinancialCommandCenterRecommendations,
  type FinancialCommandCenterRecommendation,
} from "@/lib/blitzpay/blitzpay-command-center-recommendations"
import { aggregateBlitzpayTreasuryMetrics } from "@/lib/blitzpay/blitzpay-contractor-treasury"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { buildOwnerScorecards, type OwnerScorecard } from "@/lib/blitzpay/blitzpay-owner-scorecards"
import { computeBlitzpayCollectionsReporting } from "@/lib/blitzpay/blitzpay-collections"
import { fetchBlitzpayOrgRevenueIntelligence } from "@/lib/blitzpay/blitzpay-revenue-intelligence"
import type { BlitzpayRevenueRecommendation } from "@/lib/blitzpay/blitzpay-revenue-recommendations"
import { fetchBlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import { fetchBlitzpayMembershipDashboard } from "@/lib/blitzpay/blitzpay-memberships"
import { summarizePayrollHealth } from "@/lib/blitzpay/blitzpay-payroll-runs"
import {
  computeBlitzpayOperationalReadinessStrip,
  type BlitzpayOperationalReadinessStrip,
} from "@/lib/blitzpay/blitzpay-operational-readiness"
import { isStripeLiveEnforced } from "@/lib/billing/stripe-env"
import {
  buildBlitzpayStripeLiveReadinessStrip,
  type BlitzpayStripeLiveReadinessStrip,
  parseStripePublishableKeyMode,
  parseStripeSecretKeyMode,
} from "@/lib/blitzpay/blitzpay-stripe-readiness-guards"

function countJsonStringArrayLength(value: unknown): number {
  if (!Array.isArray(value)) return 0
  return value.filter((x): x is string => typeof x === "string").length
}

export type BlitzpayFinancialCommandCenterDrilldown = {
  href: string
  label: string
  /** Safe aggregate for UI; not a Stripe id. */
  count?: number
}

export type BlitzpayFinancialCommandCenterPayload = {
  reportingWindowDays: number
  generatedAt: string
  tiles: {
    cashCollectedWindowCents: number
    expectedCollections7Cents: number
    expectedCollections30Cents: number
    expectedCollections60Cents: number
    openArOverdueCents: number
    openArOverdueInvoiceCount: number
    openApOutstandingCents: number
    pendingPayoutsCents: number
    walletCreditLiabilityCents: number
    depositsUnappliedCents: number
    refundsWindowCents: number
    openDisputesCount: number
    openDisputesAmountCents: number
    scheduledFuturePaymentsCents: number
    activeInstallmentPlansCount: number
    treasuryOperatingCents: number
    treasuryHeldReserveCents: number
    reserveTargetCents: number
    payoutPressureCents: number
    workOrderPaymentLinksWindowCount: number
    abandonedCheckoutInvoices: number
    recurringStabilityScore0to100: number
    plannedRecurringInflow30dCents: number
    autopayAdoptionPct: number
    membershipMrrCents: number
    membershipDelinquentCount: number
    membershipChurnRisk0to100: number
    membershipOpenFailures: number
    membershipRenewalPipelineCents: number
    /** Phase 2Y — payroll / commission exposure (bounded). */
    payrollPendingCommissionCents: number
    payrollLiabilityCents: number
    contractorSettlementExposureCents: number
    recurringRevenueSharePendingCents: number
    commissionVelocity7dCents: number
    draftPayrollRuns: number
    /** Phase 2Z — internal cash planning (not custodial). */
    estimatedOperatingCashCents: number
    cashReserveTargetCents: number
    cashReserveGapCents: number
    cashRunwayStatus: "healthy" | "watch" | "risk"
    expectedInflows7dCents: number
    expectedInflows30dCents: number
    expectedOutflows7dCents: number
    expectedOutflows30dCents: number
    payrollReserveCoverageBasisPoints: number
    apReserveCoverageBasisPoints: number
    /** Phase 3A — internal GL snapshot (from reporting; bounded). */
    totalAssetsCents: number
    totalLiabilitiesCents: number
    totalEquityCents: number
    deferredRevenueCents: number
    accountsReceivableCents: number
    accountsPayableCents: number
    payrollLiabilityGlCents: number
    trialBalanceHealthy: boolean
    unreconciledBatchCount: number
    pendingRevenueRecognitionCount: number
    /** Phase 3B — vendor bills AP orchestration (from reporting; bounded). */
    accountsPayableOutstandingCents: number
    approvedBillsAwaitingPaymentCents: number
    overdueVendorBillsCents: number
    averageVendorPaymentDays: number | null
    vendorConcentrationRisk: number
    treasuryCoverageForPayables: number
    payableAgingHealthScore: number
    /** Phase 3C — tax & compliance indicators (bounded; not legal advice). */
    salesTaxPayableCents: number
    payrollTaxPayableCents: number
    contractorTaxEstimateCents: number
    convenienceFeeExposureRisk: number
    achAuthorizationCoverageRate: number
    vendor1099ReadinessRate: number
    filingReadinessScore: number
    complianceHealthScore: number
    /** Phase 3D — financing marketplace (bounded; orchestration only). */
    financingApplicationApprovalRate: number
    averageApprovedFinancingAmount: number
    financingMarketplaceCoverage: number
    contractorAdvanceExposure: number
    financingRevenueOpportunity: number
    financingRiskScore: number
    financingConversionRate: number
    financingTreasuryImpactScore: number
    /** Phase 3E — procurement & inventory finance (bounded). */
    totalInventoryValueCents: number
    inventoryWriteoffExposure: number
    inventoryTurnoverScore: number
    reorderExposureCents: number
    rebateOpportunityCents: number
    serializedAssetExposure: number
    procurementTreasuryImpactScore: number
    inventoryMarginHealthScore: number
    /** Phase 4A — deterministic copilot scores (0–100; advisory). */
    aiFinancialRiskScore: number
    treasuryPressureScore: number
    marginRiskScore: number
    collectionsOptimizationScore: number
    payrollPressureScore: number
    procurementEfficiencyScore: number
    vendorConcentrationRiskScore: number
    aiInsightCoverageRate: number
    revenueOptimizationScore: number
    estimatedRevenueOpportunityCents: number
    paymentBehaviorCoverageRate: number
    churnPreventionOpportunityCount: number
    achNudgeOpportunityCount: number
    renewalOptimizationOpportunityCount: number
    technicianCoachingOpportunityCount: number
    optimizationExperimentCount: number
    /** Phase 5A — multi-entity / franchise rollups (explicit linkage; advisory). */
    multiEntityRevenueExposure: number
    multiEntityTreasuryExposure: number
    intercompanyBalanceExposure: number
    consolidatedCollectionsRate: number
    franchiseHealthScore: number
    sharedBenchmarkCoverage: number
    multiEntityRiskScore: number
    consolidatedOrganizationCount: number
    /** Phase 5B — supplier network (aggregate / advisory only). */
    supplierNetworkParticipationScore: number
    procurementBenchmarkScore: number
    preferredPricingOpportunityCents: number
    bulkPurchaseOpportunityCents: number
    supplierPerformanceHealthScore: number
    rebateCaptureOpportunityScore: number
    vendorFinancingOpportunityScore: number
    supplierNetworkCoverageRate: number
    /** Phase 5C — claims / warranty / protection (tracking only). */
    warrantyReserveExposure: number
    claimsExposureCents: number
    claimsReserveCoverageScore: number
    protectionPlanRecurringRevenue: number
    stormEventTreasuryPressure: number
    contractorProtectionHealthScore: number
    claimsPayoutExposure: number
    protectionPlanCoverageRate: number
    /** Phase 6A — mobile field financial capture (offline intent; server-validated). */
    mobileFinancialIntentCount: number
    offlineFinancialIntentCount: number
    mobileSyncFailureRate: number
    mobileSignatureCoverageRate: number
    mobilePayrollApprovalPendingCount: number
    fieldCollectionsIntentCents: number
    mobileTreasuryVisibilityScore: number
    mobileConflictReviewCount: number
    /** Phase 6B — enterprise observability (bounded metrics; no autonomous execution). */
    queueHealthScore: number
    workflowFailureRate: number
    idempotencyConflictRate: number
    replayPendingCount: number
    observabilityCoverageRate: number
    workerHealthScore: number
    multiRegionReadinessScore: number
    replayIntegrityScore: number
  }
  combinedForecast: ReturnType<typeof buildCombinedArApCashForecast>
  scorecards: OwnerScorecard[]
  /** Deterministic command-center automation strings. */
  commandCenterRecommendations: FinancialCommandCenterRecommendation[]
  /** Existing BlitzPay revenue / collections recommendations (structured). */
  revenueRecommendations: BlitzpayRevenueRecommendation[]
  drilldowns: Record<string, BlitzpayFinancialCommandCenterDrilldown>
  /** Phase 7A — additive operational maturity strip for staff FCC (no customer exposure). */
  operationalReadiness: BlitzpayOperationalReadinessStrip
  /** Phase 7A.6 — Stripe / Connect live readiness (advisory; no secrets). */
  stripeLiveReadiness: BlitzpayStripeLiveReadinessStrip
}

function drilldownsForOrg(overdueCount: number): Record<string, BlitzpayFinancialCommandCenterDrilldown> {
  return {
    invoices: { href: "/invoices", label: "Open invoices" },
    overdueInvoices: { href: "/invoices", label: "Review overdue invoices", count: overdueCount },
    quotes: { href: "/quotes", label: "Quotes & estimates" },
    workOrders: { href: "/work-orders", label: "Work orders" },
    customers: { href: "/customers", label: "Customers" },
    vendorPayables: {
      href: "/insights/financial-command-center/vendor-bills#blitzpay-ap-anchor",
      label: "Vendor payables (BlitzPay FCC)",
    },
    paymentLinks: { href: "/work-orders", label: "Work orders (field collection)" },
    payouts: {
      href: "/insights/financial-command-center/operating-cash#blitzpay-fcc-payout-ledger-anchor",
      label: "Payout ledger (BlitzPay FCC)",
    },
    disputes: { href: "/insights/financial-command-center/command-center-data", label: "Disputes and refunds (BlitzPay)" },
    reports: { href: "/reports", label: "Operations reports" },
    memberships: { href: "/memberships", label: "Memberships & agreements" },
    payroll: { href: "/insights/financial-command-center/payroll-commissions", label: "Payroll & commissions (BlitzPay)" },
    cashPlanning: { href: "/insights/financial-command-center/operating-cash", label: "Operating cash & runway (BlitzPay)" },
    accounting: { href: "/insights/financial-command-center/internal-books", label: "Internal books & trial balance (BlitzPay)" },
    apBillPay: { href: "/insights/financial-command-center/vendor-bills", label: "Vendor bills & pay planning (BlitzPay)" },
    taxCompliance: { href: "/insights/financial-command-center/tax-compliance", label: "Tax & compliance overview (BlitzPay)" },
    financingMarketplace: {
      href: "/insights/financial-command-center/financing-marketplace",
      label: "Financing marketplace (BlitzPay)",
    },
    procurementInventory: {
      href: "/insights/financial-command-center/procurement-inventory",
      label: "Procurement & inventory finance (BlitzPay)",
    },
    multiEntityFinance: {
      href: "/insights/financial-command-center/multi-entity-finance",
      label: "Multi-entity finance (linked locations)",
    },
    supplierNetwork: {
      href: "/insights/financial-command-center/supplier-network",
      label: "Supplier network (opt-in coordination)",
    },
    claimsProtection: {
      href: "/insights/financial-command-center/claims-protection",
      label: "Claims & protection (tracking)",
    },
    mobileFinancialOps: {
      href: "/insights/financial-command-center/mobile-financial-ops",
      label: "Mobile financial ops (field capture)",
    },
    enterpriseObservability: {
      href: "/insights/financial-command-center/enterprise-observability",
      label: "Enterprise observability (queues & replays)",
    },
  }
}

export async function fetchBlitzpayOrgFinancialCommandCenter(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayFinancialCommandCenterPayload> {
  assertUuid(organizationId, "organizationId")
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()

  const collections = await computeBlitzpayCollectionsReporting(admin, organizationId)
  const reporting = await fetchBlitzpayOrgReportingSnapshot(admin, organizationId, {
    sinceIso,
    collectionsPulse: { reminderEffectivenessRatePct: collections.reminderEffectivenessRatePct },
  })

  const [intelligence, membershipDash, payrollHealth] = await Promise.all([
    fetchBlitzpayOrgRevenueIntelligence(admin, organizationId, {
      reportingWindowDays,
      precomputedReporting: reporting,
      precomputedCollections: collections,
    }),
    fetchBlitzpayMembershipDashboard(admin, organizationId).catch(() => null),
    summarizePayrollHealth(admin, organizationId).catch(() => null),
  ])

  let stripePayoutsEnabled = false
  let pendingApprovalPayableCount = 0
  const [{ data: orgRow }, { count: apPendingCount, error: apErr }] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "stripe_connect_account_id, stripe_payouts_enabled, stripe_connect_status, stripe_charges_enabled, stripe_details_submitted, stripe_requirements_currently_due, stripe_requirements_past_due",
      )
      .eq("id", organizationId)
      .maybeSingle(),
    admin
      .from("blitzpay_vendor_payables")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending_approval"),
  ])
  if (!apErr && apPendingCount != null) pendingApprovalPayableCount = apPendingCount
  const org = orgRow as {
    stripe_connect_account_id?: string | null
    stripe_payouts_enabled?: boolean | null
    stripe_connect_status?: string | null
    stripe_charges_enabled?: boolean | null
    stripe_details_submitted?: boolean | null
    stripe_requirements_currently_due?: unknown
    stripe_requirements_past_due?: unknown
  } | null

  stripePayoutsEnabled = Boolean(org?.stripe_payouts_enabled)

  let tm: Awaited<ReturnType<typeof aggregateBlitzpayTreasuryMetrics>> | null = null
  try {
    tm = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
  } catch {
    tm = null
  }

  const d = intelligence.dashboard
  const fcast = intelligence.forecasts
  const forecastHorizons = {
    next7DaysExpectedCents: fcast.next7DaysExpectedCents,
    next30DaysExpectedCents: fcast.next30DaysExpectedCents,
    next60DaysExpectedCents: fcast.next60DaysExpectedCents,
  }
  const payoutPressure = Math.max(d.pendingPayoutsCents, d.treasuryEstimateUpcomingTransferCents)

  const combinedForecast = buildCombinedArApCashForecast({
    forecastHorizons,
    apDue7OpenCents: reporting.apDue7OpenCents,
    apDue30OpenCents: reporting.apDue30OpenCents,
    apDue60OpenCents: reporting.apDue60OpenCents,
    payoutPressureCents: payoutPressure,
  })

  const operating = tm?.operatingBalanceCents ?? 0
  const held = tm?.heldReserveCents ?? 0
  const reserveTarget = tm?.reserveTargetCents ?? 0

  const scorecards = buildOwnerScorecards({
    overdueInvoiceCount: d.overdueInvoiceCount,
    overdueCollectibleCents: d.overdueCollectibleCents,
    netCashPosition30Cents: combinedForecast.netCashPosition30Cents,
    netCashPosition7Cents: combinedForecast.netCashPosition7Cents,
    abandonedCheckoutInvoices: d.abandonedCheckoutInvoices,
    stripePayoutsEnabled,
    failedPayoutCount30d: reporting.treasuryFailedPayoutCount30d,
    apDue30OpenCents: reporting.apDue30OpenCents,
    operatingBalanceCents: operating,
    walletLiabilityCents: d.walletLiabilityCents,
    openDisputesCount: d.openDisputesCount,
    openDisputesAmountCents: d.openDisputesAmountCents,
    reminderEffectivenessRatePct: intelligence.collections.reminderEffectivenessRatePct,
  })

  const commandCenterRecommendations = buildFinancialCommandCenterRecommendations({
    combined: combinedForecast,
    overdueInvoiceCount: d.overdueInvoiceCount,
    overdueCollectibleCents: d.overdueCollectibleCents,
    apDue7OpenCents: reporting.apDue7OpenCents,
    apDue30OpenCents: reporting.apDue30OpenCents,
    expectedInflow30Cents: forecastHorizons.next30DaysExpectedCents,
    reserveTargetCents: reserveTarget,
    heldReserveCents: held,
    openDisputesAmountCents: d.openDisputesAmountCents,
    failedPayoutCount30d: reporting.treasuryFailedPayoutCount30d,
    financingReadyQuotesCount: reporting.financingReadyQuotesCount,
    estimateOpenQuotesWithTotalCount: reporting.estimateOpenQuotesWithTotalCount,
    workOrderCollectPaymentLinksWindowCount: d.workOrderCollectPaymentLinksWindowCount,
    pendingApprovalPayableCount,
    cashRunwayStatus: reporting.cashRunwayStatus,
    cashReserveGapCents: reporting.cashReserveGapCents,
    estimatedOperatingCashCents: reporting.estimatedOperatingCashCents,
    payrollLiabilityCents: reporting.payrollLiabilityCents,
    expectedInflows30Cents: reporting.expectedInflows30dCents,
    expectedOutflows30Cents: reporting.expectedOutflows30dCents,
    recurringPlannedInflow30dCents: reporting.blitzpayRecurringPlannedInflow30dCents,
    trialBalanceHealthy: reporting.trialBalanceHealthy,
    unreconciledBatchCount: reporting.unreconciledBatchCount,
    pendingRevenueRecognitionCount: reporting.pendingRevenueRecognitionCount,
  })

  const generatedAt = new Date().toISOString()
  const connectStatus = org?.stripe_connect_account_id ?
      String(org.stripe_connect_status ?? "onboarding_started")
    : "not_started"

  const stripeLiveReadiness = buildBlitzpayStripeLiveReadinessStrip({
    generatedAtIso: generatedAt,
    stripeSecretKeyMode: parseStripeSecretKeyMode(process.env.STRIPE_SECRET_KEY),
    nextPublicPublishableKeyMode: parseStripePublishableKeyMode(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    stripeLiveModeEnforcedOnHost: isStripeLiveEnforced(),
    blitzpayWebhookSecretConfigured: Boolean(process.env.STRIPE_BLITZPAY_WEBHOOK_SECRET?.trim()),
    connectStatus,
    stripeChargesEnabled: Boolean(org?.stripe_charges_enabled),
    stripePayoutsEnabled,
    stripeDetailsSubmitted: Boolean(org?.stripe_details_submitted),
    requirementsCurrentlyDueCount: countJsonStringArrayLength(org?.stripe_requirements_currently_due),
    requirementsPastDueCount: countJsonStringArrayLength(org?.stripe_requirements_past_due),
    failedPayoutCount30d: reporting.treasuryFailedPayoutCount30d,
    pendingPayoutsCents: d.pendingPayoutsCents,
    openDisputesCount: d.openDisputesCount,
    openDisputesAmountCents: d.openDisputesAmountCents,
    achNudgeOpportunityCount: reporting.achNudgeOpportunityCount,
  })

  return {
    reportingWindowDays,
    generatedAt,
    tiles: {
      cashCollectedWindowCents: d.grossCollectedWindowCents,
      expectedCollections7Cents: forecastHorizons.next7DaysExpectedCents,
      expectedCollections30Cents: forecastHorizons.next30DaysExpectedCents,
      expectedCollections60Cents: forecastHorizons.next60DaysExpectedCents,
      openArOverdueCents: d.overdueCollectibleCents,
      openArOverdueInvoiceCount: d.overdueInvoiceCount,
      openApOutstandingCents: reporting.apOpenOutstandingCents,
      pendingPayoutsCents: d.pendingPayoutsCents,
      walletCreditLiabilityCents: d.walletLiabilityCents,
      depositsUnappliedCents: reporting.customerUnappliedEstimateDepositTotalCents,
      refundsWindowCents: d.refundedVolumeWindowCents,
      openDisputesCount: d.openDisputesCount,
      openDisputesAmountCents: d.openDisputesAmountCents,
      scheduledFuturePaymentsCents: d.scheduledFuturePaymentsCents,
      activeInstallmentPlansCount: d.activeInstallmentPlansCount,
      treasuryOperatingCents: operating,
      treasuryHeldReserveCents: held,
      reserveTargetCents: reserveTarget,
      payoutPressureCents: payoutPressure,
      workOrderPaymentLinksWindowCount: d.workOrderCollectPaymentLinksWindowCount,
      abandonedCheckoutInvoices: d.abandonedCheckoutInvoices,
      recurringStabilityScore0to100: d.recurringStabilityScore0to100,
      plannedRecurringInflow30dCents: d.recurringPlannedInflow30dCents,
      autopayAdoptionPct: d.autopayAdoptionPct,
      membershipMrrCents: membershipDash?.mrrCents ?? 0,
      membershipDelinquentCount: membershipDash?.delinquentCount ?? 0,
      membershipChurnRisk0to100: membershipDash?.churnRiskScore0to100 ?? 0,
      membershipOpenFailures: membershipDash?.openFailureCount ?? 0,
      membershipRenewalPipelineCents: membershipDash?.renewalPipelineCents ?? 0,
      payrollPendingCommissionCents: payrollHealth?.pendingCommissionCents ?? 0,
      payrollLiabilityCents:
        (payrollHealth?.pendingCommissionCents ?? 0) +
        (payrollHealth?.contractorSettlementPendingCents ?? 0) +
        (payrollHealth?.revenueSharePendingCents ?? 0),
      contractorSettlementExposureCents: payrollHealth?.contractorSettlementPendingCents ?? 0,
      recurringRevenueSharePendingCents: payrollHealth?.revenueSharePendingCents ?? 0,
      commissionVelocity7dCents: payrollHealth?.commissionVelocity7dCents ?? 0,
      draftPayrollRuns: payrollHealth?.draftPayrollRuns ?? 0,
      estimatedOperatingCashCents: reporting.estimatedOperatingCashCents,
      cashReserveTargetCents: reporting.cashReserveTargetCents,
      cashReserveGapCents: reporting.cashReserveGapCents,
      cashRunwayStatus: reporting.cashRunwayStatus,
      expectedInflows7dCents: reporting.expectedInflows7dCents,
      expectedInflows30dCents: reporting.expectedInflows30dCents,
      expectedOutflows7dCents: reporting.expectedOutflows7dCents,
      expectedOutflows30dCents: reporting.expectedOutflows30dCents,
      payrollReserveCoverageBasisPoints: reporting.payrollReserveCoverageBasisPoints,
      apReserveCoverageBasisPoints: reporting.apReserveCoverageBasisPoints,
      totalAssetsCents: reporting.totalAssetsCents,
      totalLiabilitiesCents: reporting.totalLiabilitiesCents,
      totalEquityCents: reporting.totalEquityCents,
      deferredRevenueCents: reporting.deferredRevenueCents,
      accountsReceivableCents: reporting.accountsReceivableCents,
      accountsPayableCents: reporting.accountsPayableCents,
      payrollLiabilityGlCents: reporting.glPayrollLiabilityCents,
      trialBalanceHealthy: reporting.trialBalanceHealthy,
      unreconciledBatchCount: reporting.unreconciledBatchCount,
      pendingRevenueRecognitionCount: reporting.pendingRevenueRecognitionCount,
      accountsPayableOutstandingCents: reporting.accountsPayableOutstandingCents,
      approvedBillsAwaitingPaymentCents: reporting.approvedBillsAwaitingPaymentCents,
      overdueVendorBillsCents: reporting.overdueVendorBillsCents,
      averageVendorPaymentDays: reporting.averageVendorPaymentDays,
      vendorConcentrationRisk: reporting.vendorConcentrationRisk,
      treasuryCoverageForPayables: reporting.treasuryCoverageForPayables,
      payableAgingHealthScore: reporting.payableAgingHealthScore,
      salesTaxPayableCents: reporting.salesTaxPayableCents,
      payrollTaxPayableCents: reporting.payrollTaxPayableCents,
      contractorTaxEstimateCents: reporting.contractorTaxEstimateCents,
      convenienceFeeExposureRisk: reporting.convenienceFeeExposureRisk,
      achAuthorizationCoverageRate: reporting.achAuthorizationCoverageRate,
      vendor1099ReadinessRate: reporting.vendor1099ReadinessRate,
      filingReadinessScore: reporting.filingReadinessScore,
      complianceHealthScore: reporting.complianceHealthScore,
      financingApplicationApprovalRate: reporting.financingApplicationApprovalRate,
      averageApprovedFinancingAmount: reporting.averageApprovedFinancingAmount,
      financingMarketplaceCoverage: reporting.financingMarketplaceCoverage,
      contractorAdvanceExposure: reporting.contractorAdvanceExposure,
      financingRevenueOpportunity: reporting.financingRevenueOpportunity,
      financingRiskScore: reporting.financingRiskScore,
      financingConversionRate: reporting.financingConversionRate,
      financingTreasuryImpactScore: reporting.financingTreasuryImpactScore,
      totalInventoryValueCents: reporting.totalInventoryValueCents,
      inventoryWriteoffExposure: reporting.inventoryWriteoffExposure,
      inventoryTurnoverScore: reporting.inventoryTurnoverScore,
      reorderExposureCents: reporting.reorderExposureCents,
      rebateOpportunityCents: reporting.rebateOpportunityCents,
      serializedAssetExposure: reporting.serializedAssetExposure,
    procurementTreasuryImpactScore: reporting.procurementTreasuryImpactScore,
    inventoryMarginHealthScore: reporting.inventoryMarginHealthScore,
    aiFinancialRiskScore: reporting.aiFinancialRiskScore,
    treasuryPressureScore: reporting.treasuryPressureScore,
    marginRiskScore: reporting.marginRiskScore,
    collectionsOptimizationScore: reporting.collectionsOptimizationScore,
    payrollPressureScore: reporting.payrollPressureScore,
    procurementEfficiencyScore: reporting.procurementEfficiencyScore,
    vendorConcentrationRiskScore: reporting.vendorConcentrationRiskScore,
    aiInsightCoverageRate: reporting.aiInsightCoverageRate,
    revenueOptimizationScore: reporting.revenueOptimizationScore,
    estimatedRevenueOpportunityCents: reporting.estimatedRevenueOpportunityCents,
    paymentBehaviorCoverageRate: reporting.paymentBehaviorCoverageRate,
    churnPreventionOpportunityCount: reporting.churnPreventionOpportunityCount,
    achNudgeOpportunityCount: reporting.achNudgeOpportunityCount,
    renewalOptimizationOpportunityCount: reporting.renewalOptimizationOpportunityCount,
    technicianCoachingOpportunityCount: reporting.technicianCoachingOpportunityCount,
    optimizationExperimentCount: reporting.optimizationExperimentCount,
    multiEntityRevenueExposure: reporting.multiEntityRevenueExposure,
    multiEntityTreasuryExposure: reporting.multiEntityTreasuryExposure,
    intercompanyBalanceExposure: reporting.intercompanyBalanceExposure,
    consolidatedCollectionsRate: reporting.consolidatedCollectionsRate,
    franchiseHealthScore: reporting.franchiseHealthScore,
    sharedBenchmarkCoverage: reporting.sharedBenchmarkCoverage,
    multiEntityRiskScore: reporting.multiEntityRiskScore,
    consolidatedOrganizationCount: reporting.consolidatedOrganizationCount,
    supplierNetworkParticipationScore: reporting.supplierNetworkParticipationScore,
    procurementBenchmarkScore: reporting.procurementBenchmarkScore,
    preferredPricingOpportunityCents: reporting.preferredPricingOpportunityCents,
    bulkPurchaseOpportunityCents: reporting.bulkPurchaseOpportunityCents,
    supplierPerformanceHealthScore: reporting.supplierPerformanceHealthScore,
    rebateCaptureOpportunityScore: reporting.rebateCaptureOpportunityScore,
    vendorFinancingOpportunityScore: reporting.vendorFinancingOpportunityScore,
    supplierNetworkCoverageRate: reporting.supplierNetworkCoverageRate,
    warrantyReserveExposure: reporting.warrantyReserveExposure,
    claimsExposureCents: reporting.claimsExposureCents,
    claimsReserveCoverageScore: reporting.claimsReserveCoverageScore,
    protectionPlanRecurringRevenue: reporting.protectionPlanRecurringRevenue,
    stormEventTreasuryPressure: reporting.stormEventTreasuryPressure,
    contractorProtectionHealthScore: reporting.contractorProtectionHealthScore,
    claimsPayoutExposure: reporting.claimsPayoutExposure,
    protectionPlanCoverageRate: reporting.protectionPlanCoverageRate,
    mobileFinancialIntentCount: reporting.mobileFinancialIntentCount,
    offlineFinancialIntentCount: reporting.offlineFinancialIntentCount,
    mobileSyncFailureRate: reporting.mobileSyncFailureRate,
    mobileSignatureCoverageRate: reporting.mobileSignatureCoverageRate,
    mobilePayrollApprovalPendingCount: reporting.mobilePayrollApprovalPendingCount,
    fieldCollectionsIntentCents: reporting.fieldCollectionsIntentCents,
    mobileTreasuryVisibilityScore: reporting.mobileTreasuryVisibilityScore,
    mobileConflictReviewCount: reporting.mobileConflictReviewCount,
    queueHealthScore: reporting.queueHealthScore,
    workflowFailureRate: reporting.workflowFailureRate,
    idempotencyConflictRate: reporting.idempotencyConflictRate,
    replayPendingCount: reporting.replayPendingCount,
    observabilityCoverageRate: reporting.observabilityCoverageRate,
    workerHealthScore: reporting.workerHealthScore,
    multiRegionReadinessScore: reporting.multiRegionReadinessScore,
    replayIntegrityScore: reporting.replayIntegrityScore,
  },
    combinedForecast,
    scorecards,
    commandCenterRecommendations,
    revenueRecommendations: intelligence.recommendations,
    drilldowns: drilldownsForOrg(d.overdueInvoiceCount),
    operationalReadiness: computeBlitzpayOperationalReadinessStrip({
      reportingForcedSkips: false,
      trialBalanceHealthy: reporting.trialBalanceHealthy,
      stripePayoutsEnabled,
      mobileSyncFailureRate: reporting.mobileSyncFailureRate,
      mobileTreasuryVisibilityScore: reporting.mobileTreasuryVisibilityScore,
      mobileSignatureCoverageRate: reporting.mobileSignatureCoverageRate,
      observabilityCoverageRate: reporting.observabilityCoverageRate,
      queueHealthScore: reporting.queueHealthScore,
      workflowFailureRate: reporting.workflowFailureRate,
      replayIntegrityScore: reporting.replayIntegrityScore,
    }),
    stripeLiveReadiness,
  }
}

