"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Landmark, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { scorecardStatusLabel, type OwnerScorecardStatus } from "@/lib/blitzpay/blitzpay-owner-scorecards"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { BlitzpayPlanAwarenessStrip } from "@/components/blitzpay/blitzpay-plan-awareness-strip"

type CommandCenterPayload = {
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
    membershipMrrCents?: number
    membershipDelinquentCount?: number
    membershipChurnRisk0to100?: number
    membershipOpenFailures?: number
    membershipRenewalPipelineCents?: number
    payrollPendingCommissionCents?: number
    payrollLiabilityCents?: number
    contractorSettlementExposureCents?: number
    recurringRevenueSharePendingCents?: number
    commissionVelocity7dCents?: number
    draftPayrollRuns?: number
    estimatedOperatingCashCents?: number
    cashReserveTargetCents?: number
    cashReserveGapCents?: number
    cashRunwayStatus?: "healthy" | "watch" | "risk"
    expectedInflows7dCents?: number
    expectedInflows30dCents?: number
    expectedOutflows7dCents?: number
    expectedOutflows30dCents?: number
    payrollReserveCoverageBasisPoints?: number
    apReserveCoverageBasisPoints?: number
    totalAssetsCents?: number
    totalLiabilitiesCents?: number
    totalEquityCents?: number
    deferredRevenueCents?: number
    accountsReceivableCents?: number
    accountsPayableCents?: number
    payrollLiabilityGlCents?: number
    trialBalanceHealthy?: boolean
    unreconciledBatchCount?: number
    pendingRevenueRecognitionCount?: number
    /** Phase 3B — vendor bills AP (bounded reporting). */
    accountsPayableOutstandingCents?: number
    approvedBillsAwaitingPaymentCents?: number
    overdueVendorBillsCents?: number
    averageVendorPaymentDays?: number | null
    vendorConcentrationRisk?: number
    treasuryCoverageForPayables?: number
    payableAgingHealthScore?: number
    /** Phase 3C — tax & compliance (bounded; not legal advice). */
    salesTaxPayableCents?: number
    payrollTaxPayableCents?: number
    contractorTaxEstimateCents?: number
    convenienceFeeExposureRisk?: number
    achAuthorizationCoverageRate?: number
    vendor1099ReadinessRate?: number
    filingReadinessScore?: number
    complianceHealthScore?: number
    financingApplicationApprovalRate?: number
    averageApprovedFinancingAmount?: number
    financingMarketplaceCoverage?: number
    contractorAdvanceExposure?: number
    financingRevenueOpportunity?: number
    financingRiskScore?: number
    financingConversionRate?: number
    financingTreasuryImpactScore?: number
    totalInventoryValueCents?: number
    inventoryWriteoffExposure?: number
    inventoryTurnoverScore?: number
    reorderExposureCents?: number
    rebateOpportunityCents?: number
    serializedAssetExposure?: number
    procurementTreasuryImpactScore?: number
    inventoryMarginHealthScore?: number
    aiFinancialRiskScore?: number
    treasuryPressureScore?: number
    marginRiskScore?: number
    collectionsOptimizationScore?: number
    payrollPressureScore?: number
    procurementEfficiencyScore?: number
    vendorConcentrationRiskScore?: number
    aiInsightCoverageRate?: number
    revenueOptimizationScore?: number
    estimatedRevenueOpportunityCents?: number
    paymentBehaviorCoverageRate?: number
    churnPreventionOpportunityCount?: number
    achNudgeOpportunityCount?: number
    renewalOptimizationOpportunityCount?: number
    technicianCoachingOpportunityCount?: number
    optimizationExperimentCount?: number
    multiEntityRevenueExposure?: number
    multiEntityTreasuryExposure?: number
    intercompanyBalanceExposure?: number
    consolidatedCollectionsRate?: number
    franchiseHealthScore?: number
    sharedBenchmarkCoverage?: number
    multiEntityRiskScore?: number
    consolidatedOrganizationCount?: number
    supplierNetworkParticipationScore?: number
    procurementBenchmarkScore?: number
    preferredPricingOpportunityCents?: number
    bulkPurchaseOpportunityCents?: number
    supplierPerformanceHealthScore?: number
    rebateCaptureOpportunityScore?: number
    vendorFinancingOpportunityScore?: number
    supplierNetworkCoverageRate?: number
    warrantyReserveExposure?: number
    claimsExposureCents?: number
    claimsReserveCoverageScore?: number
    protectionPlanRecurringRevenue?: number
    stormEventTreasuryPressure?: number
    contractorProtectionHealthScore?: number
    claimsPayoutExposure?: number
    protectionPlanCoverageRate?: number
    mobileFinancialIntentCount?: number
    offlineFinancialIntentCount?: number
    mobileSyncFailureRate?: number
    mobileSignatureCoverageRate?: number
    mobilePayrollApprovalPendingCount?: number
    fieldCollectionsIntentCents?: number
    mobileTreasuryVisibilityScore?: number
    mobileConflictReviewCount?: number
    queueHealthScore?: number
    workflowFailureRate?: number
    idempotencyConflictRate?: number
    replayPendingCount?: number
    observabilityCoverageRate?: number
    workerHealthScore?: number
    multiRegionReadinessScore?: number
    replayIntegrityScore?: number
  }
  combinedForecast: {
    netCashPosition7Cents: number
    netCashPosition30Cents: number
    netCashPosition60Cents: number
    riskNotes: string[]
  }
  scorecards: Array<{ id: string; title: string; status: OwnerScorecardStatus; detail: string }>
  commandCenterRecommendations: Array<{ id: string; severity: "info" | "warning"; message: string }>
  revenueRecommendations: Array<{ id: string; title: string; detail: string; severity: string }>
  drilldowns: Record<string, { href: string; label: string; count?: number }>
  operationalReadiness?: {
    generatedAt: string
    entitlementFoundationVersion: string
    reportingSnapshotRecursionGuard: "nominal" | "depth_capped"
    reportingNestingDepthMax: number
    mobileFieldReadinessScore0to100: number
    observabilityReplayGovernanceLabel: string
    permissionAuditNote: string
    overallComfort0to100: number
    checklistLines: string[]
  }
  stripeLiveReadiness?: {
    generatedAt: string
    stripeHostApiModeLabel: string
    stripePublishableKeyModeLabel: string
    stripeLiveModeEnforcedOnHost: boolean
    blitzpayWebhookSigningConfigured: boolean
    publishableSecretModeAligned: boolean | null
    webhookEventDedupeSummary: string
    connectOnboardingHeadline: string
    connectOperationalWarnings: string[]
    payoutReadinessSummary: string
    disputeExposureSummary: string
    achAttentionSummary: string | null
    environmentAlignmentNote: string | null
    operationalFootnotes: string[]
  }
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

