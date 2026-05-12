/**
 * BlitzPay Phase 5B — supplier / vendor network foundations (deterministic helpers + route presence).
 * Run: pnpm test:blitzpay-phase-5b-supplier-network
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { hashBlitzpaySupplierNetworkAudit } from "../lib/blitzpay/blitzpay-supplier-network-audit"
import {
  averageProcurementBenchmarkScore0to100,
  mergePhase5bFromAggregateContext,
  procurementBenchmarkFromLocalSnapshot0to100,
  zeroPhase5bReportingExtension,
} from "../lib/blitzpay/blitzpay-procurement-benchmarks"
import {
  sumActiveBulkPurchaseSavingsCents,
  sumActiveBulkPurchaseVolumeCents,
  sumPreferredPricingOpportunityCents,
} from "../lib/blitzpay/blitzpay-bulk-purchasing"
import { averageOverallScoresDeterministic, computeSupplierOverallScore0to100 } from "../lib/blitzpay/blitzpay-vendor-performance"
import type { BlitzpayOrgReportingSnapshot } from "../lib/blitzpay/blitzpay-reporting-snapshot"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

const snap = (partial: Partial<BlitzpayOrgReportingSnapshot>): BlitzpayOrgReportingSnapshot =>
  ({
    sinceIso: null,
    grossProcessedVolumeCents: 0,
    estimateDepositCapturedCents: 0,
    invoiceStylePaymentCapturedCents: 0,
    refundedVolumeCents: 0,
    netCollectedCents: 0,
    convenienceFeeCollectedCents: 0,
    estimatedStripeFeesCents: 0,
    refundedFeesCents: 0,
    estimatedNetMerchantPayoutCents: 0,
    reportingSource: "estimate",
    paidOutToBankCents: 0,
    connectedAccountNetActivityCents: null,
    onlinePaymentCount: 0,
    paymentSourceSplit: { customer_portal: 0, staff_dashboard: 0 },
    paymentMethodMix: { card: 0, us_bank_account: 0, unknown: 0 },
    achSettlement: { pending: 0, settled: 0, failed: 0 },
    quotesWithBlitzpayDepositCollected: 0,
    financingReadyQuotesCount: 0,
    customerWalletSpendableCreditTotalCents: 0,
    customerWalletRefundableCreditTotalCents: 0,
    customerUnappliedEstimateDepositTotalCents: 0,
    customerWalletAppliedToInvoicesWindowCents: 0,
    customerWalletCreditInflowWindowCents: 0,
    blitzpayActivePaymentPlansCount: 0,
    blitzpayPaymentPlanInstallmentsPaidCentsTotal: 0,
    blitzpayFinancingSessionsTotal: 0,
    blitzpayFinancingSessionsFundedOrReleasedCount: 0,
    blitzpayFinancingSessionsCreatedWindowCount: 0,
    estimateDepositBeforeWorkQuoteCount: 0,
    estimateOpenQuotesWithTotalCount: 0,
    blitzpayWorkOrderCollectPaymentLinksWindowCount: 0,
    workOrdersFieldInvoiceLaterWindowCount: 0,
    treasuryAveragePayoutDelayDays: null,
    treasuryPendingPayoutTotalsCents: 0,
    treasuryFailedPayoutCount30d: 0,
    treasuryInstantTransferEligible: false,
    treasuryReserveExposureCents: 0,
    treasuryPayoutVelocityPaidCents7d: 0,
    treasuryPayoutVelocityPaidCents30d: 0,
    treasuryEstimateUpcomingTransferCents: 0,
    treasuryPayoutSpeedLane: "unknown",
    apOpenOutstandingCents: 0,
    apDue7OpenCents: 0,
    apDue30OpenCents: 0,
    apDue60OpenCents: 0,
    apVendorInternalVelocity7dCents: 0,
    apProjectedOutgoingCents7d: 0,
    estimatedRecoverableOverdueCents: 0,
    likelyFieldCollectibleCents: 0,
    achAccelerationOpportunityCents: 0,
    installmentConversionOpportunityCents: 0,
    technicianAssistedRecoveryRatePct: 0,
    reminderConversionRatePct: 0,
    fieldCollectionRecoveryRatePct: 0,
    workOrdersWithCollectibleBalancesCount: 0,
    blitzpayRecurringPlannedInflow30dCents: 0,
    blitzpayRecurringPlannedInflow90dCents: 0,
    blitzpayAnnualizedRecurringRunRateProxyCents: 0,
    blitzpayRecurringMixOfWindowPct: 0,
    blitzpayAutopayAdoptionPct: 0,
    blitzpayRenewalSuccessProxyPct: 0,
    blitzpayChurnRiskScore0to100: 0,
    blitzpayRecurringStabilityScore0to100: 0,
    blitzpayProjectedRenewalRevenue90dCents: 0,
    blitzpayRenewalRecoveryOpportunityCents: 0,
    blitzpayAutopayRiskExposureCents: 0,
    recurringRevenueCents: 0,
    annualRecurringRevenueCents: 0,
    delinquentMembershipRevenueCents: 0,
    renewalPipelineCents: 0,
    recoveredMembershipRevenueCents: 0,
    membershipAutoPayAdoptionBasisPoints: 0,
    churnRiskRevenueCents: 0,
    payrollPendingCommissionCents: 0,
    payrollLiabilityCents: 0,
    contractorSettlementExposureCents: 0,
    recurringRevenueSharePendingCents: 0,
    estimatedPayrollBurdenCents: 0,
    commissionVelocity7dCents: 0,
    recurringMemberPayoutStability0to100: 0,
    openDisputesAmountCents: 0,
    estimatedOperatingCashCents: 0,
    cashReserveTargetCents: 0,
    cashReserveGapCents: 0,
    expectedInflows7dCents: 0,
    expectedInflows30dCents: 0,
    expectedOutflows7dCents: 0,
    expectedOutflows30dCents: 0,
    cashRunwayStatus: "healthy",
    payrollReserveCoverageBasisPoints: 0,
    apReserveCoverageBasisPoints: 0,
    autopayEnrollmentRate: 0,
    savedPaymentMethodRate: 0,
    billingReadinessRate: 0,
    delinquencyRiskRate: 0,
    collectionSuccessRate: 0,
    retryRecoveryRate: 0,
    failedPaymentRate: 0,
    delinquencyRate: 0,
    recoveryFlowCompletionRate: 0,
    averageRecoveryDurationDays: 0,
    totalAssetsCents: 0,
    totalLiabilitiesCents: 0,
    totalEquityCents: 0,
    deferredRevenueCents: 0,
    accountsReceivableCents: 0,
    accountsPayableCents: 0,
    glPayrollLiabilityCents: 0,
    trialBalanceHealthy: true,
    unreconciledBatchCount: 0,
    pendingRevenueRecognitionCount: 0,
    accountsPayableOutstandingCents: 0,
    approvedBillsAwaitingPaymentCents: 0,
    overdueVendorBillsCents: 0,
    averageVendorPaymentDays: null,
    vendorConcentrationRisk: 0,
    treasuryCoverageForPayables: 0,
    payableAgingHealthScore: 0,
    salesTaxPayableCents: 0,
    payrollTaxPayableCents: 0,
    contractorTaxEstimateCents: 0,
    convenienceFeeExposureRisk: 0,
    achAuthorizationCoverageRate: 0,
    vendor1099ReadinessRate: 0,
    filingReadinessScore: 0,
    complianceHealthScore: 0,
    financingApplicationApprovalRate: 0,
    averageApprovedFinancingAmount: 0,
    financingMarketplaceCoverage: 0,
    contractorAdvanceExposure: 0,
    financingRevenueOpportunity: 0,
    financingRiskScore: 0,
    financingConversionRate: 0,
    financingTreasuryImpactScore: 0,
    totalInventoryValueCents: 0,
    inventoryWriteoffExposure: 0,
    inventoryTurnoverScore: 0,
    reorderExposureCents: 0,
    rebateOpportunityCents: 0,
    serializedAssetExposure: 0,
    procurementTreasuryImpactScore: 0,
    inventoryMarginHealthScore: 0,
    aiFinancialRiskScore: 0,
    treasuryPressureScore: 0,
    marginRiskScore: 0,
    collectionsOptimizationScore: 0,
    payrollPressureScore: 0,
    procurementEfficiencyScore: 0,
    vendorConcentrationRiskScore: 0,
    aiInsightCoverageRate: 0,
    revenueOptimizationScore: 0,
    estimatedRevenueOpportunityCents: 0,
    paymentBehaviorCoverageRate: 0,
    churnPreventionOpportunityCount: 0,
    achNudgeOpportunityCount: 0,
    renewalOptimizationOpportunityCount: 0,
    technicianCoachingOpportunityCount: 0,
    optimizationExperimentCount: 0,
    multiEntityRevenueExposure: 0,
    multiEntityTreasuryExposure: 0,
    intercompanyBalanceExposure: 0,
    consolidatedCollectionsRate: 0,
    franchiseHealthScore: 0,
    sharedBenchmarkCoverage: 0,
    multiEntityRiskScore: 0,
    consolidatedOrganizationCount: 0,
    supplierNetworkParticipationScore: 0,
    procurementBenchmarkScore: 0,
    preferredPricingOpportunityCents: 0,
    bulkPurchaseOpportunityCents: 0,
    supplierPerformanceHealthScore: 0,
    rebateCaptureOpportunityScore: 0,
    vendorFinancingOpportunityScore: 0,
    supplierNetworkCoverageRate: 0,
    warrantyReserveExposure: 0,
    claimsExposureCents: 0,
    claimsReserveCoverageScore: 0,
    protectionPlanRecurringRevenue: 0,
    stormEventTreasuryPressure: 0,
    contractorProtectionHealthScore: 0,
    claimsPayoutExposure: 0,
    protectionPlanCoverageRate: 0,
    mobileFinancialIntentCount: 0,
    offlineFinancialIntentCount: 0,
    mobileSyncFailureRate: 0,
    mobileSignatureCoverageRate: 0,
    mobilePayrollApprovalPendingCount: 0,
    fieldCollectionsIntentCents: 0,
    mobileTreasuryVisibilityScore: 0,
    mobileConflictReviewCount: 0,
    queueHealthScore: 100,
    workflowFailureRate: 0,
    idempotencyConflictRate: 0,
    replayPendingCount: 0,
    observabilityCoverageRate: 0,
    workerHealthScore: 100,
    multiRegionReadinessScore: 100,
    replayIntegrityScore: 0,
    ...partial,
  }) as BlitzpayOrgReportingSnapshot

const z = zeroPhase5bReportingExtension()
assert.equal(z.supplierNetworkParticipationScore, 0)

assert.equal(
  averageProcurementBenchmarkScore0to100([
    { benchmark_score: 40, benchmark_type: "z" },
    { benchmark_score: 60, benchmark_type: "a" },
  ]),
  50,
)

const localBench = procurementBenchmarkFromLocalSnapshot0to100({
  procurementTreasuryImpactScore: 30,
  inventoryTurnoverScore: 60,
  inventoryMarginHealthScore: 90,
})
assert.equal(localBench, 60)

const merged = mergePhase5bFromAggregateContext(
  snap({
    rebateOpportunityCents: 50_000,
    totalInventoryValueCents: 1_000_000,
    procurementTreasuryImpactScore: 70,
    inventoryTurnoverScore: 70,
    inventoryMarginHealthScore: 70,
    reorderExposureCents: 0,
  }),
  {
    visibleNetworkCount: 2,
    activeMembershipRows: 1,
    benchmarkRows: [{ benchmark_score: 80, benchmark_type: "procurement_cost" }],
    preferredPricingOpportunityCents: 1_000,
    bulkPurchaseOpportunityCents: 2_000,
    supplierPerformanceAvg0to100: 75,
    vendorFinancingCapacityCentsSum: 500_000,
  },
)
assert.equal(merged.procurementBenchmarkScore, 80)
assert.equal(merged.preferredPricingOpportunityCents, 1_000)
assert.equal(merged.bulkPurchaseOpportunityCents, 2_000)
assert.ok(merged.supplierNetworkParticipationScore > 0)

assert.equal(
  sumPreferredPricingOpportunityCents([
    { id: "b", program_status: "active", estimated_savings_basis_points: 100, minimum_volume_cents: 10_000 },
    { id: "a", program_status: "active", estimated_savings_basis_points: 100, minimum_volume_cents: 10_000 },
  ]),
  200,
)

assert.equal(
  sumActiveBulkPurchaseSavingsCents([
    { id: "y", opportunity_status: "active", estimated_savings_cents: 100 },
    { id: "x", opportunity_status: "expired", estimated_savings_cents: 999 },
  ]),
  100,
)

assert.equal(
  sumActiveBulkPurchaseVolumeCents([
    { id: "a", opportunity_status: "active", estimated_total_volume_cents: 50 },
    { id: "b", opportunity_status: "active", estimated_total_volume_cents: 50 },
  ]),
  100,
)

assert.equal(computeSupplierOverallScore0to100({ fulfillment_score: 80, pricing_score: null, rebate_score: 40, delivery_score: null, support_score: null }), 60)
assert.equal(averageOverallScoresDeterministic([{ vendor_id: "b", overall_score: 40 }, { vendor_id: "a", overall_score: 60 }]), 50)

const h1 = hashBlitzpaySupplierNetworkAudit({
  audit_type: "network_created",
  supplier_network_id: null,
  organization_id: "11111111-1111-4111-8111-111111111111",
  audit_summary: "test",
  actor_type: "system",
  actor_id: null,
  metadata: { a: 1 },
})
const h2 = hashBlitzpaySupplierNetworkAudit({
  audit_type: "network_created",
  supplier_network_id: null,
  organization_id: "11111111-1111-4111-8111-111111111111",
  audit_summary: "test",
  actor_type: "system",
  actor_id: null,
  metadata: { a: 1 },
})
assert.equal(h1, h2)
assert.equal(h1.length, 64)

const orgIds = ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"].sort((a, b) => a.localeCompare(b))
assert.deepEqual(orgIds, ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"])

const routePaths = [
  "organizations/[organizationId]/blitzpay/supplier-network/networks/route.ts",
  "organizations/[organizationId]/blitzpay/supplier-network/members/route.ts",
  "organizations/[organizationId]/blitzpay/supplier-network/preferred-programs/route.ts",
  "organizations/[organizationId]/blitzpay/supplier-network/bulk-opportunities/route.ts",
  "organizations/[organizationId]/blitzpay/supplier-network/vendor-performance/route.ts",
  "organizations/[organizationId]/blitzpay/supplier-network/benchmarks/route.ts",
  "organizations/[organizationId]/blitzpay/supplier-network/health/route.ts",
]
for (const p of routePaths) {
  const src = read(path.join("app/api", p))
  assert.ok(src.includes("requireAnyOrgPermission"), p)
  assert.ok(src.includes("blitzpaySchemaGuardNextResponse"), p)
}

const schema = read("lib/blitzpay/blitzpay-schema-health.ts")
assert.ok(schema.includes("blitzpay_supplier_networks"))
assert.ok(schema.includes("blitzpay_shared_procurement_benchmarks"))

console.log("blitzpay phase 5b supplier network tests ok")
