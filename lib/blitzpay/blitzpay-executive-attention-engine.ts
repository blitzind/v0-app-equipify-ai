/**
 * BlitzPay Executive Attention Engine — deterministic operational intelligence (no LLMs).
 * Extend via new signal helpers + registry entries; keep thresholds conservative to limit noise.
 */
import type { BlitzpayBusinessHealthPayload } from "@/lib/blitzpay/blitzpay-business-health-types"
import type { ExecutiveRecommendation } from "@/lib/blitzpay/blitzpay-executive-recommendations"
import type { FccExecutiveAttentionItem } from "@/lib/blitzpay/blitzpay-fcc-executive-overview-types"
import type { FccExecutiveOverviewDataScope } from "@/lib/blitzpay/executive-overview-widgets"

export const BLITZPAY_EXECUTIVE_ATTENTION_ENGINE_VERSION = "1.0.0"

export type ExecutiveAttentionEngineInput = {
  health: BlitzpayBusinessHealthPayload
  dataScope: FccExecutiveOverviewDataScope
  pendingApCount: number
  stripe: {
    connectAccountPresent: boolean
    onboardingComplete: boolean
    chargesEnabled: boolean
  }
}

export type ExecutiveAttentionEngineResult = {
  version: string
  alerts: FccExecutiveAttentionItem[]
  executiveBriefing: {
    paragraph: string
    opportunities: string[]
    risks: string[]
    suggestedActions: string[]
  }
}

function scopeRank(s: FccExecutiveOverviewDataScope): number {
  switch (s) {
    case "solo_lite":
      return 0
    case "core_standard":
      return 1
    case "growth_standard":
      return 2
    case "scale_full":
      return 3
    default:
      return 0
  }
}

function scopeAtLeast(scope: FccExecutiveOverviewDataScope, min: FccExecutiveOverviewDataScope): boolean {
  return scopeRank(scope) >= scopeRank(min)
}

function ctxAsOf(health: BlitzpayBusinessHealthPayload): string {
  return health.generatedAt
}

function ctxWindowNote(health: BlitzpayBusinessHealthPayload): string {
  return `${health.reportingWindowDays}-day bounded reporting window`
}

function hrefForSignalId(id: string): { hrefKind: "fcc" | "settings"; fccSlug?: string } {
  if (id === "collections_vs_invoice_lag") return { hrefKind: "fcc", fccSlug: "internal-books" }
  if (id === "net_cash_30_negative" || id.includes("cash") || id === "cash_runway_signal") return { hrefKind: "fcc", fccSlug: "operating-cash" }
  if (id.includes("ar_") || id.includes("overdue") || id.includes("collections") || id === "invoice_aging" || id === "recovery_opportunity")
    return { hrefKind: "fcc", fccSlug: "collections" }
  if (id.includes("tech_") || id.includes("job") || id === "wo_invoice_gap" || id === "field_invoice_later" || id === "operational_leakage")
    return { hrefKind: "fcc", fccSlug: "internal-books" }
  if (id.includes("financing")) return { hrefKind: "fcc", fccSlug: "financing-marketplace" }
  if (id.includes("customer_concentration") || id === "pm_churn_risk" || id === "renewal_instability" || id === "missing_autopay")
    return { hrefKind: "fcc", fccSlug: "billing-profiles" }
  if (id.includes("reminder")) return { hrefKind: "fcc", fccSlug: "collections" }
  if (id === "stripe_onboarding" || id === "stripe_charges") return { hrefKind: "settings" }
  if (id === "pending_vendor_approvals" || id === "vendor_ap_due_soon" || id.includes("vendor")) return { hrefKind: "fcc", fccSlug: "vendor-bills" }
  if (id === "ach_failed_payments" || id === "treasury_failed_payouts") return { hrefKind: "fcc", fccSlug: "command-center-data" }
  if (id.includes("dispute")) return { hrefKind: "fcc", fccSlug: "command-center-data" }
  if (id === "payroll_pressure") return { hrefKind: "fcc", fccSlug: "payroll-commissions" }
  if (id === "technician_utilization_sample") return { hrefKind: "fcc", fccSlug: "executive-health" }
  return { hrefKind: "fcc", fccSlug: "command-center-data" }
}

