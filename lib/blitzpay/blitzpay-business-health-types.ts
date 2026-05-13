import type { ExecutiveRecommendation } from "@/lib/blitzpay/blitzpay-executive-recommendations"

export type BlitzpayBusinessHealthScores = {
  overall: number
  financial: number
  collections: number
  operationalEfficiency: number
  cashFlowPressure: number
  customerConcentrationRisk: number
  serviceProfitabilityConfidence: number
}

export type PaymentBehaviorBand = "low" | "medium" | "high"
export type PaymentTrustSignal = "limited_data" | "mixed" | "generally_on_time"

export type BlitzpayBusinessHealthPayload = {
  reportingWindowDays: number
  generatedAt: string
  scores: BlitzpayBusinessHealthScores
  pipeline: {
    operationalLeakageNotes: string[]
    cashAccelerationOpportunities: string[]
  }
  customerSignals: {
    likelyDepositBenefit: PaymentBehaviorBand
    likelyFinancingBenefit: PaymentBehaviorBand
    trustSignal: PaymentTrustSignal
    riskSignal: PaymentBehaviorBand
    summaryLines: string[]
  }
  recommendations: ExecutiveRecommendation[]
  warnings: string[]
  growthOpportunities: string[]
  automationOpportunities: string[]
  facts: {
    overdueCollectibleCents: number
    overdueInvoiceCount: number
    netCashPosition7Cents: number
    netCashPosition30Cents: number
    netCashPosition60Cents: number
    grossCollectedWindowCents: number
    openDisputesCount: number
    openDisputesAmountCents: number
    refundedVolumeWindowCents: number
    reminderEffectivenessRatePct: number
    recoveredRevenueCents: number
    treasuryAveragePayoutDelayDays: number | null
    financingAdoptionSessions: number
    activeInstallmentPlansCount: number
    maintenancePlansCount: number
    technicianTopTwoRevenueSharePct: number | null
    technicianInvoiceAttributionSample: number
    completedJobsTopTwoSharePct: number | null
    completedJobsAttributionSample: number
    overdueConcentrationTopSharePct: number
    completedWoWithoutInvoiceSampleCount: number
    completedWoScanned: number
    fieldInvoiceLaterWindowCount: number
    /** Phase 2V — collections acceleration (from revenue intelligence / reporting). */
    estimatedRecoverableOverdueCents: number
    likelyFieldCollectibleCents: number
    achAccelerationOpportunityCents: number
    installmentConversionOpportunityCents: number
    technicianAssistedRecoveryRatePct: number
    reminderConversionRatePct: number
    fieldCollectionRecoveryRatePct: number
    workOrdersWithCollectibleBalancesCount: number
    /** Phase 2W — recurring revenue / renewal stability (bounded). */
    recurringPlannedInflow30dCents: number
    recurringStabilityScore0to100: number
    autopayAdoptionPct: number
    renewalSuccessProxyPct: number
    churnRiskScore0to100: number
    projectedRenewalRevenue90dCents: number
    renewalRecoveryOpportunityCents: number
    autopayRiskExposureCents: number
    /** Phase 2Y */
    payrollPendingCommissionCents: number
    payrollLiabilityCents: number
    contractorSettlementExposureCents: number
    recurringRevenueSharePendingCents: number
    commissionVelocity7dCents: number
    /** Phase 2Z */
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
    /** Reporting-window ACH payment attempts marked failed (bounded snapshot). */
    achFailedPaymentWindowCount: number
    /** Open vendor payables due within 7 days (internal AP mirror). */
    apDue7OpenCents: number
    /** Stripe treasury mirror — failed payout rows in last 30d (when synced). */
    treasuryFailedPayoutCount30d: number
  }
}
