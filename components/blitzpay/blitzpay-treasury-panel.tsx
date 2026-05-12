"use client"

import { useCallback, useEffect, useState } from "react"
import { Landmark, Loader2, RefreshCw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

type TreasuryPayload = {
  availableBalanceCents: number
  pendingBalanceCents: number
  heldReserveCents: number
  reserveTargetCents: number
  operatingBalanceCents: number
  payoutInTransitCents: number
  pendingPayoutTotalCents: number
  failedPayoutCount30d: number
  avgPayoutDelayDays: number | null
  payoutVelocityPaidCents7d: number
  payoutVelocityPaidCents30d: number
  instantTransferEligible: boolean
  payoutSpeedLane: string
  estimateUpcomingTransferCents: number
  recentPayouts: Array<{
    id: string
    payoutRefTail: string
    status: string
    amountCents: number
    currency: string
    arrivalDate: string | null
    stripeCreatedAt: string
    method: string | null
    failureSummary: string | null
  }>
  insights: Array<{ id: string; severity: "info" | "warning"; message: string }>
  orgBalanceRowComputedAt: string | null
  recurringCashSignals?: {
    stabilityScore0to100: number
    plannedRecurringInflow30dCents: number
    summaryNote: string
  }
  payrollTreasurySignals?: {
    payrollLiabilityCents: number
    pendingCommissionCents: number
    contractorSettlementPendingCents: number
  }
}

type CashPlanningPayload = {
  summary: {
    estimatedOperatingCashCents: number
    cashReserveTargetCents: number
    cashReserveGapCents: number
  }
  runway: { status: string; expectedInflows30dCents: number; expectedOutflows30dCents: number }
  health: { payrollReserveCoverageBasisPoints: number; apReserveCoverageBasisPoints: number }
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return "—"
  }
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayTreasuryPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [treasury, setTreasury] = useState<TreasuryPayload | null>(null)
  const [cashPlanning, setCashPlanning] = useState<CashPlanningPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setTreasury(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/treasury`,
        { cache: "no-store", credentials: "include" },
      )
      let j: { treasury?: TreasuryPayload; cashPlanning?: CashPlanningPayload | null }
      try {
        j = (await res.json()) as { treasury?: TreasuryPayload; cashPlanning?: CashPlanningPayload | null }
      } catch {
        setTreasury(null)
        setCashPlanning(null)
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      if (!res.ok) {
        setTreasury(null)
        setCashPlanning(null)
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      setTreasury(j.treasury ?? null)
      setCashPlanning(j.cashPlanning ?? null)
    } catch {
      setTreasury(null)
      setCashPlanning(null)
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  return (
    <div className="rounded-xl border border-border bg-muted/10 px-4 py-4 sm:px-5 sm:py-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Landmark className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <p className="text-sm font-semibold text-foreground">BlitzPay contractor balance &amp; payouts</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
        <Shield className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
        Derived from Stripe Connect payout and balance-transaction mirrors. No bank account numbers are stored or shown.
        Reserve targets are configuration-only; funds remain at Stripe.
      </p>
      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}
      {loading && !treasury ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}
      {treasury ? (
        <>
          {treasury.recurringCashSignals ? (
            <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-sm space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recurring cash confidence</p>
              <p className="text-muted-foreground leading-relaxed">
                Stability {treasury.recurringCashSignals.stabilityScore0to100}/100 · Planned inbound (30d){" "}
                {fmtMoney(treasury.recurringCashSignals.plannedRecurringInflow30dCents)}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{treasury.recurringCashSignals.summaryNote}</p>
            </div>
          ) : null}
          {cashPlanning ? (
            <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-sm space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operating cash &amp; runway (Phase 2Z)</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Internal planning only — compares wallet/quote holds to treasury operating signals. Cash runway:{" "}
                <span className="font-medium text-foreground capitalize">{cashPlanning.runway.status}</span>.
              </p>
              <p className="text-xs tabular-nums leading-relaxed">
                Available operating cash (estimate) {fmtMoney(cashPlanning.summary.estimatedOperatingCashCents)} · Reserve
                target {fmtMoney(cashPlanning.summary.cashReserveTargetCents)} · Gap{" "}
                {fmtMoney(cashPlanning.summary.cashReserveGapCents)}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                Expected incoming (30d) {fmtMoney(cashPlanning.runway.expectedInflows30dCents)} · Upcoming obligations (30d
                est.) {fmtMoney(cashPlanning.runway.expectedOutflows30dCents)} · Payroll/AP coverage (bps){" "}
                {cashPlanning.health.payrollReserveCoverageBasisPoints} / {cashPlanning.health.apReserveCoverageBasisPoints}
              </p>
            </div>
          ) : null}
          {treasury.payrollTreasurySignals ? (
            <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3 text-sm space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payroll liability vs cash (Phase 2Y)</p>
              <p className="text-muted-foreground leading-relaxed text-xs">
                Accrued commissions + contractor settlements (internal ledger). Not a bank balance; compare to operating
                cash when planning distributions.
              </p>
              <p className="text-xs tabular-nums">
                Liability {fmtMoney(treasury.payrollTreasurySignals.payrollLiabilityCents)} · Pending commissions{" "}
                {fmtMoney(treasury.payrollTreasurySignals.pendingCommissionCents)} · Contractor settlements{" "}
                {fmtMoney(treasury.payrollTreasurySignals.contractorSettlementPendingCents)}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Available (ledger)</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5">{fmtMoney(treasury.availableBalanceCents)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Pending settlement</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5">{fmtMoney(treasury.pendingBalanceCents)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Held reserve (target)</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5">
                {fmtMoney(treasury.heldReserveCents)}
                <span className="text-muted-foreground font-normal"> / {fmtMoney(treasury.reserveTargetCents)}</span>
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Operating (after reserve)</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5">{fmtMoney(treasury.operatingBalanceCents)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Payout in transit</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5">{fmtMoney(treasury.payoutInTransitCents)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Est. upcoming transfer</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5">{fmtMoney(treasury.estimateUpcomingTransferCents)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Failed payouts (30d)</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5">{treasury.failedPayoutCount30d}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Avg paid delay (days)</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5">
                {treasury.avgPayoutDelayDays != null ? treasury.avgPayoutDelayDays.toFixed(1) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Payout velocity (7d / 30d)</p>
              <p className="font-semibold tabular-nums text-foreground mt-0.5 text-xs leading-snug">
                {fmtMoney(treasury.payoutVelocityPaidCents7d)} · {fmtMoney(treasury.payoutVelocityPaidCents30d)}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Instant / speed lane</p>
              <p className="font-semibold text-foreground mt-0.5">
                {treasury.instantTransferEligible ? "Eligible (heuristic)" : "Not flagged"}{" "}
                <span className="text-muted-foreground font-normal">· {treasury.payoutSpeedLane}</span>
              </p>
            </div>
          </div>
          {treasury.insights.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Insights</p>
              <ul className="space-y-1.5 text-sm leading-relaxed">
                {treasury.insights.map((i) => (
                  <li
                    key={i.id}
                    className={
                      i.severity === "warning" ? "text-amber-900 dark:text-amber-200" : "text-muted-foreground"
                    }
                  >
                    {i.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent payouts</p>
            {treasury.recentPayouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payout rows yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="p-2 font-medium">Arrival</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Method</th>
                      <th className="p-2 font-medium text-right">Amount</th>
                      <th className="p-2 font-medium">Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {treasury.recentPayouts.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="p-2 whitespace-nowrap">{p.arrivalDate ?? fmtWhen(p.stripeCreatedAt)}</td>
                        <td className="p-2">{formatBlitzpayUiLabel(p.status)}</td>
                        <td className="p-2 text-muted-foreground">{p.method ?? "—"}</td>
                        <td className="p-2 text-right font-medium">{fmtMoney(p.amountCents)}</td>
                        <td className="p-2 font-mono text-muted-foreground">…{p.payoutRefTail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {treasury.recentPayouts.some((p) => p.failureSummary) ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Failure summaries are truncated Stripe messages for staff triage only.
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Last computed {fmtWhen(treasury.orgBalanceRowComputedAt)} · Instant execution is not enabled in-app.
          </p>
        </>
      ) : null}
    </div>
  )
}
