"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Gauge, Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react"
import type { BlitzpayBusinessHealthPayload } from "@/lib/blitzpay/blitzpay-business-health-types"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

function ScoreRing({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value))
  const tone =
    v >= 70 ? "text-emerald-700 dark:text-emerald-300"
    : v >= 50 ? "text-amber-800 dark:text-amber-200"
    : "text-destructive"
  return (
    <div className="rounded-lg border border-border bg-white dark:bg-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums mt-1", tone)}>{v}</p>
      <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary/80 transition-[width] duration-300" style={{ width: `${v}%` }} />
      </div>
    </div>
  )
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayExecutiveDashboard({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<BlitzpayBusinessHealthPayload | null>(null)
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
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/business-health?windowDays=30`,
        { cache: "no-store", credentials: "include" },
      )
      let j: { businessHealth?: BlitzpayBusinessHealthPayload }
      try {
        j = (await res.json()) as { businessHealth?: BlitzpayBusinessHealthPayload }
      } catch {
        setData(null)
        setError(blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
        return
      }
      if (!res.ok) {
        setData(null)
        setError(blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
        return
      }
      setData(j.businessHealth ?? null)
    } catch {
      setData(null)
      setError(blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
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
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Gauge className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Executive business health</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Deterministic BlitzPay + Equipify signals — no AI, no customer portal data, no payment identifiers.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}
      {loading && !data ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}

      {data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScoreRing label="Overall" value={data.scores.overall} />
            <ScoreRing label="Financial" value={data.scores.financial} />
            <ScoreRing label="Collections" value={data.scores.collections} />
            <ScoreRing label="Operations" value={data.scores.operationalEfficiency} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ScoreRing label="Cash pressure" value={data.scores.cashFlowPressure} />
            <ScoreRing label="Concentration risk" value={data.scores.customerConcentrationRisk} />
            <ScoreRing label="Profit confidence" value={data.scores.serviceProfitabilityConfidence} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/60 p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <TrendingUp className="w-4 h-4 shrink-0" aria-hidden /> Financial pressure & velocity
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5 leading-relaxed">
                <li>30-day net cash outlook: {fmtMoney(data.facts.netCashPosition30Cents)}</li>
                <li>Overdue AR (collectible): {fmtMoney(data.facts.overdueCollectibleCents)} across {data.facts.overdueInvoiceCount} invoice(s)</li>
                <li>Gross collected ({data.reportingWindowDays}d): {fmtMoney(data.facts.grossCollectedWindowCents)}</li>
                <li>
                  Payroll liability (commissions + settlements + revenue-share pending):{" "}
                  {fmtMoney(data.facts.payrollLiabilityCents)}
                </li>
                <li>Pending technician commissions: {fmtMoney(data.facts.payrollPendingCommissionCents)}</li>
                <li>Commission velocity (7d accrual sample): {fmtMoney(data.facts.commissionVelocity7dCents)}</li>
                <li>
                  Payout timing (avg delay):{" "}
                  {data.facts.treasuryAveragePayoutDelayDays == null ? "—" : `${data.facts.treasuryAveragePayoutDelayDays}d`}
                </li>
                <li>Available operating cash (estimate): {fmtMoney(data.facts.estimatedOperatingCashCents)}</li>
                <li>Reserve target / gap: {fmtMoney(data.facts.cashReserveTargetCents)} / {fmtMoney(data.facts.cashReserveGapCents)}</li>
                <li>Cash runway status: {data.facts.cashRunwayStatus}</li>
                <li>Expected incoming payments (30d): {fmtMoney(data.facts.expectedInflows30dCents)}</li>
                <li>Upcoming obligations (30d est.): {fmtMoney(data.facts.expectedOutflows30dCents)}</li>
                <li>
                  Payroll / AP reserve coverage (bps): {data.facts.payrollReserveCoverageBasisPoints} /{" "}
                  {data.facts.apReserveCoverageBasisPoints}
                </li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-background/60 p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <Activity className="w-4 h-4 shrink-0" aria-hidden /> Collections & disputes
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5 leading-relaxed">
                <li>Reminder dispatch success: {data.facts.reminderEffectivenessRatePct}%</li>
                <li>Open disputes: {data.facts.openDisputesCount} ({fmtMoney(data.facts.openDisputesAmountCents)})</li>
                <li>Refunds (window): {fmtMoney(data.facts.refundedVolumeWindowCents)}</li>
                <li>Recovery volume tagged late-paid: {fmtMoney(data.facts.recoveredRevenueCents)}</li>
                <li>Estimated recoverable overdue (heuristic): {fmtMoney(data.facts.estimatedRecoverableOverdueCents)}</li>
                <li>Field visit collection opportunity (14d): {fmtMoney(data.facts.likelyFieldCollectibleCents)}</li>
                <li>ACH acceleration opportunity (heuristic): {fmtMoney(data.facts.achAccelerationOpportunityCents)}</li>
                <li>Installment conversion opportunity (heuristic): {fmtMoney(data.facts.installmentConversionOpportunityCents)}</li>
                <li>Technician-assisted recovery rate (sample): {data.facts.technicianAssistedRecoveryRatePct}%</li>
                <li>Reminder conversion (dispatch success): {data.facts.reminderConversionRatePct}%</li>
                <li>Field recovery share of overdue: {data.facts.fieldCollectionRecoveryRatePct}%</li>
                <li>Work orders with collectible balance (upcoming visits): {data.facts.workOrdersWithCollectibleBalancesCount}</li>
                <li>Planned recurring inflows (30d): {fmtMoney(data.facts.recurringPlannedInflow30dCents)}</li>
                <li>Recurring cash stability score: {data.facts.recurringStabilityScore0to100}/100</li>
                <li>Autopay adoption (saved profiles): {data.facts.autopayAdoptionPct}%</li>
                <li>Renewal success proxy (scheduled): {data.facts.renewalSuccessProxyPct}%</li>
                <li>Churn-risk score (renewal hygiene): {data.facts.churnRiskScore0to100}/100</li>
                <li>Projected renewal-style revenue (90d): {fmtMoney(data.facts.projectedRenewalRevenue90dCents)}</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/60 p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden /> Customer payment signals (aggregated)
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>Deposit policy signal: {data.customerSignals.likelyDepositBenefit}</li>
              <li>Financing fit signal: {data.customerSignals.likelyFinancingBenefit}</li>
              <li>On-time pattern: {data.customerSignals.trustSignal}</li>
              <li>Risk posture: {data.customerSignals.riskSignal}</li>
              {data.customerSignals.summaryLines.map((s) => (
                <li key={s.slice(0, 80)}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2 text-amber-950 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden /> Operational bottlenecks
              </p>
              <ul className="text-sm space-y-1.5 list-disc pl-5 text-foreground/90 leading-relaxed">
                {data.pipeline.operationalLeakageNotes.length === 0 ? <li>No major leakage flags in the bounded sample.</li> : null}
                {data.pipeline.operationalLeakageNotes.map((s) => (
                  <li key={s.slice(0, 100)}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-sky-950 dark:text-sky-50">Cash acceleration ideas</p>
              <ul className="text-sm space-y-1.5 list-disc pl-5 text-foreground/90 leading-relaxed">
                {[...data.pipeline.cashAccelerationOpportunities, ...data.growthOpportunities].slice(0, 12).map((s) => (
                  <li key={s.slice(0, 100)}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-semibold text-destructive">Top risks</p>
              <ul className="text-sm list-disc pl-5 space-y-1.5 leading-relaxed">
                {data.warnings.length === 0 ? <li className="text-muted-foreground">No critical warnings.</li> : null}
                {data.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
                {data.recommendations
                  .filter((r) => r.severity === "risk")
                  .map((r) => (
                    <li key={r.id}>{r.message}</li>
                  ))}
              </ul>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-semibold text-primary">Top opportunities</p>
              <ul className="text-sm list-disc pl-5 space-y-1.5 text-foreground/90 leading-relaxed">
                {data.recommendations
                  .filter((r) => r.severity !== "risk")
                  .slice(0, 8)
                  .map((r) => (
                    <li key={r.id}>{r.message}</li>
                  ))}
                {data.automationOpportunities.map((a) => (
                  <li key={a.slice(0, 80)}>{a}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Sample windows: technician revenue attribution {data.facts.technicianInvoiceAttributionSample} paid invoice(s); completed job
            mix sample {data.facts.completedJobsAttributionSample} work order(s); completed-without-invoice sample {data.facts.completedWoScanned}{" "}
            work order(s).
          </p>
        </div>
      ) : null}
    </div>
  )
}
