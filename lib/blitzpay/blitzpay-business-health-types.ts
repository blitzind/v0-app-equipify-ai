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
  }
}
