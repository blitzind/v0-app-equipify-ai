import type {
  CollectionChannel,
  CollectionLikelihood,
  RecoveryWindowBand,
} from "@/lib/blitzpay/blitzpay-collections-copilot-types"

export type PlaybookSignals = {
  balanceDueCents: number
  daysPastDue: number
  /** Active staged/installment plan on this invoice. */
  hasActiveInstallment: boolean
  /** Pending scheduled invoice payment row exists. */
  hasScheduledPayment: boolean
  abandonedCheckout: boolean
  walletCreditAvailableCents: number
  customerLateRatePct: number
  customerAvgDaysToPayWhenPaid: number | null
  workOrderScheduledWithin14d: boolean
  workOrderCompletedWithin30d: boolean
  reminderDispatchesLast30d: number
  hasTechnicianOnWorkOrder: boolean
  achHeavyCustomer: boolean
}

export function buildCollectionsPlaybook(s: PlaybookSignals): {
  recommendedAction: string
  recommendedChannel: CollectionChannel
  expectedRecoveryWindow: RecoveryWindowBand
  collectionLikelihood: CollectionLikelihood
  riskFlags: string[]
} {
  const riskFlags: string[] = []
  if (s.abandonedCheckout) riskFlags.push("abandoned_checkout")
  if (s.reminderDispatchesLast30d >= 5) riskFlags.push("high_reminder_volume")
  if (s.customerLateRatePct >= 40) riskFlags.push("repeat_late_payer")
  if (s.balanceDueCents >= 250_000) riskFlags.push("large_balance")

  if (s.hasScheduledPayment) {
    return {
      recommendedAction: "Pause reminders — a scheduled payment is already on file for this invoice.",
      recommendedChannel: "pause",
      expectedRecoveryWindow: "1-3d",
      collectionLikelihood: "high",
      riskFlags,
    }
  }

  if (s.hasActiveInstallment) {
    return {
      recommendedAction: "Keep installment plan on track — confirm the next installment date with the customer.",
      recommendedChannel: "email",
      expectedRecoveryWindow: "4-7d",
      collectionLikelihood: "medium",
      riskFlags,
    }
  }

  if (s.walletCreditAvailableCents > 0 && s.walletCreditAvailableCents >= Math.min(s.balanceDueCents, 50_000)) {
    return {
      recommendedAction: "Apply available wallet credit to reduce the open balance before the next reminder.",
      recommendedChannel: "office",
      expectedRecoveryWindow: "1-3d",
      collectionLikelihood: "high",
      riskFlags,
    }
  }

  if (s.workOrderScheduledWithin14d && s.hasTechnicianOnWorkOrder && s.balanceDueCents > 0) {
    return {
      recommendedAction: "Field technician collect at next visit — invoice is tied to an upcoming job.",
      recommendedChannel: "field",
      expectedRecoveryWindow: "4-7d",
      collectionLikelihood: s.customerLateRatePct < 35 ? "high" : "medium",
      riskFlags,
    }
  }

  if (s.abandonedCheckout) {
    return {
      recommendedAction: "Resend a fresh hosted payment link after the abandoned checkout attempt.",
      recommendedChannel: "hosted_pay",
      expectedRecoveryWindow: "1-3d",
      collectionLikelihood: "medium",
      riskFlags,
    }
  }

  if (s.achHeavyCustomer === false && s.balanceDueCents >= 75_000 && s.daysPastDue >= 7) {
    return {
      recommendedAction: "Offer ACH payment option to improve settlement reliability on a larger balance.",
      recommendedChannel: "email",
      expectedRecoveryWindow: "4-7d",
      collectionLikelihood: "medium",
      riskFlags,
    }
  }

  if (s.daysPastDue >= 14 && s.balanceDueCents >= 50_000 && !s.hasActiveInstallment) {
    return {
      recommendedAction: "Convert to installment plan to reduce overdue exposure while preserving cash flow.",
      recommendedChannel: "office",
      expectedRecoveryWindow: "8-14d",
      collectionLikelihood: "low",
      riskFlags,
    }
  }

  if (s.workOrderCompletedWithin30d && s.daysPastDue <= 10) {
    return {
      recommendedAction: "Send SMS reminder now while the job is still fresh for the customer.",
      recommendedChannel: "sms",
      expectedRecoveryWindow: "1-3d",
      collectionLikelihood: "high",
      riskFlags,
    }
  }

  if (s.daysPastDue >= 3) {
    return {
      recommendedAction: "Escalate to office follow-up with a clear balance summary and payment options.",
      recommendedChannel: "office",
      expectedRecoveryWindow: s.daysPastDue >= 21 ? "15+d" : "8-14d",
      collectionLikelihood: s.customerAvgDaysToPayWhenPaid != null && s.customerAvgDaysToPayWhenPaid <= 10 ? "medium" : "low",
      riskFlags,
    }
  }

  return {
    recommendedAction: "Send a polite reminder with hosted pay link before the balance ages further.",
    recommendedChannel: "email",
    expectedRecoveryWindow: "4-7d",
    collectionLikelihood: "medium",
    riskFlags,
  }
}
