/**
 * Smoke tests for deterministic executive attention engine.
 * Run: pnpm test:blitzpay-executive-attention-engine
 */
import assert from "node:assert/strict"
import type { BlitzpayBusinessHealthPayload } from "../lib/blitzpay/blitzpay-business-health-types"
import { buildExecutiveAttentionPack, BLITZPAY_EXECUTIVE_ATTENTION_ENGINE_VERSION } from "../lib/blitzpay/blitzpay-executive-attention-engine"

function fixtureHealth(): BlitzpayBusinessHealthPayload {
  return {
    reportingWindowDays: 30,
    generatedAt: "2026-05-01T12:00:00.000Z",
    scores: {
      overall: 70,
      financial: 60,
      collections: 63,
      operationalEfficiency: 55,
      cashFlowPressure: 55,
      customerConcentrationRisk: 40,
      serviceProfitabilityConfidence: 60,
    },
    pipeline: { operationalLeakageNotes: ["Field closeout note — sample"], cashAccelerationOpportunities: ["Offer ACH on large balances"] },
    customerSignals: {
      likelyDepositBenefit: "low",
      likelyFinancingBenefit: "low",
      trustSignal: "mixed",
      riskSignal: "low",
      summaryLines: [],
    },
    recommendations: [],
    warnings: [],
    growthOpportunities: [],
    automationOpportunities: [],
    facts: {
      overdueCollectibleCents: 20_000_00,
      overdueInvoiceCount: 4,
      netCashPosition7Cents: 0,
      netCashPosition30Cents: -10_00,
      netCashPosition60Cents: 0,
      grossCollectedWindowCents: 100_000_00,
      openDisputesCount: 0,
      openDisputesAmountCents: 0,
      refundedVolumeWindowCents: 0,
      reminderEffectivenessRatePct: 50,
      recoveredRevenueCents: 0,
      treasuryAveragePayoutDelayDays: null,
      financingAdoptionSessions: 0,
      activeInstallmentPlansCount: 0,
      maintenancePlansCount: 0,
      technicianTopTwoRevenueSharePct: null,
      technicianInvoiceAttributionSample: 5,
      completedJobsTopTwoSharePct: null,
      completedJobsAttributionSample: 0,
      overdueConcentrationTopSharePct: 20,
      completedWoWithoutInvoiceSampleCount: 5,
      completedWoScanned: 20,
      fieldInvoiceLaterWindowCount: 0,
      estimatedRecoverableOverdueCents: 25_000_00,
      likelyFieldCollectibleCents: 0,
      achAccelerationOpportunityCents: 0,
      installmentConversionOpportunityCents: 0,
      technicianAssistedRecoveryRatePct: 0,
      reminderConversionRatePct: 0,
      fieldCollectionRecoveryRatePct: 0,
      workOrdersWithCollectibleBalancesCount: 2,
      recurringPlannedInflow30dCents: 10_000_00,
      recurringStabilityScore0to100: 40,
      autopayAdoptionPct: 20,
      renewalSuccessProxyPct: 70,
      churnRiskScore0to100: 60,
      projectedRenewalRevenue90dCents: 50_000_00,
      renewalRecoveryOpportunityCents: 0,
      autopayRiskExposureCents: 10_000_00,
      payrollPendingCommissionCents: 250_000_00,
      payrollLiabilityCents: 150_000_00,
      contractorSettlementExposureCents: 0,
      recurringRevenueSharePendingCents: 0,
      commissionVelocity7dCents: 0,
      estimatedOperatingCashCents: 0,
      cashReserveTargetCents: 0,
      cashReserveGapCents: 10_000_00,
      cashRunwayStatus: "watch",
      expectedInflows7dCents: 0,
      expectedInflows30dCents: 0,
      expectedOutflows7dCents: 0,
      expectedOutflows30dCents: 0,
      payrollReserveCoverageBasisPoints: 0,
      apReserveCoverageBasisPoints: 0,
      achFailedPaymentWindowCount: 3,
      apDue7OpenCents: 30_000_00,
      treasuryFailedPayoutCount30d: 2,
    },
  }
}

const health = fixtureHealth()

const solo = buildExecutiveAttentionPack({
  health,
  dataScope: "solo_lite",
  pendingApCount: 0,
  stripe: { connectAccountPresent: false, onboardingComplete: false, chargesEnabled: false },
})
assert.equal(solo.version, BLITZPAY_EXECUTIVE_ATTENTION_ENGINE_VERSION)
assert.ok(solo.alerts.length > 0)
assert.equal(solo.alerts.some((a) => a.signalId === "ach_failed_payments"), false)
assert.equal(solo.alerts.some((a) => a.id === "pending_vendor_approvals"), false)

const growth = buildExecutiveAttentionPack({
  health,
  dataScope: "growth_standard",
  pendingApCount: 2,
  stripe: { connectAccountPresent: true, onboardingComplete: true, chargesEnabled: true },
})
assert.ok(growth.alerts.some((a) => a.signalId === "ach_failed_payments"))
assert.ok(growth.alerts.some((a) => a.signalId === "treasury_failed_payouts"))
assert.ok(growth.alerts.some((a) => a.signalId === "payroll_pressure"))
assert.ok(growth.executiveBriefing.paragraph.length > 40)
assert.ok(growth.executiveBriefing.suggestedActions.length > 0)

console.log("blitzpay executive attention engine tests passed")
