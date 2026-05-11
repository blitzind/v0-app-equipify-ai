import type { BlitzpayCustomerPaymentBehaviorSummary } from "@/lib/blitzpay/blitzpay-customer-payment-behavior"

export type CollectionsAutomationFacts = {
  averageDaysToPayWhenPaid: number | null
  overdueCollectibleCents: number
  overdueInvoiceCount: number
  activeInstallmentPlansCount: number
  walletSpendableCreditTotalCents: number
  achPendingSettlementCents: number
  paymentMethodMixCard: number
  paymentMethodMixAch: number
  reminderEffectivenessRatePct: number
  workOrdersFieldCollectibleApprox: number
  fieldCollectibleCentsApprox: number
}

/**
 * Deterministic automation copy for collections acceleration (no LLM).
 */
export function buildCollectionsAutomationInsights(f: CollectionsAutomationFacts): Array<{ id: string; severity: "info" | "warning"; message: string }> {
  const out: Array<{ id: string; severity: "info" | "warning"; message: string }> = []

  if (f.averageDaysToPayWhenPaid != null && f.averageDaysToPayWhenPaid >= 15 && f.paymentMethodMixAch < f.paymentMethodMixCard) {
    out.push({
      id: "ach_for_slow_payers",
      severity: "info",
      message: "Enable ACH for customers paying after 15+ days — slower pay cycles often settle more reliably with bank transfer.",
    })
  }

  if (f.overdueInvoiceCount >= 2 && f.activeInstallmentPlansCount === 0 && f.overdueCollectibleCents >= 50_000) {
    out.push({
      id: "installment_overdue",
      severity: "warning",
      message: "Installment plans could reduce overdue AR exposure on larger open balances.",
    })
  }

  if (f.workOrdersFieldCollectibleApprox >= 1) {
    out.push({
      id: "field_collect",
      severity: "info",
      message: `${f.workOrdersFieldCollectibleApprox} invoice(s) look tied to upcoming field visits — prioritize collect-at-job for faster cash.`,
    })
  }

  if (f.walletSpendableCreditTotalCents >= 25_000 && f.overdueCollectibleCents > 0) {
    out.push({
      id: "wallet_apply",
      severity: "info",
      message: "Customer wallet credit can reduce open balances — review credits before aggressive dunning.",
    })
  }

  if (f.reminderEffectivenessRatePct >= 70 && f.overdueInvoiceCount >= 3) {
    out.push({
      id: "cadence_aggressive",
      severity: "warning",
      message: "Reminder cadence may be too aggressive while balances remain overdue — consider spacing office follow-ups.",
    })
  }

  if (f.achPendingSettlementCents >= 100_000) {
    out.push({
      id: "ach_pending_float",
      severity: "info",
      message: "ACH is still settling on meaningful volume — set expectations on cash timing with operations.",
    })
  }

  return out
}

export function buildCustomerPaymentBehaviorProfile(
  s: BlitzpayCustomerPaymentBehaviorSummary,
  mix: { card: number; ach: number },
): {
  averageDaysToPayWhenPaid: number | null
  latePaymentRatePct: number
  achVsCardHint: "ach_heavy" | "card_heavy" | "mixed" | "unknown"
  installmentUsageLevel: "low" | "medium" | "high"
  depositUsageLevel: "low" | "medium" | "high"
  responsivenessScore: number
  disputeRefundPressure: "low" | "medium" | "high"
} {
  const total = mix.card + mix.ach
  let achVsCardHint: "ach_heavy" | "card_heavy" | "mixed" | "unknown" = "unknown"
  if (total > 0) {
    const achShare = mix.ach / total
    if (achShare >= 0.55) achVsCardHint = "ach_heavy"
    else if (achShare <= 0.25) achVsCardHint = "card_heavy"
    else achVsCardHint = "mixed"
  }

  let installmentUsageLevel: "low" | "medium" | "high" = "low"
  if (s.financingSessionsLifetime >= 8 || s.financingSessionsFundedOrReleased >= 3) installmentUsageLevel = "high"
  else if (s.financingSessionsLifetime >= 2) installmentUsageLevel = "medium"

  let depositUsageLevel: "low" | "medium" | "high" = "low"
  if (s.likelyDepositBenefit === "high") depositUsageLevel = "high"
  else if (s.likelyDepositBenefit === "medium") depositUsageLevel = "medium"

  const responsivenessScore = Math.round(
    clamp01((100 - Math.min(100, s.latePaymentRatePct)) * 0.55 + (s.trustSignal === "generally_on_time" ? 30 : s.trustSignal === "mixed" ? 15 : 5)),
  )

  let disputeRefundPressure: "low" | "medium" | "high" = "low"
  if (s.riskSignal === "high") disputeRefundPressure = "high"
  else if (s.riskSignal === "medium") disputeRefundPressure = "medium"

  return {
    averageDaysToPayWhenPaid: s.averageDaysToPayWhenPaid,
    latePaymentRatePct: s.latePaymentRatePct,
    achVsCardHint,
    installmentUsageLevel,
    depositUsageLevel,
    responsivenessScore,
    disputeRefundPressure,
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}
