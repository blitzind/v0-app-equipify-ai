/**
 * Deterministic membership / agreement health scoring (Phase 2W). Pure rules — no LLM.
 */

export type MembershipHealthBand = "stable" | "at_risk" | "payment_risk" | "engagement_risk" | "renewal_risk"

export type MembershipHealthScore = {
  band: MembershipHealthBand
  score0to100: number
  drivers: string[]
}

export function scoreMembershipHealthFromSignals(args: {
  failedScheduledWindowCount: number
  overdueOpenInvoiceCountForCohort: number
  activeMaintenanceWithoutAutopay: boolean
  contractExpiring30d: boolean
  financingHeavy: boolean
  disputePressure: boolean
}): MembershipHealthScore {
  let score = 78
  const drivers: string[] = []

  if (args.failedScheduledWindowCount > 0) {
    score -= 12 + Math.min(18, args.failedScheduledWindowCount * 6)
    drivers.push("scheduled_autopay_failures")
  }
  if (args.overdueOpenInvoiceCountForCohort > 0) {
    score -= 8 + Math.min(20, args.overdueOpenInvoiceCountForCohort * 4)
    drivers.push("overdue_open_invoices")
  }
  if (args.activeMaintenanceWithoutAutopay) {
    score -= 10
    drivers.push("active_service_plan_without_autopay")
  }
  if (args.contractExpiring30d) {
    score -= 6
    drivers.push("service_agreement_renewal_window")
  }
  if (args.financingHeavy) {
    score -= 5
    drivers.push("financing_usage_elevated")
  }
  if (args.disputePressure) {
    score -= 8
    drivers.push("dispute_or_refund_pressure")
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let band: MembershipHealthBand = "stable"
  if (score < 42) band = "payment_risk"
  else if (score < 52) band = "renewal_risk"
  else if (score < 62) band = "engagement_risk"
  else if (score < 72) band = "at_risk"

  return { band, score0to100: score, drivers }
}

export function buildRetentionRecommendationLines(args: {
  customersMissingAutopayWithActivePlans: number
  failedScheduledWindowCount: number
  contractExpiring30dCount: number
  churnRiskScore0to100: number
}): string[] {
  const lines: string[] = []
  if (args.customersMissingAutopayWithActivePlans >= 1) {
    lines.push(
      `${args.customersMissingAutopayWithActivePlans} customer(s) with active preventive plans have no future-pay authorization on file — office follow-up can lift renewal capture.`,
    )
  }
  if (args.failedScheduledWindowCount >= 1) {
    lines.push(
      `${args.failedScheduledWindowCount} scheduled renewal payment(s) failed recently — retry cadence + wallet-first recovery reduces churn.`,
    )
  }
  if (args.contractExpiring30dCount >= 1) {
    lines.push(
      `${args.contractExpiring30dCount} active service agreement(s) enter renewal within 30 days — align invoices before coverage lapses.`,
    )
  }
  if (args.churnRiskScore0to100 >= 55) {
    lines.push("Churn-risk composite is elevated — prioritize autopay adoption on repeat-service customers.")
  }
  if (lines.length === 0) {
    lines.push("Recurring health looks steady in the bounded sample — keep renewal reminders aligned with visit cadence.")
  }
  return lines.slice(0, 8)
}

export function churnRiskScore0to100(args: {
  failedScheduledWindowCount: number
  failedExposureCents: number
  overdueInvoiceCount: number
  customersMissingAutopayWithActivePlans: number
  expiredContractDataRiskCount: number
}): number {
  let s = 18
  s += Math.min(28, args.failedScheduledWindowCount * 9)
  s += Math.min(22, Math.floor(args.failedExposureCents / 50_000))
  s += Math.min(18, args.overdueInvoiceCount * 2)
  s += Math.min(14, args.customersMissingAutopayWithActivePlans * 3)
  s += Math.min(12, args.expiredContractDataRiskCount * 4)
  return Math.max(0, Math.min(100, Math.round(s)))
}
