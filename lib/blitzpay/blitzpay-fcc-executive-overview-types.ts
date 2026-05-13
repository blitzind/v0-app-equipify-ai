import type { ExecutiveRecommendationSeverity } from "@/lib/blitzpay/blitzpay-executive-recommendations"

export type FccExecutiveHealthTone = "healthy" | "watch" | "risk"

export type FccExecutiveHealthCard = {
  id: string
  label: string
  score: number | null
  /** When null, score is omitted and subtitle is primary. */
  subtitle: string
  tone: FccExecutiveHealthTone
  /** BlitzPay section slug or "settings-payments" for configuration surface. */
  hrefKind: "fcc" | "settings"
  fccSlug?: string
}

export type FccExecutiveAttentionItem = {
  id: string
  severity: ExecutiveRecommendationSeverity
  message: string
  impactHint?: string
  hrefKind: "fcc" | "settings"
  fccSlug?: string
}

export type FccExecutiveTimelineItem = {
  occurredAt: string
  label: string
  category: "compliance" | "enterprise"
}

export type FccExecutiveMultiEntityStrip = {
  visibleGroupCount: number
  activeMemberOrgApprox: number
  franchiseHealthScore: number
  multiEntityRiskScore: number
  consolidatedCollectionsRate: number
  intercompanyBalanceExposureCents: number
  multiEntityTreasuryExposureCents: number
}

export type FccExecutiveOverviewPayload = {
  disclaimer: string
  reportingWindowDays: number
  generatedAt: string
  healthCards: FccExecutiveHealthCard[]
  attention: FccExecutiveAttentionItem[]
  cash: {
    runwayStatus: "healthy" | "watch" | "risk"
    operatingCashCents: number
    expectedInflows7dCents: number
    expectedInflows30dCents: number
    expectedOutflows7dCents: number
    expectedOutflows30dCents: number
    overdueCollectibleCents: number
    overdueInvoiceCount: number
    reserveGapCents: number
    reserveTargetCents: number
  }
  revenue: {
    recurringPlannedInflow30dCents: number
    recurringStabilityScore0to100: number
    autopayAdoptionPct: number
    renewalSuccessProxyPct: number
    churnRiskScore0to100: number
    projectedRenewalRevenue90dCents: number
  }
  collections: {
    reminderEffectivenessRatePct: number
    reminderConversionRatePct: number
    fieldCollectionRecoveryRatePct: number
    estimatedRecoverableOverdueCents: number
    workOrdersWithCollectibleBalancesCount: number
  }
  operationalNotes: string[]
  cashAccelerationNotes: string[]
  executiveBriefing: {
    paragraph: string
    opportunities: string[]
    risks: string[]
    suggestedActions: string[]
  }
  multiEntity: FccExecutiveMultiEntityStrip | null
  timeline: FccExecutiveTimelineItem[]
  stripe: {
    chargesEnabled: boolean
    payoutsEnabled: boolean
    onboardingComplete: boolean
    detailsSubmitted: boolean
    connectStatus: string | null
  }
}

/** Shown in FCC chrome and echoed in API payloads. */
export const BLITZPAY_FCC_FUNDS_DISCLAIMER =
  "BlitzPay is orchestration and advisory. Stripe and your bank remain the source of truth for settled funds, payouts, and official balances."