function recommendedActionFor(id: string): string {
  const m: Record<string, string> = {
    stripe_onboarding: "Complete Stripe Connect onboarding in Payments settings.",
    stripe_charges: "Enable charges in Stripe Connect settings when your account is ready.",
    pending_vendor_approvals: "Approve or reject queued vendor bills so pay schedules stay accurate.",
    vendor_ap_due_soon: "Review vendor bills due within seven days and align cash timing.",
    invoice_aging: "Prioritize hosted pay links and follow-ups on the largest overdue balances first.",
    recovery_opportunity: "Queue recovery touches on estimated recoverable overdue amounts.",
    collections_vs_invoice_lag: "Tighten same-day closeout billing on completed jobs before the next cash cycle.",
    field_invoice_later: "Clear “invoice later” markers with same-day staff billing follow-up.",
    net_cash_30_negative: "Re-stage vendor payouts and pull forward deposits where policy allows.",
    disputes_open: "Upload dispute evidence and align customer expectations early.",
    ach_failed_payments: "Retry or re-route failed ACH attempts after confirming bank account status.",
    treasury_failed_payouts: "Inspect failed payouts in treasury reporting and Stripe diagnostics.",
    payroll_pressure: "Validate accrued payroll and commission liabilities before scheduling payouts.",
    renewal_instability: "Tighten renewal reminders and hosted-pay enrollment on recurring cohorts.",
    missing_autopay: "Promote autopay on eligible maintenance and recurring agreements.",
    pm_churn_risk: "Review payment behavior on high-friction accounts and tighten terms where appropriate.",
    cash_runway_signal: "Reconcile operating cash estimate with upcoming inflows and obligations.",
    score_warning: "Validate the underlying metrics in command center data before changing cadence.",
    technician_utilization_sample: "Broaden technician invoice attribution coverage to read utilization fairly.",
  }
  return m[id] ?? "Review details in the linked workspace before changing operations or payouts."
}

function enrichRecommendation(r: ExecutiveRecommendation, health: BlitzpayBusinessHealthPayload): FccExecutiveAttentionItem {
  const href = hrefForSignalId(r.id)
  return {
    id: r.id,
    signalId: r.id,
    severity: r.severity,
    message: r.message,
    recommendedAction: recommendedActionFor(r.id),
    contextAsOf: ctxAsOf(health),
    contextNote: ctxWindowNote(health),
    hrefKind: href.hrefKind,
    fccSlug: href.fccSlug,
  }
}

function pushStripeAlerts(
  out: FccExecutiveAttentionItem[],
  input: ExecutiveAttentionEngineInput,
  seen: Set<string>,
): void {
  const { stripe, health } = input
  if (stripe.connectAccountPresent && !stripe.onboardingComplete) {
    const id = "stripe_onboarding"
    seen.add(id)
    out.push({
      id,
      signalId: id,
      severity: "risk",
      message: "Stripe Connect onboarding is incomplete — payouts and hosted checkout readiness may be blocked.",
      impactHint: "Revenue collection",
      recommendedAction: recommendedActionFor(id),
      estimatedImpactCents: null,
      contextAsOf: ctxAsOf(health),
      contextNote: "Stripe dashboard remains source of truth for account state.",
      hrefKind: "settings",
    })
  } else if (stripe.connectAccountPresent && !stripe.chargesEnabled) {
    const id = "stripe_charges"
    seen.add(id)
    out.push({
      id,
      signalId: id,
      severity: "risk",
      message: "Stripe charges are not enabled yet — online collection may be limited.",
      impactHint: "Checkout readiness",
      recommendedAction: recommendedActionFor(id),
      contextAsOf: ctxAsOf(health),
      hrefKind: "settings",
    })
  }
}

