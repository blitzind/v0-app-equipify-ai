/**
 * Deterministic executive insight strings — no LLMs, no external calls.
 * Callers pass numeric facts already derived from Equipify + BlitzPay data.
 */

export type ExecutiveRecommendationSeverity = "info" | "watch" | "risk"

export type ExecutiveRecommendation = {
  id: string
  severity: ExecutiveRecommendationSeverity
  message: string
}

export type ExecutiveFactsInput = {
  reportingWindowDays: number
  overdueCollectibleCents: number
  overdueInvoiceCount: number
  overdueInvoiceCountPriorWindowApprox: number | null
  netCashPosition30Cents: number
  grossCollectedWindowCents: number
  openDisputesCount: number
  openDisputesAmountCents: number
  refundedVolumeWindowCents: number
  reminderEffectivenessRatePct: number
  recoveredRevenueCents: number
  treasuryAveragePayoutDelayDays: number | null
  treasuryAveragePayoutDelayDaysPriorApprox: number | null
  financingSessionsCreatedWindowCount: number
  financingSessionsFundedOrReleasedCount: number
  estimateOpenQuotesWithTotalCount: number
  quotesWithBlitzpayDepositCollected: number
  technicianTopTwoSharePct: number | null
  completedJobsTopTwoSharePct: number | null
  overdueConcentrationTopSharePct: number
  completedWoWithoutInvoiceSampleCount: number
  completedWoScanned: number
  fieldInvoiceLaterWindowCount: number
}

function pctChange(prev: number, next: number): number | null {
  if (prev <= 0) return null
  return Math.round(((next - prev) / prev) * 1000) / 10
}

export function buildExecutiveRecommendations(f: ExecutiveFactsInput): ExecutiveRecommendation[] {
  const out: ExecutiveRecommendation[] = []

  if (f.overdueInvoiceCountPriorWindowApprox != null && f.overdueInvoiceCountPriorWindowApprox > 0) {
    const ch = pctChange(f.overdueInvoiceCountPriorWindowApprox, f.overdueInvoiceCount)
    if (ch != null && ch >= 5) {
      out.push({
        id: "ar_overdue_count_up",
        severity: ch >= 15 ? "risk" : "watch",
        message: `Open overdue invoice count is about ${ch}% higher than the prior ${f.reportingWindowDays}-day sample — collections cadence may need attention.`,
      })
    }
  }

  if (f.overdueCollectibleCents > 0 && f.grossCollectedWindowCents > 0) {
    const ratio = f.overdueCollectibleCents / Math.max(1, f.grossCollectedWindowCents)
    if (ratio >= 0.35) {
      out.push({
        id: "ar_pressure_vs_collections",
        severity: "risk",
        message:
          "Overdue receivables are large relative to cash collected in the window — prioritize follow-ups and hosted pay links on the largest balances first.",
      })
    }
  }

  if (f.netCashPosition30Cents < 0) {
    out.push({
      id: "net_cash_30_negative",
      severity: "risk",
      message:
        "30-day net cash outlook is negative after payables and payout pressure — review vendor timing, deposits, and staged payouts.",
    })
  }

  if (f.technicianTopTwoSharePct != null && f.technicianTopTwoSharePct >= 55) {
    out.push({
      id: "tech_revenue_concentration",
      severity: "watch",
      message: `Roughly ${f.technicianTopTwoSharePct}% of attributed invoice revenue in the bounded sample sits with the top two technicians — cross-training or routing can reduce key-person risk.`,
    })
  }

  if (f.completedJobsTopTwoSharePct != null && f.completedJobsTopTwoSharePct >= 55 && f.technicianTopTwoSharePct == null) {
    out.push({
      id: "tech_job_concentration",
      severity: "info",
      message: `About ${f.completedJobsTopTwoSharePct}% of completed jobs in the sample are concentrated with two technicians — confirm scheduling coverage for peak demand.`,
    })
  }

  if (f.financingSessionsCreatedWindowCount > 0 && f.financingSessionsFundedOrReleasedCount > 0) {
    out.push({
      id: "financing_usage",
      severity: "info",
      message:
        "Financing sessions were created this period and some reached funded or released — customers using financing often close larger tickets when offered at quote or invoice.",
    })
  }

  if (f.overdueConcentrationTopSharePct >= 40) {
    out.push({
      id: "customer_concentration",
      severity: "watch",
      message: `A single customer account represents about ${f.overdueConcentrationTopSharePct}% of overdue balance in the sampled invoices — consider tighter terms or deposits for that relationship.`,
    })
  }

  if (f.reminderEffectivenessRatePct >= 40 && f.recoveredRevenueCents > 0) {
    const recoveredUsd = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(
      f.recoveredRevenueCents / 100,
    )
    out.push({
      id: "reminder_recovery",
      severity: "info",
      message: `Reminder automation shows roughly ${f.reminderEffectivenessRatePct}% dispatch success on reminders, with ${recoveredUsd} in invoice volume paid after the due date in the sampled collections view.`,
    })
  } else if (f.reminderEffectivenessRatePct > 0) {
    out.push({
      id: "reminder_light",
      severity: "info",
      message: `Reminder dispatch success rate is about ${f.reminderEffectivenessRatePct}% — keep templates and timing aligned with your net terms.`,
    })
  }

  if (f.treasuryAveragePayoutDelayDays != null && f.treasuryAveragePayoutDelayDaysPriorApprox != null) {
    const d = f.treasuryAveragePayoutDelayDays - f.treasuryAveragePayoutDelayDaysPriorApprox
    if (d >= 0.75) {
      out.push({
        id: "payout_delay_up",
        severity: "watch",
        message: `Average payout delay moved up by about ${d.toFixed(1)} day(s) versus the prior sample — confirm Stripe payout settings and bank holidays.`,
      })
    }
  }

  if (f.quotesWithBlitzpayDepositCollected > 0 && f.estimateOpenQuotesWithTotalCount > 0) {
    out.push({
      id: "deposits_convert",
      severity: "info",
      message:
        "Quotes with BlitzPay deposits collected are present while open quotes remain — deposits often pair with faster conversion when scheduling is confirmed quickly.",
    })
  }

  if (f.completedWoScanned > 0 && f.completedWoWithoutInvoiceSampleCount / f.completedWoScanned >= 0.2) {
    out.push({
      id: "wo_invoice_gap",
      severity: "watch",
      message:
        "A meaningful share of completed work orders in the bounded sample still lack invoice linkage — closing that gap accelerates service-to-cash.",
    })
  }

  if (f.fieldInvoiceLaterWindowCount > 0) {
    out.push({
      id: "field_invoice_later",
      severity: "info",
      message: `${f.fieldInvoiceLaterWindowCount} “invoice later” field marker(s) in the window — quick staff billing follow-up reduces delayed revenue recognition.`,
    })
  }

  if (f.openDisputesCount > 0) {
    out.push({
      id: "disputes_open",
      severity: f.openDisputesAmountCents >= 25_000_00 ? "risk" : "watch",
      message: `${f.openDisputesCount} open dispute(s) on record — resolve evidence requests early to protect collected cash.`,
    })
  }

  if (f.refundedVolumeWindowCents > 0 && f.grossCollectedWindowCents > 0) {
    const rv = f.refundedVolumeWindowCents / Math.max(1, f.grossCollectedWindowCents)
    if (rv >= 0.08) {
      out.push({
        id: "refund_ratio",
        severity: "watch",
        message: "Refunded volume is elevated versus cash collected in the window — review scope changes and deposit policies on volatile jobs.",
      })
    }
  }

  return out
}
