export type CollectionLikelihood = "low" | "medium" | "high"
export type CollectionChannel = "sms" | "email" | "hosted_pay" | "field" | "office" | "pause"
export type RecoveryWindowBand = "1-3d" | "4-7d" | "8-14d" | "15+d" | "uncertain"

export type CollectionsPriorityQueueItem = {
  invoiceId: string
  customerId: string | null
  balanceDueCents: number
  daysPastDue: number
  urgencyScore: number
  collectionLikelihood: CollectionLikelihood
  recommendedAction: string
  recommendedChannel: CollectionChannel
  expectedRecoveryWindow: RecoveryWindowBand
  riskFlags: string[]
}

export type TechnicianCollectionRow = {
  rank: number
  displayName: string
  windowCollectedCents: number
  attributedInvoiceSample: number
}

export type CustomerBehaviorSegment = {
  segment: "reminder_responsive" | "financing_candidate" | "ach_candidate" | "wallet_credit" | "stable"
  countApprox: number
  note: string
}

export type CollectionsCopilotRecoveryForecast = {
  estimatedRecoverableOverdueCents: number
  likelyFieldCollectibleCents: number
  next14dScheduledFieldOpportunityCents: number
}

export type BlitzpayCollectionsCopilotPayload = {
  reportingWindowDays: number
  generatedAt: string
  priorityQueue: CollectionsPriorityQueueItem[]
  overdueSummary: {
    overdueInvoiceCount: number
    overdueCollectibleCents: number
    abandonedCheckoutInvoices: number
  }
  technicianCollections: {
    leaderboard: TechnicianCollectionRow[]
    fieldCollectionRecoveryRatePct: number
    workOrdersWithCollectibleBalancesCount: number
  }
  customerBehaviorSegments: CustomerBehaviorSegment[]
  customerPaymentBehaviorProfile: {
    averageDaysToPayWhenPaid: number | null
    latePaymentRatePct: number
    achVsCardHint: "ach_heavy" | "card_heavy" | "mixed" | "unknown"
    installmentUsageLevel: "low" | "medium" | "high"
    depositUsageLevel: "low" | "medium" | "high"
    responsivenessScore: number
    disputeRefundPressure: "low" | "medium" | "high"
  }
  recommendations: Array<{ id: string; severity: "info" | "warning"; message: string }>
  recoveryForecasts: CollectionsCopilotRecoveryForecast
  automationInsights: Array<{ id: string; severity: "info" | "warning"; message: string }>
  acceleration: {
    estimatedRecoverableOverdueCents: number
    likelyFieldCollectibleCents: number
    achAccelerationOpportunityCents: number
    installmentConversionOpportunityCents: number
    technicianAssistedRecoveryRatePct: number
    reminderConversionRatePct: number
  }
}