function pushVendorAndTreasury(
  out: FccExecutiveAttentionItem[],
  input: ExecutiveAttentionEngineInput,
  seen: Set<string>,
): void {
  const { pendingApCount, health, dataScope } = input
  const f = health.facts

  if (scopeAtLeast(dataScope, "growth_standard") && pendingApCount > 0) {
    const id = "pending_vendor_approvals"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: pendingApCount >= 8 ? "risk" : "watch",
        message: `${pendingApCount} vendor bill${pendingApCount === 1 ? "" : "s"} pending approval before pay scheduling.`,
        impactHint: "Accounts payable queue",
        recommendedAction: recommendedActionFor(id),
        contextAsOf: ctxAsOf(health),
        contextNote: ctxWindowNote(health),
        hrefKind: "fcc",
        fccSlug: "vendor-bills",
      })
    }
  }

  if (scopeAtLeast(dataScope, "core_standard") && f.apDue7OpenCents >= 25_000_00) {
    const id = "vendor_ap_due_soon"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.apDue7OpenCents >= 150_000_00 ? "risk" : "watch",
        message: `About ${new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(f.apDue7OpenCents / 100)} in vendor payables is due within seven days in the internal AP mirror.`,
        impactHint: "Near-term cash outflow",
        recommendedAction: recommendedActionFor(id),
        estimatedImpactCents: f.apDue7OpenCents,
        contextAsOf: ctxAsOf(health),
        contextNote: "Internal AP mirror — not bank settlement.",
        hrefKind: "fcc",
        fccSlug: "vendor-bills",
      })
    }
  }

  if (scopeAtLeast(dataScope, "growth_standard") && f.achFailedPaymentWindowCount >= 2) {
    const id = "ach_failed_payments"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.achFailedPaymentWindowCount >= 6 ? "risk" : "watch",
        message: `${f.achFailedPaymentWindowCount} ACH payment attempt(s) show a failed settlement state in the reporting window — recovery follow-up may be needed.`,
        impactHint: "Failed payment recovery",
        recommendedAction: recommendedActionFor(id),
        contextAsOf: ctxAsOf(health),
        contextNote: ctxWindowNote(health),
        hrefKind: "fcc",
        fccSlug: "command-center-data",
      })
    }
  }

  if (scopeAtLeast(dataScope, "growth_standard") && f.treasuryFailedPayoutCount30d > 0) {
    const id = "treasury_failed_payouts"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.treasuryFailedPayoutCount30d >= 3 ? "risk" : "watch",
        message: `${f.treasuryFailedPayoutCount30d} treasury payout row(s) failed in the last 30 days where synced — confirm bank and Stripe payout health.`,
        impactHint: "Treasury / payouts",
        recommendedAction: recommendedActionFor(id),
        contextAsOf: ctxAsOf(health),
        contextNote: "Mirror of Stripe payout states when balance transactions are synced.",
        hrefKind: "fcc",
        fccSlug: "command-center-data",
      })
    }
  }
}

