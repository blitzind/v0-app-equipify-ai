import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildCombinedArApCashForecast } from "@/lib/blitzpay/blitzpay-command-center-math"
import { fetchCustomerPaymentBehaviorSummary } from "@/lib/blitzpay/blitzpay-customer-payment-behavior"
import type { BlitzpayBusinessHealthPayload, BlitzpayBusinessHealthScores } from "@/lib/blitzpay/blitzpay-business-health-types"
import { buildExecutiveRecommendations, type ExecutiveFactsInput } from "@/lib/blitzpay/blitzpay-executive-recommendations"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { fetchBlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import { fetchBlitzpayOrgRevenueIntelligence } from "@/lib/blitzpay/blitzpay-revenue-intelligence"
import { fetchWorkflowCashPipelineSnapshot } from "@/lib/blitzpay/blitzpay-workflow-cash-pipeline"

const PAID_INVOICE_ATTRIBUTION_LIMIT = 120
const COMPLETED_WO_ATTRIBUTION_LIMIT = 160

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export type { BlitzpayBusinessHealthPayload, BlitzpayBusinessHealthScores } from "@/lib/blitzpay/blitzpay-business-health-types"

async function fetchTechnicianRevenueConcentration(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<{ topTwoSharePct: number | null; scannedInvoices: number }> {
  assertUuid(organizationId, "organizationId")
  const { data: invs, error } = await admin
    .from("org_invoices")
    .select("id, work_order_id, amount_cents, tax_amount_cents, paid_at")
    .eq("organization_id", organizationId)
    .eq("status", "paid")
    .not("work_order_id", "is", null)
    .gte("paid_at", sinceIso)
    .order("paid_at", { ascending: false })
    .limit(PAID_INVOICE_ATTRIBUTION_LIMIT)
  if (error || !invs?.length) return { topTwoSharePct: null, scannedInvoices: 0 }
  const rows = invs as Array<{
    id: string
    work_order_id: string
    amount_cents: number
    tax_amount_cents: number | null
    paid_at: string
  }>
  const woIds = [...new Set(rows.map((r) => r.work_order_id))]
  const techByWo = new Map<string, string | null>()
  const chunk = 60
  for (let i = 0; i < woIds.length; i += chunk) {
    const slice = woIds.slice(i, i + chunk)
    const { data: wos, error: wErr } = await admin
      .from("work_orders")
      .select("id, assigned_user_id")
      .eq("organization_id", organizationId)
      .in("id", slice)
    if (wErr) continue
    for (const w of (wos ?? []) as Array<{ id: string; assigned_user_id: string | null }>) {
      techByWo.set(w.id, w.assigned_user_id ?? null)
    }
  }
  const centsByTech = new Map<string, number>()
  let total = 0
  for (const inv of rows) {
    const cents = Math.max(0, Math.round(inv.amount_cents) + Math.max(0, Math.round(Number(inv.tax_amount_cents ?? 0))))
    const tid = techByWo.get(inv.work_order_id) ?? "unassigned"
    centsByTech.set(tid, (centsByTech.get(tid) ?? 0) + cents)
    total += cents
  }
  if (total <= 0) return { topTwoSharePct: null, scannedInvoices: rows.length }
  const sorted = [...centsByTech.entries()].sort((a, b) => b[1] - a[1])
  const top2 = sorted.slice(0, 2).reduce((s, [, v]) => s + v, 0)
  return { topTwoSharePct: Math.min(100, Math.round((top2 / total) * 1000) / 10), scannedInvoices: rows.length }
}

async function fetchCompletedJobsTechnicianConcentration(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<{ topTwoSharePct: number | null; scanned: number }> {
  assertUuid(organizationId, "organizationId")
  const { data: wos, error } = await admin
    .from("work_orders")
    .select("id, assigned_user_id, status, updated_at")
    .eq("organization_id", organizationId)
    .in("status", ["completed", "completed_pending_signature"])
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(COMPLETED_WO_ATTRIBUTION_LIMIT)
  if (error || !wos?.length) return { topTwoSharePct: null, scanned: 0 }
  const rows = wos as Array<{ assigned_user_id: string | null }>
  const counts = new Map<string, number>()
  let total = 0
  for (const w of rows) {
    const k = w.assigned_user_id ?? "unassigned"
    counts.set(k, (counts.get(k) ?? 0) + 1)
    total += 1
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top2 = sorted.slice(0, 2).reduce((s, [, v]) => s + v, 0)
  return { topTwoSharePct: Math.min(100, Math.round((top2 / Math.max(1, total)) * 1000) / 10), scanned: total }
}

function deriveScores(args: {
  net30: number
  overdueCents: number
  grossWindow: number
  abandoned: number
  fieldLater: number
  woGapRatio: number
  concentration: number
  disputeAmount: number
  refundCents: number
  reminderPct: number
}): BlitzpayBusinessHealthScores {
  const overduePressure = args.grossWindow > 0 ? args.overdueCents / args.grossWindow : 0
  let financial = 72 - Math.min(40, overduePressure * 45)
  if (args.net30 > 0) financial += 12
  if (args.net30 < 0) financial -= 18
  financial -= Math.min(15, args.disputeAmount / Math.max(1, args.grossWindow) * 20)

  let collections = 78 - Math.min(45, overduePressure * 50)
  collections += Math.min(10, args.reminderPct / 10)

  let operational = 80
  operational -= Math.min(20, args.abandoned * 4)
  operational -= Math.min(15, args.fieldLater * 3)
  operational -= Math.min(25, args.woGapRatio * 35)

  const cashFlowPressure = clampScore(100 - clampScore(financial + (args.net30 < 0 ? 15 : 0)))

  const customerConcentrationRisk = clampScore(args.concentration * 0.85 + (args.overdueCents > 0 ? 8 : 0))

  const refundRatio = args.grossWindow > 0 ? args.refundCents / args.grossWindow : 0
  let serviceProfitabilityConfidence = 75 - Math.min(30, refundRatio * 40) - Math.min(20, args.disputeAmount / Math.max(1, args.grossWindow) * 25)

  const overall = clampScore(
    (clampScore(financial) +
      clampScore(collections) +
      clampScore(operational) +
      (100 - clampScore(cashFlowPressure)) +
      (100 - clampScore(customerConcentrationRisk)) +
      clampScore(serviceProfitabilityConfidence)) /
      6,
  )

  return {
    overall,
    financial: clampScore(financial),
    collections: clampScore(collections),
    operationalEfficiency: clampScore(operational),
    cashFlowPressure: clampScore(cashFlowPressure),
    customerConcentrationRisk: clampScore(customerConcentrationRisk),
    serviceProfitabilityConfidence: clampScore(serviceProfitabilityConfidence),
  }
}

/**
 * Org-level deterministic business health (no LLM). Heavy work reuses revenue intelligence + reporting snapshot patterns.
 */
export async function fetchBlitzpayBusinessHealth(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayBusinessHealthPayload> {
  assertUuid(organizationId, "organizationId")
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()

  const [intelligence, reportingResolved, customerBehavior, techRev, techJobs] = await Promise.all([
    fetchBlitzpayOrgRevenueIntelligence(admin, organizationId, { reportingWindowDays }),
    fetchBlitzpayOrgReportingSnapshot(admin, organizationId, { sinceIso }),
    fetchCustomerPaymentBehaviorSummary(admin, organizationId),
    fetchTechnicianRevenueConcentration(admin, organizationId, sinceIso),
    fetchCompletedJobsTechnicianConcentration(admin, organizationId, sinceIso),
  ])

  const pipelineResolved = await fetchWorkflowCashPipelineSnapshot(admin, organizationId, {
    sinceIso,
    fieldInvoiceLaterWindowCount: reportingResolved.workOrdersFieldInvoiceLaterWindowCount,
  })

  const d = intelligence.dashboard
  const fcast = intelligence.forecasts
  const payoutPressure = Math.max(d.pendingPayoutsCents, d.treasuryEstimateUpcomingTransferCents)
  const combined = buildCombinedArApCashForecast({
    forecastHorizons: {
      next7DaysExpectedCents: fcast.next7DaysExpectedCents,
      next30DaysExpectedCents: fcast.next30DaysExpectedCents,
      next60DaysExpectedCents: fcast.next60DaysExpectedCents,
    },
    apDue7OpenCents: reportingResolved.apDue7OpenCents,
    apDue30OpenCents: reportingResolved.apDue30OpenCents,
    apDue60OpenCents: reportingResolved.apDue60OpenCents,
    payoutPressureCents: payoutPressure,
  })

  const woGapRatio =
    pipelineResolved.completedWoScanned > 0
      ? pipelineResolved.completedWorkOrdersWithoutInvoiceSampleCount / pipelineResolved.completedWoScanned
      : 0

  const scores = deriveScores({
    net30: combined.netCashPosition30Cents,
    overdueCents: d.overdueCollectibleCents,
    grossWindow: Math.max(1, d.grossCollectedWindowCents),
    abandoned: d.abandonedCheckoutInvoices,
    fieldLater: pipelineResolved.workOrdersFieldInvoiceLaterWindowCount,
    woGapRatio,
    concentration: customerBehavior.overdueConcentrationTopSharePct,
    disputeAmount: d.openDisputesAmountCents,
    refundCents: d.refundedVolumeWindowCents,
    reminderPct: intelligence.collections.reminderEffectivenessRatePct,
  })

  const execFacts: ExecutiveFactsInput = {
    reportingWindowDays,
    overdueCollectibleCents: d.overdueCollectibleCents,
    overdueInvoiceCount: d.overdueInvoiceCount,
    overdueInvoiceCountPriorWindowApprox: null,
    netCashPosition30Cents: combined.netCashPosition30Cents,
    grossCollectedWindowCents: d.grossCollectedWindowCents,
    openDisputesCount: d.openDisputesCount,
    openDisputesAmountCents: d.openDisputesAmountCents,
    refundedVolumeWindowCents: d.refundedVolumeWindowCents,
    reminderEffectivenessRatePct: intelligence.collections.reminderEffectivenessRatePct,
    recoveredRevenueCents: intelligence.collections.recoveredRevenueCents,
    treasuryAveragePayoutDelayDays: reportingResolved.treasuryAveragePayoutDelayDays,
    treasuryAveragePayoutDelayDaysPriorApprox: null,
    financingSessionsCreatedWindowCount: reportingResolved.blitzpayFinancingSessionsCreatedWindowCount,
    financingSessionsFundedOrReleasedCount: reportingResolved.blitzpayFinancingSessionsFundedOrReleasedCount,
    estimateOpenQuotesWithTotalCount: reportingResolved.estimateOpenQuotesWithTotalCount,
    quotesWithBlitzpayDepositCollected: reportingResolved.quotesWithBlitzpayDepositCollected,
    technicianTopTwoSharePct: techRev.topTwoSharePct,
    completedJobsTopTwoSharePct: techJobs.topTwoSharePct,
    overdueConcentrationTopSharePct: customerBehavior.overdueConcentrationTopSharePct,
    completedWoWithoutInvoiceSampleCount: pipelineResolved.completedWorkOrdersWithoutInvoiceSampleCount,
    completedWoScanned: pipelineResolved.completedWoScanned,
    fieldInvoiceLaterWindowCount: pipelineResolved.workOrdersFieldInvoiceLaterWindowCount,
  }

  const recommendations = buildExecutiveRecommendations(execFacts)

  const warnings: string[] = []
  if (scores.financial < 55) warnings.push("Financial pressure score is below the comfort band — prioritize cash-in and payout timing.")
  if (scores.collections < 55) warnings.push("Collections health is soft — tighten follow-up on overdue balances and hosted pay links.")
  if (scores.customerConcentrationRisk >= 65) warnings.push("Customer concentration risk is elevated — diversify pipeline and payment terms.")

  const growthOpportunities: string[] = []
  if (reportingResolved.financingReadyQuotesCount > 0) {
    growthOpportunities.push(`${reportingResolved.financingReadyQuotesCount} quote(s) are financing-ready — enabling financing on larger scopes can lift average ticket size.`)
  }
  if (reportingResolved.activeInstallmentPlansCount > 0) {
    growthOpportunities.push("Active installment plans indicate recurring payment behavior — extend plans to similar jobs where customers ask for flexibility.")
  }
  if (pipelineResolved.activeMaintenancePlansCount > 0) {
    growthOpportunities.push("Maintenance plans are active — packaging renewals improves predictable recurring revenue.")
  }

  const automationOpportunities: string[] = []
  if (intelligence.collections.reminderEffectivenessRatePct < 55 && d.overdueInvoiceCount > 0) {
    automationOpportunities.push("Reminder completion rate has headroom — confirm reminder schedules align with net terms on overdue cohorts.")
  }
  if (d.workOrderCollectPaymentLinksWindowCount > 0) {
    automationOpportunities.push("Field payment links are being generated — ensure technicians use collect links on every eligible job to shorten cash cycles.")
  }

  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    scores,
    pipeline: {
      operationalLeakageNotes: pipelineResolved.operationalLeakageNotes,
      cashAccelerationOpportunities: pipelineResolved.cashAccelerationOpportunities,
    },
    customerSignals: {
      likelyDepositBenefit: customerBehavior.likelyDepositBenefit,
      likelyFinancingBenefit: customerBehavior.likelyFinancingBenefit,
      trustSignal: customerBehavior.trustSignal,
      riskSignal: customerBehavior.riskSignal,
      summaryLines: customerBehavior.summaryLines,
    },
    recommendations,
    warnings,
    growthOpportunities,
    automationOpportunities,
    facts: {
      overdueCollectibleCents: d.overdueCollectibleCents,
      overdueInvoiceCount: d.overdueInvoiceCount,
      netCashPosition7Cents: combined.netCashPosition7Cents,
      netCashPosition30Cents: combined.netCashPosition30Cents,
      netCashPosition60Cents: combined.netCashPosition60Cents,
      grossCollectedWindowCents: d.grossCollectedWindowCents,
      openDisputesCount: d.openDisputesCount,
      openDisputesAmountCents: d.openDisputesAmountCents,
      refundedVolumeWindowCents: d.refundedVolumeWindowCents,
      reminderEffectivenessRatePct: intelligence.collections.reminderEffectivenessRatePct,
      recoveredRevenueCents: intelligence.collections.recoveredRevenueCents,
      treasuryAveragePayoutDelayDays: reportingResolved.treasuryAveragePayoutDelayDays,
      financingAdoptionSessions: reportingResolved.blitzpayFinancingSessionsTotal,
      activeInstallmentPlansCount: d.activeInstallmentPlansCount,
      maintenancePlansCount: pipelineResolved.activeMaintenancePlansCount,
      technicianTopTwoRevenueSharePct: techRev.topTwoSharePct,
      technicianInvoiceAttributionSample: techRev.scannedInvoices,
      completedJobsTopTwoSharePct: techJobs.topTwoSharePct,
      completedJobsAttributionSample: techJobs.scanned,
      overdueConcentrationTopSharePct: customerBehavior.overdueConcentrationTopSharePct,
      completedWoWithoutInvoiceSampleCount: pipelineResolved.completedWorkOrdersWithoutInvoiceSampleCount,
      completedWoScanned: pipelineResolved.completedWoScanned,
      fieldInvoiceLaterWindowCount: pipelineResolved.workOrdersFieldInvoiceLaterWindowCount,
    },
  }
}
