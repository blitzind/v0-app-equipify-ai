import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildCombinedArApCashForecast } from "@/lib/blitzpay/blitzpay-command-center-math"
import {
  buildFinancialCommandCenterRecommendations,
  type FinancialCommandCenterRecommendation,
} from "@/lib/blitzpay/blitzpay-command-center-recommendations"
import { aggregateBlitzpayTreasuryMetrics } from "@/lib/blitzpay/blitzpay-contractor-treasury"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { buildOwnerScorecards, type OwnerScorecard } from "@/lib/blitzpay/blitzpay-owner-scorecards"
import { fetchBlitzpayOrgRevenueIntelligence } from "@/lib/blitzpay/blitzpay-revenue-intelligence"
import type { BlitzpayRevenueRecommendation } from "@/lib/blitzpay/blitzpay-revenue-recommendations"
import { fetchBlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export type BlitzpayFinancialCommandCenterDrilldown = {
  href: string
  label: string
  /** Safe aggregate for UI; not a Stripe id. */
  count?: number
}

export type BlitzpayFinancialCommandCenterPayload = {
  reportingWindowDays: number
  generatedAt: string
  tiles: {
    cashCollectedWindowCents: number
    expectedCollections7Cents: number
    expectedCollections30Cents: number
    expectedCollections60Cents: number
    openArOverdueCents: number
    openArOverdueInvoiceCount: number
    openApOutstandingCents: number
    pendingPayoutsCents: number
    walletCreditLiabilityCents: number
    depositsUnappliedCents: number
    refundsWindowCents: number
    openDisputesCount: number
    openDisputesAmountCents: number
    scheduledFuturePaymentsCents: number
    activeInstallmentPlansCount: number
    treasuryOperatingCents: number
    treasuryHeldReserveCents: number
    reserveTargetCents: number
    payoutPressureCents: number
    workOrderPaymentLinksWindowCount: number
    abandonedCheckoutInvoices: number
    recurringStabilityScore0to100: number
    plannedRecurringInflow30dCents: number
    autopayAdoptionPct: number
  }
  combinedForecast: ReturnType<typeof buildCombinedArApCashForecast>
  scorecards: OwnerScorecard[]
  /** Deterministic command-center automation strings. */
  commandCenterRecommendations: FinancialCommandCenterRecommendation[]
  /** Existing BlitzPay revenue / collections recommendations (structured). */
  revenueRecommendations: BlitzpayRevenueRecommendation[]
  drilldowns: Record<string, BlitzpayFinancialCommandCenterDrilldown>
}

function drilldownsForOrg(overdueCount: number): Record<string, BlitzpayFinancialCommandCenterDrilldown> {
  return {
    invoices: { href: "/invoices", label: "Open invoices" },
    overdueInvoices: { href: "/invoices", label: "Review overdue invoices", count: overdueCount },
    quotes: { href: "/quotes", label: "Quotes & estimates" },
    workOrders: { href: "/work-orders", label: "Work orders" },
    customers: { href: "/customers", label: "Customers" },
    vendorPayables: { href: "/settings/payments#blitzpay-ap-anchor", label: "Vendor payables (Settings → Payments)" },
    paymentLinks: { href: "/work-orders", label: "Work orders (field collection)" },
    payouts: { href: "/settings/payments#blitzpay-payout-ledger-anchor", label: "Payout ledger (Settings → Payments)" },
    disputes: { href: "/settings/payments", label: "Disputes & refunds (review in Payments / invoices)" },
    reports: { href: "/reports", label: "Operations reports" },
  }
}

export async function fetchBlitzpayOrgFinancialCommandCenter(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number },
): Promise<BlitzpayFinancialCommandCenterPayload> {
  assertUuid(organizationId, "organizationId")
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()

  const [intelligence, reporting] = await Promise.all([
    fetchBlitzpayOrgRevenueIntelligence(admin, organizationId, { reportingWindowDays }),
    fetchBlitzpayOrgReportingSnapshot(admin, organizationId, { sinceIso }),
  ])

  let stripePayoutsEnabled = false
  let pendingApprovalPayableCount = 0
  const [{ data: orgRow }, { count: apPendingCount, error: apErr }] = await Promise.all([
    admin.from("organizations").select("stripe_payouts_enabled").eq("id", organizationId).maybeSingle(),
    admin
      .from("blitzpay_vendor_payables")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending_approval"),
  ])
  if (!apErr && apPendingCount != null) pendingApprovalPayableCount = apPendingCount
  stripePayoutsEnabled = Boolean((orgRow as { stripe_payouts_enabled?: boolean } | null)?.stripe_payouts_enabled)

  let tm: Awaited<ReturnType<typeof aggregateBlitzpayTreasuryMetrics>> | null = null
  try {
    tm = await aggregateBlitzpayTreasuryMetrics(admin, organizationId)
  } catch {
    tm = null
  }

  const d = intelligence.dashboard
  const fcast = intelligence.forecasts
  const forecastHorizons = {
    next7DaysExpectedCents: fcast.next7DaysExpectedCents,
    next30DaysExpectedCents: fcast.next30DaysExpectedCents,
    next60DaysExpectedCents: fcast.next60DaysExpectedCents,
  }
  const payoutPressure = Math.max(d.pendingPayoutsCents, d.treasuryEstimateUpcomingTransferCents)

  const combinedForecast = buildCombinedArApCashForecast({
    forecastHorizons,
    apDue7OpenCents: reporting.apDue7OpenCents,
    apDue30OpenCents: reporting.apDue30OpenCents,
    apDue60OpenCents: reporting.apDue60OpenCents,
    payoutPressureCents: payoutPressure,
  })

  const operating = tm?.operatingBalanceCents ?? 0
  const held = tm?.heldReserveCents ?? 0
  const reserveTarget = tm?.reserveTargetCents ?? 0

  const scorecards = buildOwnerScorecards({
    overdueInvoiceCount: d.overdueInvoiceCount,
    overdueCollectibleCents: d.overdueCollectibleCents,
    netCashPosition30Cents: combinedForecast.netCashPosition30Cents,
    netCashPosition7Cents: combinedForecast.netCashPosition7Cents,
    abandonedCheckoutInvoices: d.abandonedCheckoutInvoices,
    stripePayoutsEnabled,
    failedPayoutCount30d: reporting.treasuryFailedPayoutCount30d,
    apDue30OpenCents: reporting.apDue30OpenCents,
    operatingBalanceCents: operating,
    walletLiabilityCents: d.walletLiabilityCents,
    openDisputesCount: d.openDisputesCount,
    openDisputesAmountCents: d.openDisputesAmountCents,
    reminderEffectivenessRatePct: intelligence.collections.reminderEffectivenessRatePct,
  })

  const commandCenterRecommendations = buildFinancialCommandCenterRecommendations({
    combined: combinedForecast,
    overdueInvoiceCount: d.overdueInvoiceCount,
    overdueCollectibleCents: d.overdueCollectibleCents,
    apDue7OpenCents: reporting.apDue7OpenCents,
    apDue30OpenCents: reporting.apDue30OpenCents,
    expectedInflow30Cents: forecastHorizons.next30DaysExpectedCents,
    reserveTargetCents: reserveTarget,
    heldReserveCents: held,
    openDisputesAmountCents: d.openDisputesAmountCents,
    failedPayoutCount30d: reporting.treasuryFailedPayoutCount30d,
    financingReadyQuotesCount: reporting.financingReadyQuotesCount,
    estimateOpenQuotesWithTotalCount: reporting.estimateOpenQuotesWithTotalCount,
    workOrderCollectPaymentLinksWindowCount: d.workOrderCollectPaymentLinksWindowCount,
    pendingApprovalPayableCount,
  })

  return {
    reportingWindowDays,
    generatedAt: new Date().toISOString(),
    tiles: {
      cashCollectedWindowCents: d.grossCollectedWindowCents,
      expectedCollections7Cents: forecastHorizons.next7DaysExpectedCents,
      expectedCollections30Cents: forecastHorizons.next30DaysExpectedCents,
      expectedCollections60Cents: forecastHorizons.next60DaysExpectedCents,
      openArOverdueCents: d.overdueCollectibleCents,
      openArOverdueInvoiceCount: d.overdueInvoiceCount,
      openApOutstandingCents: reporting.apOpenOutstandingCents,
      pendingPayoutsCents: d.pendingPayoutsCents,
      walletCreditLiabilityCents: d.walletLiabilityCents,
      depositsUnappliedCents: reporting.customerUnappliedEstimateDepositTotalCents,
      refundsWindowCents: d.refundedVolumeWindowCents,
      openDisputesCount: d.openDisputesCount,
      openDisputesAmountCents: d.openDisputesAmountCents,
      scheduledFuturePaymentsCents: d.scheduledFuturePaymentsCents,
      activeInstallmentPlansCount: d.activeInstallmentPlansCount,
      treasuryOperatingCents: operating,
      treasuryHeldReserveCents: held,
      reserveTargetCents: reserveTarget,
      payoutPressureCents: payoutPressure,
      workOrderPaymentLinksWindowCount: d.workOrderCollectPaymentLinksWindowCount,
      abandonedCheckoutInvoices: d.abandonedCheckoutInvoices,
      recurringStabilityScore0to100: d.recurringStabilityScore0to100,
      plannedRecurringInflow30dCents: d.recurringPlannedInflow30dCents,
      autopayAdoptionPct: d.autopayAdoptionPct,
    },
    combinedForecast,
    scorecards,
    commandCenterRecommendations,
    revenueRecommendations: intelligence.recommendations,
    drilldowns: drilldownsForOrg(d.overdueInvoiceCount),
  }
}