function pushCoreFinancialSignals(
  out: FccExecutiveAttentionItem[],
  input: ExecutiveAttentionEngineInput,
  seen: Set<string>,
): void {
  const { health } = input
  const f = health.facts
  const s = health.scores

  if (f.overdueInvoiceCount >= 3 && f.overdueCollectibleCents >= 15_000_00) {
    const id = "invoice_aging"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.overdueCollectibleCents >= 75_000_00 || f.overdueInvoiceCount >= 12 ? "risk" : "watch",
        message: `${f.overdueInvoiceCount} overdue invoice(s) with about ${new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(f.overdueCollectibleCents / 100)} in collectible-style exposure in the bounded AR view.`,
        impactHint: "Invoice aging",
        recommendedAction: recommendedActionFor(id),
        estimatedImpactCents: f.overdueCollectibleCents,
        contextAsOf: ctxAsOf(health),
        contextNote: ctxWindowNote(health),
        hrefKind: "fcc",
        fccSlug: "collections",
      })
    }
  }

  if (f.estimatedRecoverableOverdueCents >= 20_000_00 && f.overdueInvoiceCount > 0) {
    const id = "recovery_opportunity"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: "info",
        message: `Estimated recoverable overdue exposure is about ${new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(f.estimatedRecoverableOverdueCents / 100)} — collections cadence can still lift realized cash without policy changes.`,
        impactHint: "Recovery opportunity",
        recommendedAction: recommendedActionFor(id),
        estimatedImpactCents: f.estimatedRecoverableOverdueCents,
        contextAsOf: ctxAsOf(health),
        contextNote: "Model estimate from reminders and overdue mix — not a promise of recovery.",
        hrefKind: "fcc",
        fccSlug: "collections",
      })
    }
  }

  if (f.openDisputesCount > 0) {
    const id = "disputes_open"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.openDisputesAmountCents >= 25_000_00 ? "risk" : "watch",
        message: `${f.openDisputesCount} open dispute(s) on record — resolve evidence requests early to protect collected cash.`,
        recommendedAction: recommendedActionFor(id),
        estimatedImpactCents: f.openDisputesAmountCents,
        contextAsOf: ctxAsOf(health),
        hrefKind: "fcc",
        fccSlug: "command-center-data",
      })
    }
  }

  if (s.collections >= 62 && (f.completedWoScanned > 0 && f.completedWoWithoutInvoiceSampleCount / f.completedWoScanned >= 0.12)) {
    const id = "collections_vs_invoice_lag"
    if (!seen.has(id)) {
      seen.add(id)
      seen.add("wo_invoice_gap")
      out.push({
        id,
        signalId: id,
        severity: "watch",
        message:
          "Collections tooling looks healthy, but completed-job to invoice linkage still looks elevated in the bounded sample — tighten closeout billing discipline.",
        impactHint: "Operational bottleneck",
        recommendedAction: recommendedActionFor("collections_vs_invoice_lag"),
        contextAsOf: ctxAsOf(health),
        contextNote: "Sample-based operations signal — expand attribution before acting on outliers.",
        hrefKind: "fcc",
        fccSlug: "internal-books",
      })
    }
  }

  if (f.cashRunwayStatus !== "healthy" && scopeAtLeast(input.dataScope, "growth_standard")) {
    const id = "cash_runway_signal"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.cashRunwayStatus === "risk" ? "risk" : "watch",
        message:
          f.cashRunwayStatus === "risk"
            ? "Cash runway estimate is in a risk band — align collections cadence with staged vendor payouts."
            : "Cash runway estimate is in a watch band — monitor inflows and reserve coverage this week.",
        recommendedAction: recommendedActionFor(id),
        estimatedImpactCents: Math.max(0, f.cashReserveGapCents),
        contextAsOf: ctxAsOf(health),
        contextNote: "Deterministic cash planning estimate — not a bank balance.",
        hrefKind: "fcc",
        fccSlug: "operating-cash",
      })
    }
  }
}

function pushRenewalAndAutopay(
  out: FccExecutiveAttentionItem[],
  input: ExecutiveAttentionEngineInput,
  seen: Set<string>,
): void {
  if (!scopeAtLeast(input.dataScope, "core_standard")) return
  const { health } = input
  const f = health.facts

  if (f.recurringPlannedInflow30dCents >= 5_000_00 && f.recurringStabilityScore0to100 <= 48) {
    const id = "renewal_instability"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.recurringStabilityScore0to100 <= 35 ? "risk" : "watch",
        message: `Recurring stability reads ${f.recurringStabilityScore0to100}/100 while planned recurring inflow is material — renewal execution may be uneven.`,
        impactHint: "Revenue instability",
        recommendedAction: recommendedActionFor(id),
        estimatedImpactCents: f.projectedRenewalRevenue90dCents,
        contextAsOf: ctxAsOf(health),
        contextNote: "Proxy scores from recurring billing signals — not GAAP revenue recognition.",
        hrefKind: "fcc",
        fccSlug: "billing-profiles",
      })
    }
  }

  if (f.recurringPlannedInflow30dCents >= 8_000_00 && f.autopayAdoptionPct < 28) {
    const id = "missing_autopay"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: "watch",
        message: `Autopay enrollment is about ${Math.round(f.autopayAdoptionPct)}% while recurring inflow is meaningful — hosted autopay reduces renewal drag.`,
        impactHint: "Renewal / leakage",
        recommendedAction: recommendedActionFor(id),
        estimatedImpactCents: f.autopayRiskExposureCents > 0 ? f.autopayRiskExposureCents : null,
        contextAsOf: ctxAsOf(health),
        hrefKind: "fcc",
        fccSlug: "billing-profiles",
      })
    }
  }

  if (f.churnRiskScore0to100 >= 58 && f.recurringPlannedInflow30dCents >= 3_000_00) {
    const id = "pm_churn_risk"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.churnRiskScore0to100 >= 72 ? "risk" : "watch",
        message: `Churn-risk proxy is ${f.churnRiskScore0to100}/100 with recurring exposure — validate account manager follow-ups on fragile payers.`,
        impactHint: "PM churn risk (payment behavior proxy)",
        recommendedAction: recommendedActionFor(id),
        contextAsOf: ctxAsOf(health),
        contextNote: "Behavioral proxy, not individual credit scoring.",
        hrefKind: "fcc",
        fccSlug: "revenue-optimization",
      })
    }
  }
}

