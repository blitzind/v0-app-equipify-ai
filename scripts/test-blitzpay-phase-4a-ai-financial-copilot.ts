/**
 * BlitzPay Phase 4A — AI financial copilot (deterministic helpers + static guards).
 * Run: pnpm test:blitzpay-phase-4a-ai-financial-copilot
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { buildAiAuditImmutableHash, composeBlitzpayAiPrioritizedInsights } from "../lib/blitzpay/blitzpay-ai-financial-copilot"
import { detectBlitzpayFinancialAnomalies } from "../lib/blitzpay/blitzpay-ai-anomaly-detection"
import { buildBlitzpayAiForecastSnapshots } from "../lib/blitzpay/blitzpay-ai-forecasting"
import {
  buildExecutiveFinancialSummaryLines,
  compareInsightsDeterministic,
  sortInsightsDeterministic,
} from "../lib/blitzpay/blitzpay-ai-recommendations"
import {
  computeAiFinancialRiskScore0to100,
  computeBlitzpayPhase4aReportingScores,
  computeCollectionsOptimizationScore0to100,
  computeTreasuryPressureScore0to100,
} from "../lib/blitzpay/blitzpay-ai-snapshot-scores"
import type { BlitzpayOrgReportingSnapshot } from "../lib/blitzpay/blitzpay-reporting-snapshot"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function readUtf8(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

const baseReporting = (): BlitzpayOrgReportingSnapshot =>
  ({
    sinceIso: null,
    grossProcessedVolumeCents: 0,
    estimateDepositCapturedCents: 0,
    invoiceStylePaymentCapturedCents: 0,
    refundedVolumeCents: 0,
    netCollectedCents: 100_000,
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
    estimatedRecoverableOverdueCents: 50_000,
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
    blitzpayChurnRiskScore0to100: 40,
    blitzpayRecurringStabilityScore0to100: 0,
    blitzpayProjectedRenewalRevenue90dCents: 0,
    blitzpayRenewalRecoveryOpportunityCents: 0,
    blitzpayAutopayRiskExposureCents: 0,
    recurringRevenueCents: 0,
    annualRecurringRevenueCents: 0,
    delinquentMembershipRevenueCents: 0,
    renewalPipelineCents: 10_000,
    recoveredMembershipRevenueCents: 0,
    membershipAutoPayAdoptionBasisPoints: 0,
    churnRiskRevenueCents: 0,
    payrollPendingCommissionCents: 0,
    payrollLiabilityCents: 20_000,
    contractorSettlementExposureCents: 0,
    recurringRevenueSharePendingCents: 0,
    estimatedPayrollBurdenCents: 5000,
    commissionVelocity7dCents: 0,
    recurringMemberPayoutStability0to100: 0,
    openDisputesAmountCents: 0,
    estimatedOperatingCashCents: 80_000,
    cashReserveTargetCents: 0,
    cashReserveGapCents: 10_000,
    expectedInflows7dCents: 5000,
    expectedInflows30dCents: 40_000,
    expectedOutflows7dCents: 10_000,
    expectedOutflows30dCents: 55_000,
    cashRunwayStatus: "watch",
    payrollReserveCoverageBasisPoints: 0,
    apReserveCoverageBasisPoints: 0,
    autopayEnrollmentRate: 0,
    savedPaymentMethodRate: 0,
    billingReadinessRate: 0,
    delinquencyRiskRate: 0,
    collectionSuccessRate: 70,
    retryRecoveryRate: 0,
    failedPaymentRate: 15,
    delinquencyRate: 10,
    recoveryFlowCompletionRate: 0,
    averageRecoveryDurationDays: 0,
    totalAssetsCents: 0,
    totalLiabilitiesCents: 0,
    totalEquityCents: 0,
    deferredRevenueCents: 0,
    accountsReceivableCents: 100_000,
    accountsPayableCents: 0,
    glPayrollLiabilityCents: 0,
    trialBalanceHealthy: true,
    unreconciledBatchCount: 0,
    pendingRevenueRecognitionCount: 0,
    accountsPayableOutstandingCents: 0,
    approvedBillsAwaitingPaymentCents: 0,
    overdueVendorBillsCents: 0,
    averageVendorPaymentDays: null,
    vendorConcentrationRisk: 65,
    treasuryCoverageForPayables: 0,
    payableAgingHealthScore: 60,
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
    financingRiskScore: 30,
    financingConversionRate: 0,
    financingTreasuryImpactScore: 0,
    totalInventoryValueCents: 0,
    inventoryWriteoffExposure: 0,
    inventoryTurnoverScore: 50,
    reorderExposureCents: 20_000,
    rebateOpportunityCents: 0,
    serializedAssetExposure: 0,
    procurementTreasuryImpactScore: 40,
    inventoryMarginHealthScore: 55,
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
  }) as BlitzpayOrgReportingSnapshot

// --- Phase 4a scores ---
const m = {
  cashRunwayStatus: "watch" as const,
  cashReserveGapCents: 10_000,
  estimatedOperatingCashCents: 80_000,
  expectedInflows7dCents: 5000,
  expectedInflows30dCents: 40_000,
  expectedOutflows30dCents: 55_000,
  treasuryFailedPayoutCount30d: 2,
  treasuryPendingPayoutTotalsCents: 5000,
  treasuryEstimateUpcomingTransferCents: 5000,
  inventoryMarginHealthScore: 55,
  failedPaymentRate: 15,
  delinquencyRate: 10,
  collectionSuccessRate: 70,
  estimatedRecoverableOverdueCents: 50_000,
  accountsReceivableCents: 100_000,
  payrollLiabilityCents: 20_000,
  estimatedPayrollBurdenCents: 5000,
  procurementTreasuryImpactScore: 40,
  payableAgingHealthScore: 60,
  inventoryTurnoverScore: 50,
  vendorConcentrationRisk: 65,
  trialBalanceHealthy: true,
  unreconciledBatchCount: 0,
  openDisputesAmountCents: 2000,
  netCollectedCents: 100_000,
  blitzpayChurnRiskScore0to100: 40,
  financingRiskScore: 30,
}
const tp = computeTreasuryPressureScore0to100(m)
assert.ok(tp >= 20 && tp <= 100)
const co = computeCollectionsOptimizationScore0to100(m)
assert.ok(co >= 0 && co <= 100)
const p4 = computeBlitzpayPhase4aReportingScores(m)
assert.equal(typeof p4.aiFinancialRiskScore, "number")
const air = computeAiFinancialRiskScore0to100({
  treasuryPressureScore: 60,
  marginRiskScore: 40,
  collectionsOptimizationScore: 50,
  payrollPressureScore: 30,
  vendorConcentrationRiskScore: 70,
  procurementStressScore: 35,
  financingRiskScore: 40,
  churnRisk: 50,
})
assert.equal(air, 70)

// --- Anomalies ---
const r = baseReporting()
const anomalies = detectBlitzpayFinancialAnomalies(r)
assert.ok(Array.isArray(anomalies))

// --- Forecasts ---
const fc = buildBlitzpayAiForecastSnapshots(r, 30)
assert.equal(fc.length, 7)

// --- Executive summary ---
const ex = buildExecutiveFinancialSummaryLines(r, p4)
assert.ok(ex.bullets.length >= 3)

// --- Insight ordering ---
const insights = composeBlitzpayAiPrioritizedInsights(r)
assert.ok(insights.length >= 1)
const sorted = sortInsightsDeterministic([...insights].reverse())
assert.equal(sorted[0]?.insight_type, [...insights].sort(compareInsightsDeterministic)[0]?.insight_type)

// --- Audit hash stable ---
const h1 = buildAiAuditImmutableHash({ a: 1, z: 2, t: "x" })
const h2 = buildAiAuditImmutableHash({ z: 2, a: 1, t: "x" })
assert.equal(h1, h2)

// --- Migration ---
const mig = readUtf8("supabase/migrations/20261116120000_blitzpay_phase_4a_ai_financial_copilot.sql")
assert.match(mig, /blitzpay_ai_audit_block_mutation/)
assert.match(mig, /blitzpay_ai_financial_insights/)

// --- API gates ---
for (const rel of [
  "app/api/organizations/[organizationId]/blitzpay/ai/insights/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ai/forecasts/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ai/recommendations/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ai/executive-summary/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ai/health/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ai/insights/[insightId]/dismiss/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ai/recommendations/[recommendationId]/acknowledge/route.ts",
  "app/api/organizations/[organizationId]/blitzpay/ai/recommendations/[recommendationId]/complete/route.ts",
]) {
  const src = readUtf8(rel)
  assert.match(src, /requireAnyOrgPermission/)
  assert.match(src, /blitzpaySchemaGuardNextResponse/)
}

// --- Schema health lists new tables ---
const schemaSrc = readUtf8("lib/blitzpay/blitzpay-schema-health.ts")
assert.match(schemaSrc, /blitzpay_ai_financial_insights/)
assert.match(schemaSrc, /blitzpay_ai_audit_log/)

console.log("blitzpay phase 4a ai financial copilot tests passed")
