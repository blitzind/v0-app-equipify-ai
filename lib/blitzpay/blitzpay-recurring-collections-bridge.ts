import type { BlitzpayRecurringCollectionsSignals } from "@/lib/blitzpay/blitzpay-collections-copilot-types"
import type { BlitzpayRecurringRevenueMetrics } from "@/lib/blitzpay/blitzpay-recurring-revenue-types"

/**
 * Pure helper: maps recurring metrics into collections-copilot signals (Phase 2W).
 * Lives outside `server-only` modules so tests and clients can import types safely.
 */
export function buildRecurringCollectionsCopilotSlice(args: {
  metrics: BlitzpayRecurringRevenueMetrics
  overdueCollectibleCents: number
  reminderEffectivenessRatePct: number
}): BlitzpayRecurringCollectionsSignals {
  const m = args.metrics
  const overdue = Math.max(0, Math.round(args.overdueCollectibleCents))
  const renewalRecoveryOpportunityCents = Math.min(
    m.projectedRenewalRevenue90dCents,
    Math.round(overdue * 0.35 + m.recurringPlannedInflow30dCents * 0.2),
  )
  const autopayRiskExposureCents = Math.min(
    overdue,
    Math.round(m.failedRenewalExposureCents + m.recurringPlannedInflow30dCents * (1 - m.autopayAdoptionPct / 100)),
  )
  let churnAdjustedForecastSignal: "supportive" | "neutral" | "pressure" = "neutral"
  if (m.recurringStabilityScore0to100 >= 70 && args.reminderEffectivenessRatePct >= 50) churnAdjustedForecastSignal = "supportive"
  if (m.churnRiskScore0to100 >= 58 || m.scheduledFailedWindowCount >= 2) churnAdjustedForecastSignal = "pressure"

  const notes: string[] = []
  if (m.recurringPlannedInflow30dCents >= 25_000) {
    notes.push("Planned renewals and installments add predictable inbound cash inside 30 days.")
  }
  if (m.customersMissingAutopayWithActivePlans >= 1) {
    notes.push("Some active service-plan customers have not authorized future payments — renewal capture may slip without office follow-up.")
  }
  if (m.scheduledFailedWindowCount >= 1) {
    notes.push("Recent failed scheduled renewals increase churn-adjusted cash risk until retried or replanned.")
  }

  return {
    recurringCashStabilityScore0to100: m.recurringStabilityScore0to100,
    renewalRecoveryOpportunityCents,
    autopayRiskExposureCents,
    churnAdjustedForecastSignal,
    notes: notes.slice(0, 5),
  }
}