function pushPayrollAndUtilization(
  out: FccExecutiveAttentionItem[],
  input: ExecutiveAttentionEngineInput,
  seen: Set<string>,
): void {
  const { health, dataScope } = input
  const f = health.facts

  if (scopeAtLeast(dataScope, "growth_standard") && (f.payrollLiabilityCents >= 120_000_00 || f.payrollPendingCommissionCents >= 200_000_00)) {
    const id = "payroll_pressure"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: f.payrollLiabilityCents >= 300_000_00 ? "risk" : "watch",
        message:
          "Payroll and commission accruals look elevated versus typical bands — confirm schedules before accelerating other cash outflows.",
        impactHint: "Payroll pressure",
        recommendedAction: recommendedActionFor(id),
        estimatedImpactCents: Math.max(f.payrollLiabilityCents, f.payrollPendingCommissionCents),
        contextAsOf: ctxAsOf(health),
        contextNote: "Internal accrual estimate — orchestration only, not disbursement.",
        hrefKind: "fcc",
        fccSlug: "payroll-commissions",
      })
    }
  }

  if (f.technicianInvoiceAttributionSample < 10 && f.completedWoScanned >= 24 && f.technicianTopTwoRevenueSharePct == null) {
    const id = "technician_utilization_sample"
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        id,
        signalId: id,
        severity: "info",
        message:
          "Technician invoice attribution sample is thin while job volume is visible — widen coverage before relying on utilization gaps.",
        impactHint: "Technician utilization visibility",
        recommendedAction: recommendedActionFor(id),
        contextAsOf: ctxAsOf(health),
        contextNote: ctxWindowNote(health),
        hrefKind: "fcc",
        fccSlug: "executive-health",
      })
    }
  }
}

function mergeRecommendations(
  out: FccExecutiveAttentionItem[],
  input: ExecutiveAttentionEngineInput,
  seen: Set<string>,
): void {
  for (const r of input.health.recommendations) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    out.push(enrichRecommendation(r, input.health))
  }
}

function mergeWarningsAndLeakage(
  out: FccExecutiveAttentionItem[],
  input: ExecutiveAttentionEngineInput,
  seen: Set<string>,
): void {
  const { health } = input
  for (const w of health.warnings) {
    const key = `warn:${w}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: key,
      signalId: "score_warning",
      severity: "watch",
      message: w,
      recommendedAction: recommendedActionFor("score_warning"),
      contextAsOf: ctxAsOf(health),
      contextNote: ctxWindowNote(health),
      hrefKind: "fcc",
      fccSlug: "command-center-data",
    })
  }

  for (const line of health.pipeline.operationalLeakageNotes.slice(0, 3)) {
    const key = `leak:${line}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: key,
      signalId: "operational_leakage",
      severity: "watch",
      message: line,
      impactHint: "Workflow leakage",
      recommendedAction: recommendedActionFor("field_invoice_later"),
      contextAsOf: ctxAsOf(health),
      contextNote: ctxWindowNote(health),
      hrefKind: "fcc",
      fccSlug: "internal-books",
    })
  }
}

