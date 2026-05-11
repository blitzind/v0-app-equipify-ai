import type { MembershipHealthScore } from "@/lib/blitzpay/blitzpay-membership-health"

export type BlitzpayRecurringRevenueMetrics = {
  reportingWindowDays: number
  generatedAt: string
  recurringPlannedInflow7dCents: number
  recurringPlannedInflow30dCents: number
  recurringPlannedInflow90dCents: number
  annualizedRecurringRunRateProxyCents: number
  recurringMixOfCollectedWindowPct: number
  autopayAdoptionPct: number
  renewalSuccessProxyPct: number
  churnRiskScore0to100: number
  failedRenewalExposureCents: number
  maintenanceActiveCount: number
  maintenancePausedCount: number
  maintenanceExpiredCount: number
  maintenanceDueNext30dCount: number
  contractActiveCount: number
  contractSuspendedCount: number
  contractExpiring30dCount: number
  expiredContractDataRiskCount: number
  customersMissingAutopayWithActivePlans: number
  scheduledPendingCount: number
  scheduledFailedWindowCount: number
  recurringStabilityScore0to100: number
  projectedRenewalRevenue90dCents: number
  serviceAgreementUtilizationPct: number
  maintenanceCadenceUpliftCents: number
  treasuryConfidenceNote: string
}

export type BlitzpayRecurringRevenuePulsePayload = BlitzpayRecurringRevenueMetrics & {
  membershipHealthOrg: MembershipHealthScore
  retentionRecommendations: string[]
  workflowFlags: string[]
  atRiskCustomers: Array<{ customerId: string; band: string; score0to100: number }>
  failedRenewals: Array<{ invoiceId: string; customerId: string; portionCents: number; errorHint: string | null }>
  upcomingRenewals: Array<{ kind: "maintenance" | "contract"; refId: string; customerId: string | null; dueYmd: string }>
  recurringPaymentRecoveryQueue: Array<{ scheduleId: string; invoiceId: string; customerId: string; portionCents: number }>
}