/** Reporting field is basis points from `computeTreasuryCoverageForPayablesBps` (see ap-service). */
function treasuryCoverageTile(bps: number): string {
  if (bps >= 999_000) return "—"
  return `${Math.min(999, Math.round(bps / 100))}% (est.)`
}

function statusChipClass(status: OwnerScorecardStatus): string {
  if (status === "healthy") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30"
  if (status === "watch") return "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/35"
  return "bg-destructive/15 text-destructive border-destructive/30"
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayFinancialCommandCenterPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CommandCenterPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/financial-command-center?windowDays=30`,
        { cache: "no-store", credentials: "include" },
      )
      let j: { commandCenter?: CommandCenterPayload }
      try {
        j = (await res.json()) as { commandCenter?: CommandCenterPayload }
      } catch {
        setData(null)
        setError(blitzpayStaffWidgetLoadCopy.financialCommandCenter)
        return
      }
      if (!res.ok) {
        setData(null)
        setError(blitzpayStaffWidgetLoadCopy.financialCommandCenter)
        return
      }
      setData(j.commandCenter ?? null)
    } catch {
      setData(null)
      setError(blitzpayStaffWidgetLoadCopy.financialCommandCenter)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white dark:bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
        "min-w-0 max-w-full overflow-x-hidden",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Landmark className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Command center data</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Unified receivables, payables, treasury, credits, and forecasts — no raw Stripe identifiers.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      <BlitzpayPlanAwarenessStrip surface="financial_command_center" />

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}
      {loading && !data ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}

      {data ? (
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            Window {data.reportingWindowDays}d · Generated {new Date(data.generatedAt).toLocaleString()}
          </p>

          {data.operationalReadiness ? (
            <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3 space-y-2 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Operational readiness (Phase 7A)
                </p>
                <p className="text-xs text-muted-foreground tabular-nums shrink-0">
                  Overall comfort {data.operationalReadiness.overallComfort0to100}/100
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-muted-foreground leading-relaxed">
                <p className="min-w-0">
                  <span className="font-medium text-foreground">Reporting guard: </span>
                  {data.operationalReadiness.reportingSnapshotRecursionGuard === "depth_capped" ?
                    "Depth cap engaged on this build path"
                  : "Nominal (root snapshot)"}{" "}
                  · max depth {data.operationalReadiness.reportingNestingDepthMax}
                </p>
                <p className="min-w-0">
                  <span className="font-medium text-foreground">Mobile field signals: </span>
                  {data.operationalReadiness.mobileFieldReadinessScore0to100}/100
                </p>
                <p className="min-w-0">
                  <span className="font-medium text-foreground">Replay governance: </span>
                  {data.operationalReadiness.observabilityReplayGovernanceLabel}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed min-w-0">{data.operationalReadiness.permissionAuditNote}</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed list-disc pl-4 min-w-0">
                {data.operationalReadiness.checklistLines.slice(0, 12).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.stripeLiveReadiness ? (
            <div className="rounded-lg border border-border/70 bg-muted/10 px-4 py-3 space-y-2 min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Stripe live readiness (Phase 7A.6)
                </p>
                <p className="text-xs text-muted-foreground shrink-0">
                  API {data.stripeLiveReadiness.stripeHostApiModeLabel}
                  {data.stripeLiveReadiness.blitzpayWebhookSigningConfigured ? "" : " · webhook signing off"}
                </p>
              </div>
              {data.stripeLiveReadiness.environmentAlignmentNote ? (
                <p className="text-[11px] font-medium text-amber-900 dark:text-amber-100 leading-relaxed min-w-0">
                  {data.stripeLiveReadiness.environmentAlignmentNote}
                </p>
              ) : null}
              <p className="text-xs text-foreground font-medium leading-relaxed min-w-0">
                {data.stripeLiveReadiness.connectOnboardingHeadline}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground leading-relaxed">
                <p className="min-w-0">{data.stripeLiveReadiness.payoutReadinessSummary}</p>
                <p className="min-w-0">{data.stripeLiveReadiness.disputeExposureSummary}</p>
              </div>
              {data.stripeLiveReadiness.achAttentionSummary ? (
                <p className="text-[11px] text-muted-foreground leading-relaxed min-w-0">
                  {data.stripeLiveReadiness.achAttentionSummary}
                </p>
              ) : null}
              {data.stripeLiveReadiness.connectOperationalWarnings.length > 0 ? (
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4 min-w-0">
                  {data.stripeLiveReadiness.connectOperationalWarnings.slice(0, 5).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <p className="text-[11px] text-muted-foreground leading-relaxed min-w-0 border-t border-border/50 pt-2">
                {data.stripeLiveReadiness.webhookEventDedupeSummary}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 min-w-0">
            {[
              { k: "Cash collected", v: fmtMoney(data.tiles.cashCollectedWindowCents) },
              { k: "Expected collections (7d)", v: fmtMoney(data.tiles.expectedCollections7Cents) },
              { k: "Open AR (overdue est.)", v: fmtMoney(data.tiles.openArOverdueCents) },
              { k: "Overdue invoices", v: String(data.tiles.openArOverdueInvoiceCount) },
              { k: "Open AP", v: fmtMoney(data.tiles.openApOutstandingCents) },
              { k: "Pending payouts", v: fmtMoney(data.tiles.pendingPayoutsCents) },
              { k: "Payout pressure", v: fmtMoney(data.tiles.payoutPressureCents) },
              { k: "Wallet liability", v: fmtMoney(data.tiles.walletCreditLiabilityCents) },
              { k: "Deposits unapplied", v: fmtMoney(data.tiles.depositsUnappliedCents) },
              { k: "Refunds (window)", v: fmtMoney(data.tiles.refundsWindowCents) },
              { k: "Open disputes", v: `${data.tiles.openDisputesCount} · ${fmtMoney(data.tiles.openDisputesAmountCents)}` },
              { k: "Scheduled payments", v: fmtMoney(data.tiles.scheduledFuturePaymentsCents) },
              { k: "Active installment plans", v: String(data.tiles.activeInstallmentPlansCount) },
              { k: "Operating balance", v: fmtMoney(data.tiles.treasuryOperatingCents) },
              { k: "Held reserve / target", v: `${fmtMoney(data.tiles.treasuryHeldReserveCents)} / ${fmtMoney(data.tiles.reserveTargetCents)}` },
              { k: "WO pay links (window)", v: String(data.tiles.workOrderPaymentLinksWindowCount) },
              { k: "Abandoned checkouts", v: String(data.tiles.abandonedCheckoutInvoices) },
              { k: "Recurring cash stability", v: `${data.tiles.recurringStabilityScore0to100}/100` },
              { k: "Planned renewals (30d)", v: fmtMoney(data.tiles.plannedRecurringInflow30dCents) },
              { k: "Autopay adoption (profiles)", v: `${data.tiles.autopayAdoptionPct}%` },
              { k: "Membership MRR (native plans)", v: fmtMoney(data.tiles.membershipMrrCents ?? 0) },
              { k: "Membership delinquents", v: String(data.tiles.membershipDelinquentCount ?? 0) },
              { k: "Membership churn risk", v: `${data.tiles.membershipChurnRisk0to100 ?? 0}/100` },
              { k: "Membership open failures", v: String(data.tiles.membershipOpenFailures ?? 0) },
              { k: "Membership renewal pipeline (90d)", v: fmtMoney(data.tiles.membershipRenewalPipelineCents ?? 0) },
              { k: "Pending technician commissions", v: fmtMoney(data.tiles.payrollPendingCommissionCents ?? 0) },
              { k: "Payroll liability (comm + settlements + share)", v: fmtMoney(data.tiles.payrollLiabilityCents ?? 0) },
              { k: "Contractor settlement exposure", v: fmtMoney(data.tiles.contractorSettlementExposureCents ?? 0) },
              { k: "Revenue-share pending (internal)", v: fmtMoney(data.tiles.recurringRevenueSharePendingCents ?? 0) },
              { k: "Commission velocity (7d accruals)", v: fmtMoney(data.tiles.commissionVelocity7dCents ?? 0) },
              { k: "Draft payroll runs", v: String(data.tiles.draftPayrollRuns ?? 0) },
              { k: "Available operating cash (estimate)", v: fmtMoney(data.tiles.estimatedOperatingCashCents ?? 0) },
              { k: "Money to reserve (target)", v: fmtMoney(data.tiles.cashReserveTargetCents ?? 0) },
              { k: "Reserve gap / shortfall", v: fmtMoney(data.tiles.cashReserveGapCents ?? 0) },
              { k: "Cash runway", v: data.tiles.cashRunwayStatus ?? "—" },
              { k: "Expected incoming payments (7d)", v: fmtMoney(data.tiles.expectedInflows7dCents ?? 0) },
              { k: "Expected incoming payments (30d)", v: fmtMoney(data.tiles.expectedInflows30dCents ?? 0) },
              { k: "Upcoming obligations (7d est.)", v: fmtMoney(data.tiles.expectedOutflows7dCents ?? 0) },
              { k: "Upcoming obligations (30d est.)", v: fmtMoney(data.tiles.expectedOutflows30dCents ?? 0) },
              { k: "Payroll reserve coverage (bps)", v: String(data.tiles.payrollReserveCoverageBasisPoints ?? 0) },
              { k: "AP reserve coverage (bps)", v: String(data.tiles.apReserveCoverageBasisPoints ?? 0) },
              { k: "Internal books — assets", v: fmtMoney(data.tiles.totalAssetsCents ?? 0) },
              { k: "Internal books — liabilities", v: fmtMoney(data.tiles.totalLiabilitiesCents ?? 0) },
              { k: "Internal books — equity", v: fmtMoney(data.tiles.totalEquityCents ?? 0) },
              { k: "Deferred revenue (on books)", v: fmtMoney(data.tiles.deferredRevenueCents ?? 0) },
              { k: "Receivables (on books)", v: fmtMoney(data.tiles.accountsReceivableCents ?? 0) },
              { k: "Payables (on books)", v: fmtMoney(data.tiles.accountsPayableCents ?? 0) },
              { k: "Payroll owed (on books)", v: fmtMoney(data.tiles.payrollLiabilityGlCents ?? 0) },
              { k: "Books balanced (trial)", v: data.tiles.trialBalanceHealthy === false ? "Review" : "Healthy" },
              { k: "Draft journal batches", v: String(data.tiles.unreconciledBatchCount ?? 0) },
              { k: "Revenue recognition due", v: String(data.tiles.pendingRevenueRecognitionCount ?? 0) },
              { k: "Vendor bills — open balance", v: fmtMoney(data.tiles.accountsPayableOutstandingCents ?? 0) },
              { k: "Vendor bills — approved, waiting to pay", v: fmtMoney(data.tiles.approvedBillsAwaitingPaymentCents ?? 0) },
              { k: "Vendor bills — past due (open)", v: fmtMoney(data.tiles.overdueVendorBillsCents ?? 0) },
              {
                k: "Vendor bills — avg days after due (recent)",
                v: data.tiles.averageVendorPaymentDays == null ? "—" : `${data.tiles.averageVendorPaymentDays} d`,
              },
              { k: "Vendor concentration (open)", v: `${data.tiles.vendorConcentrationRisk ?? 0}/100` },
              { k: "Treasury vs approved payables (est.)", v: treasuryCoverageTile(data.tiles.treasuryCoverageForPayables ?? 0) },
              { k: "Payable aging comfort", v: `${data.tiles.payableAgingHealthScore ?? 0}/100` },
              { k: "Sales tax (tracked est.)", v: fmtMoney(data.tiles.salesTaxPayableCents ?? 0) },
              { k: "Payroll tax (est.)", v: fmtMoney(data.tiles.payrollTaxPayableCents ?? 0) },
              { k: "Contractor tax (est.)", v: fmtMoney(data.tiles.contractorTaxEstimateCents ?? 0) },
              { k: "Convenience fee compliance risk", v: `${data.tiles.convenienceFeeExposureRisk ?? 0}/100` },
              { k: "ACH authorization coverage", v: `${data.tiles.achAuthorizationCoverageRate ?? 0}/100` },
              { k: "Vendor 1099 readiness", v: `${data.tiles.vendor1099ReadinessRate ?? 0}/100` },
              { k: "Filing readiness (internal)", v: `${data.tiles.filingReadinessScore ?? 0}/100` },
              { k: "Compliance health (internal)", v: `${data.tiles.complianceHealthScore ?? 0}/100` },
              { k: "Financing — application approval rate (est.)", v: `${data.tiles.financingApplicationApprovalRate ?? 0}%` },
              { k: "Financing — avg approved amount (internal)", v: fmtMoney(data.tiles.averageApprovedFinancingAmount ?? 0) },
              { k: "Financing — marketplace coverage (est.)", v: `${data.tiles.financingMarketplaceCoverage ?? 0}/100` },
              { k: "Financing — contractor advance exposure (models)", v: fmtMoney(data.tiles.contractorAdvanceExposure ?? 0) },
              { k: "Financing — revenue opportunity (pipeline est.)", v: fmtMoney(data.tiles.financingRevenueOpportunity ?? 0) },
              { k: "Financing — risk score (operational)", v: `${data.tiles.financingRiskScore ?? 0}/100` },
              { k: "Financing — conversion (funded vs pipeline)", v: `${data.tiles.financingConversionRate ?? 0}%` },
              { k: "Financing — treasury impact (est.)", v: `${data.tiles.financingTreasuryImpactScore ?? 0}/100` },
              { k: "Procurement — inventory value (internal est.)", v: fmtMoney(data.tiles.totalInventoryValueCents ?? 0) },
              { k: "Procurement — write-off exposure (signals)", v: fmtMoney(data.tiles.inventoryWriteoffExposure ?? 0) },
              { k: "Procurement — turnover comfort", v: `${data.tiles.inventoryTurnoverScore ?? 0}/100` },
              { k: "Procurement — reorder cash call (30d est.)", v: fmtMoney(data.tiles.reorderExposureCents ?? 0) },
              { k: "Procurement — rebate opportunity (annual est.)", v: fmtMoney(data.tiles.rebateOpportunityCents ?? 0) },
              { k: "Procurement — serialized assets (est.)", v: fmtMoney(data.tiles.serializedAssetExposure ?? 0) },
              { k: "Procurement — treasury vs reorder pressure", v: `${data.tiles.procurementTreasuryImpactScore ?? 0}/100` },
              { k: "Procurement — parts margin health (metadata)", v: `${data.tiles.inventoryMarginHealthScore ?? 0}/100` },
              { k: "Linked locations — revenue exposure (aggregate est.)", v: fmtMoney(data.tiles.multiEntityRevenueExposure ?? 0) },
              { k: "Linked locations — treasury exposure (aggregate est.)", v: fmtMoney(data.tiles.multiEntityTreasuryExposure ?? 0) },
              { k: "Linked locations — inter-company tracking (active)", v: fmtMoney(data.tiles.intercompanyBalanceExposure ?? 0) },
              { k: "Linked locations — collections rate (mean)", v: `${data.tiles.consolidatedCollectionsRate ?? 0}/100` },
              { k: "Linked locations — franchise health (advisory)", v: `${data.tiles.franchiseHealthScore ?? 0}/100` },
              { k: "Linked locations — benchmark coverage", v: `${data.tiles.sharedBenchmarkCoverage ?? 0}/100` },
              { k: "Linked locations — multi-entity risk (mean)", v: `${data.tiles.multiEntityRiskScore ?? 0}/100` },
              { k: "Linked locations — orgs in rollups", v: String(data.tiles.consolidatedOrganizationCount ?? 0) },
              { k: "Supplier network — participation (advisory)", v: `${data.tiles.supplierNetworkParticipationScore ?? 0}/100` },
              { k: "Supplier network — procurement benchmark (aggregate)", v: `${data.tiles.procurementBenchmarkScore ?? 0}/100` },
              { k: "Supplier network — preferred pricing signal (upper bound est.)", v: fmtMoney(data.tiles.preferredPricingOpportunityCents ?? 0) },
              { k: "Supplier network — bulk coordination savings (est.)", v: fmtMoney(data.tiles.bulkPurchaseOpportunityCents ?? 0) },
              { k: "Supplier network — supplier performance health", v: `${data.tiles.supplierPerformanceHealthScore ?? 0}/100` },
              { k: "Supplier network — rebate capture opportunity (score)", v: `${data.tiles.rebateCaptureOpportunityScore ?? 0}/100` },
              { k: "Supplier network — vendor financing visibility (score)", v: `${data.tiles.vendorFinancingOpportunityScore ?? 0}/100` },
              { k: "Supplier network — coverage (networks + seats)", v: `${data.tiles.supplierNetworkCoverageRate ?? 0}/100` },
              { k: "Claims & protection — reserve exposure (est.)", v: fmtMoney(data.tiles.warrantyReserveExposure ?? 0) },
              { k: "Claims & protection — open work exposure (est.)", v: fmtMoney(data.tiles.claimsExposureCents ?? 0) },
              { k: "Claims & protection — reserve comfort vs open work", v: `${data.tiles.claimsReserveCoverageScore ?? 0}/100` },
              { k: "Claims & protection — plan recurring proxy (annual est.)", v: fmtMoney(data.tiles.protectionPlanRecurringRevenue ?? 0) },
              { k: "Claims & protection — storm treasury pressure (active max)", v: `${data.tiles.stormEventTreasuryPressure ?? 0}/100` },
              { k: "Claims & protection — contractor health (advisory)", v: `${data.tiles.contractorProtectionHealthScore ?? 0}/100` },
              { k: "Claims & protection — payout tracking exposure (in-flight est.)", v: fmtMoney(data.tiles.claimsPayoutExposure ?? 0) },
              { k: "Claims & protection — active plan coverage signal", v: `${data.tiles.protectionPlanCoverageRate ?? 0}/100` },
              { k: "Mobile ops — financial intents (recent sample)", v: String(data.tiles.mobileFinancialIntentCount ?? 0) },
              { k: "Mobile ops — offline-captured intents (recent sample)", v: String(data.tiles.offlineFinancialIntentCount ?? 0) },
              { k: "Mobile ops — sync batch failure rate (recent batches)", v: `${data.tiles.mobileSyncFailureRate ?? 0}%` },
              { k: "Mobile ops — signature coverage vs intents (sample)", v: `${data.tiles.mobileSignatureCoverageRate ?? 0}/100` },
              { k: "Mobile ops — payroll approvals pending (sample)", v: String(data.tiles.mobilePayrollApprovalPendingCount ?? 0) },
              { k: "Mobile ops — field collection intents (draft/queued est.)", v: fmtMoney(data.tiles.fieldCollectionsIntentCents ?? 0) },
              { k: "Mobile ops — treasury visibility comfort (field bands)", v: `${data.tiles.mobileTreasuryVisibilityScore ?? 0}/100` },
              { k: "Mobile ops — conflict reviews logged (sample)", v: String(data.tiles.mobileConflictReviewCount ?? 0) },
              { k: "Observability — queue health (derived)", v: `${data.tiles.queueHealthScore ?? 0}/100` },
              { k: "Observability — worker health (derived)", v: `${data.tiles.workerHealthScore ?? 0}/100` },
              { k: "Observability — workflow failure rate (sample %)", v: `${data.tiles.workflowFailureRate ?? 0}%` },
              { k: "Observability — idempotency conflict rate (sample %)", v: `${data.tiles.idempotencyConflictRate ?? 0}%` },
              { k: "Observability — replay backlog (capped)", v: String(data.tiles.replayPendingCount ?? 0) },
              { k: "Observability — event hash coverage (sample %)", v: `${data.tiles.observabilityCoverageRate ?? 0}%` },
              { k: "Observability — multi-region readiness", v: `${data.tiles.multiRegionReadinessScore ?? 0}/100` },
              { k: "Observability — replay integrity (sample %)", v: `${data.tiles.replayIntegrityScore ?? 0}%` },
            ].map((x) => (
              <div key={x.k} className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-snug break-words">{x.k}</p>
                <p className="text-sm font-semibold tabular-nums mt-1 text-foreground">{x.v}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed border border-border/60 rounded-lg px-3 py-2 bg-muted/20">
            Mobile financial actions captured offline are reviewed and validated by the server before they become official
            financial records. Mobile ops tiles use bounded samples — not payment confirmation.
          </p>

          <p className="text-[11px] text-muted-foreground leading-relaxed border border-border/60 rounded-lg px-3 py-2 bg-muted/20">
            Observability and replay tooling support operational visibility and controlled recovery workflows. Financial
            actions remain subject to validation and approval safeguards. Enterprise tiles are metrics-only (bounded reads).
          </p>

          <div className="rounded-lg border border-border/80 px-4 py-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AR / AP combined cash outlook</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm min-w-0">
              <div>
                <p className="text-muted-foreground text-xs">Net 7d</p>
                <p className="font-semibold tabular-nums text-foreground mt-0.5">{fmtMoney(data.combinedForecast.netCashPosition7Cents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Net 30d</p>
                <p className="font-semibold tabular-nums text-foreground mt-0.5">{fmtMoney(data.combinedForecast.netCashPosition30Cents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Net 60d</p>
                <p className="font-semibold tabular-nums text-foreground mt-0.5">{fmtMoney(data.combinedForecast.netCashPosition60Cents)}</p>
              </div>
            </div>
            {data.combinedForecast.riskNotes.length > 0 ? (
              <ul className="text-xs text-[color:var(--status-warning)] space-y-1 leading-relaxed">
                {data.combinedForecast.riskNotes.slice(0, 10).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No extra cash-timing flags in this snapshot.</p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner scorecards</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.scorecards.slice(0, 8).map((s) => (
                <div key={s.id} className="rounded-lg border border-border/70 bg-background/30 px-3 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{s.title}</p>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0",
                        statusChipClass(s.status),
                      )}
                    >
                      {scorecardStatusLabel(s.status)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-2 leading-relaxed">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/70 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Automation (command center)</p>
              <ul className="space-y-2 text-sm leading-relaxed">
                {data.commandCenterRecommendations.length === 0 ?
                  <li className="text-muted-foreground">No extra automation flags.</li>
                : data.commandCenterRecommendations.slice(0, 12).map((r) => (
                    <li
                      key={r.id}
                      className={r.severity === "warning" ? "text-[color:var(--status-warning)]" : "text-muted-foreground"}
                    >
                      {r.message}
                    </li>
                  ))
                }
              </ul>
            </div>
            <div className="rounded-lg border border-border/70 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collections & revenue tips</p>
              <ul className="space-y-2 text-sm leading-relaxed">
                {data.revenueRecommendations.slice(0, 6).map((r) => (
                  <li key={r.id} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{r.title}</span> — {r.detail.slice(0, 140)}
                    {r.detail.length > 140 ? "…" : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Drilldowns</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.drilldowns).map(([key, d]) => (
                <Link
                  key={key}
                  href={d.href}
                  className="text-sm rounded-md border border-border px-3 py-1.5 bg-background/60 hover:bg-muted/50 transition-colors"
                >
                  {d.label}
                  {typeof d.count === "number" ? ` (${d.count})` : ""}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