function prioritizeAndDedupe(items: FccExecutiveAttentionItem[]): FccExecutiveAttentionItem[] {
  const rank = { risk: 0, watch: 1, info: 2 }
  const sorted = [...items].sort((a, b) => {
    const sr = rank[a.severity] - rank[b.severity]
    if (sr !== 0) return sr
    const ia = a.estimatedImpactCents ?? 0
    const ib = b.estimatedImpactCents ?? 0
    if (ia !== ib) return ib - ia
    return a.id.localeCompare(b.id)
  })
  const seen = new Set<string>()
  const out: FccExecutiveAttentionItem[] = []
  for (const it of sorted) {
    const k = `${it.severity}:${it.message}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(it)
    if (out.length >= 12) break
  }
  return out
}

function buildBriefingParagraph(health: BlitzpayBusinessHealthPayload, alerts: FccExecutiveAttentionItem[]): string {
  const s = health.scores
  const f = health.facts
  const woGap =
    f.completedWoScanned > 0 ? f.completedWoWithoutInvoiceSampleCount / Math.max(1, f.completedWoScanned) : 0
  const collectionsFirm = s.collections >= 60
  const invoiceLag = woGap >= 0.12 || f.fieldInvoiceLaterWindowCount >= 4
  const cashTight = f.cashRunwayStatus !== "healthy"

  const parts: string[] = []
  if (collectionsFirm && invoiceLag) {
    parts.push("Collections health looks firm in this window, but invoice completion lag still reads elevated in the bounded operations sample.")
  } else if (!collectionsFirm && f.overdueInvoiceCount > 0) {
    parts.push("Overdue receivables pressure is pulling collections health lower — prioritize follow-ups on the largest balances first.")
  } else if (collectionsFirm) {
    parts.push("Collections signals look steady versus the deterministic model in this window.")
  } else {
    parts.push("Collections signals are mixed — validate reminder timing against net terms.")
  }

  if (cashTight) {
    parts.push("Cash runway is not in the comfort band — align staged payouts with verified inflows before operational changes.")
  } else if (f.netCashPosition30Cents < 0) {
    parts.push("Thirty-day net cash outlook is negative after modeled payables pressure — review vendor timing and deposits.")
  } else {
    parts.push("Nothing here moves money automatically — confirm any change in Stripe or your bank before acting.")
  }

  if (alerts.some((a) => a.signalId === "stripe_onboarding" || a.signalId === "stripe_charges")) {
    return `${parts[0]} ${parts[1]} Stripe Connect readiness still needs attention before scaling hosted collections.`
  }
  return `${parts[0]} ${parts[1]}`
}

function buildBriefingLists(health: BlitzpayBusinessHealthPayload, alerts: FccExecutiveAttentionItem[]): ExecutiveAttentionEngineResult["executiveBriefing"] {
  const opportunities = uniqueStrings([
    ...health.growthOpportunities,
    ...health.automationOpportunities,
    ...health.pipeline.cashAccelerationOpportunities.slice(0, 2),
  ]).slice(0, 5)

  const risks = uniqueStrings([...health.warnings, ...alerts.filter((a) => a.severity !== "info").map((a) => a.message)]).slice(0, 5)

  const fromAlerts = uniqueStrings(
    alerts.map((a) => a.recommendedAction ?? recommendedActionFor(a.signalId ?? a.id)),
  ).slice(0, 5)

  const fromRecs = uniqueStrings(health.recommendations.map((r) => recommendedActionFor(r.id))).slice(0, 3)
  const suggestedActions = uniqueStrings([...fromAlerts, ...fromRecs]).slice(0, 5)

  return {
    paragraph: buildBriefingParagraph(health, alerts),
    opportunities,
    risks,
    suggestedActions,
  }
}

function uniqueStrings(lines: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const t = line.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/**
 * Central entry: deterministic alerts + executive briefing lists.
 */
export function buildExecutiveAttentionPack(input: ExecutiveAttentionEngineInput): ExecutiveAttentionEngineResult {
  const out: FccExecutiveAttentionItem[] = []
  const seen = new Set<string>()

  pushStripeAlerts(out, input, seen)
  pushVendorAndTreasury(out, input, seen)
  pushCoreFinancialSignals(out, input, seen)
  pushRenewalAndAutopay(out, input, seen)
  pushPayrollAndUtilization(out, input, seen)
  mergeRecommendations(out, input, seen)
  mergeWarningsAndLeakage(out, input, seen)

  const alerts = prioritizeAndDedupe(out)
  const executiveBriefing = buildBriefingLists(input.health, alerts)

  return {
    version: BLITZPAY_EXECUTIVE_ATTENTION_ENGINE_VERSION,
    alerts,
    executiveBriefing,
  }
}
