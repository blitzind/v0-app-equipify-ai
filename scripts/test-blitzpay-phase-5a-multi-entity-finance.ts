/**
 * BlitzPay Phase 5A — multi-entity / franchise finance foundations (deterministic helpers + route guards).
 * Run: pnpm test:blitzpay-phase-5a-multi-entity-finance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { mergePhase5aFromSnapshotsAndIntercompany, zeroPhase5aOrgReportingExtension } from "../lib/blitzpay/blitzpay-consolidated-reporting"
import {
  rollupPayrollExposureCentsFromSnapshots,
  rollupProcurementInventoryCentsFromSnapshots,
  rollupTreasuryExposureCentsFromSnapshots,
  sortIntercompanyBalancesDeterministic,
  sumActiveIntercompanyExposureCents,
} from "../lib/blitzpay/blitzpay-intercompany-balances"
import { hashBlitzpayMultiEntityAudit } from "../lib/blitzpay/blitzpay-multi-entity-audit"
import { computeSharedBenchmarkCoverage0to100 } from "../lib/blitzpay/blitzpay-shared-benchmarks"
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
    ...partial,
  }) as BlitzpayOrgReportingSnapshot

const z = zeroPhase5aOrgReportingExtension()
assert.equal(z.multiEntityRevenueExposureCents, 0)

const a = snap({
  churnRiskRevenueCents: 1000,
  openDisputesAmountCents: 500,
  treasuryReserveExposureCents: 2000,
  treasuryPendingPayoutTotalsCents: 300,
  collectionSuccessRate: 80,
  aiFinancialRiskScore: 40,
  collectionsOptimizationScore: 60,
})
const b = snap({
  churnRiskRevenueCents: 200,
  collectionSuccessRate: 60,
  aiFinancialRiskScore: 60,
  collectionsOptimizationScore: 40,
})
const merged = mergePhase5aFromSnapshotsAndIntercompany([b, a], [{ balance_amount_cents: 1000, balance_status: "active" }], 2)
assert.equal(merged.consolidatedOrganizationCount, 2)
assert.equal(merged.intercompanyBalanceExposureCents, 1000)
assert.ok(merged.multiEntityTreasuryExposureCents > 0)

const treasuryRoll = rollupTreasuryExposureCentsFromSnapshots([a, b])
assert.ok(treasuryRoll >= 2300)
const payrollRoll = rollupPayrollExposureCentsFromSnapshots([snap({ payrollLiabilityCents: 100, estimatedPayrollBurdenCents: 50 })])
assert.equal(payrollRoll, 150)
const invRoll = rollupProcurementInventoryCentsFromSnapshots([snap({ totalInventoryValueCents: 1000, reorderExposureCents: 200 })])
assert.equal(invRoll, 1200)

const sorted = sortIntercompanyBalancesDeterministic([
  { balance_amount_cents: 1, balance_status: "active", financial_group_id: "b", id: "2" },
  { balance_amount_cents: 1, balance_status: "active", financial_group_id: "a", id: "1" },
])
assert.equal(sorted[0]?.financial_group_id, "a")

const sumIc = sumActiveIntercompanyExposureCents([
  { balance_amount_cents: 100, balance_status: "active" },
  { balance_amount_cents: 50, balance_status: "settled" },
])
assert.equal(sumIc, 100)

const cov = computeSharedBenchmarkCoverage0to100([
  snap({ collectionSuccessRate: 10, payrollPressureScore: 0, annualRecurringRevenueCents: 0, financingRiskScore: 0, procurementEfficiencyScore: 0, totalInventoryValueCents: 0, treasuryPressureScore: 0, netCollectedCents: 0 }),
])
assert.ok(cov >= 10 && cov <= 100)

const h1 = hashBlitzpayMultiEntityAudit({ a: 1, b: "x" })
const h2 = hashBlitzpayMultiEntityAudit({ b: "x", a: 1 })
assert.equal(h1, h2)
assert.equal(h1.length, 64)

const routes = [
  "app/api/organizations/[organizationId]/blitzpay/multi-entity/groups/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/multi-entity/group-members/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/multi-entity/intercompany-balances/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/multi-entity/consolidated-snapshots/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/multi-entity/benchmarks/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/multi-entity/health/route.ts",
]
for (const r of routes) {
  const src = read(r)
  assert.match(src, /blitzpaySchemaGuardNextResponse/)
  assert.match(src, /requireAnyOrgPermission/)
}

const schema = read("lib/blitzpay/blitzpay-schema-health.ts")
assert.match(schema, /blitzpay_financial_groups/)
assert.match(schema, /blitzpay_multi_entity_audit_log/)

const migration = read("supabase/migrations/20261118120000_blitzpay_phase_5a_multi_entity_finance.sql")
assert.match(migration, /blitzpay_multi_entity_audit_block_mutation/)

console.log("blitzpay phase 5a multi-entity finance tests passed")
