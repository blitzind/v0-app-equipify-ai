"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Landmark, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { scorecardStatusLabel, type OwnerScorecardStatus } from "@/lib/blitzpay/blitzpay-owner-scorecards"

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
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
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
      const j = (await res.json()) as { commandCenter?: CommandCenterPayload; message?: string }
      if (!res.ok) {
        setData(null)
        setError(typeof j.message === "string" ? j.message : "Could not load financial command center.")
        return
      }
      setData(j.commandCenter ?? null)
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
        "rounded-xl border border-border bg-card px-3 py-4 sm:px-5 sm:py-5 space-y-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-semibold">Command center data</p>
            <p className="text-[10px] text-muted-foreground">
              Unified receivables, payables, treasury, credits, and forecasts — no raw Stripe identifiers.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {loading && !data ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </p>
      ) : null}

      {data ? (
        <>
          <p className="text-[10px] text-muted-foreground">
            Window {data.reportingWindowDays}d · Generated {new Date(data.generatedAt).toLocaleString()}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
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
            ].map((x) => (
              <div key={x.k} className="rounded border border-border/70 bg-background/40 px-2 py-1.5">
                <p className="text-[9px] text-muted-foreground uppercase leading-tight">{x.k}</p>
                <p className="text-xs font-semibold tabular-nums mt-0.5">{x.v}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border/80 px-3 py-2 space-y-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">AR / AP combined cash outlook</p>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="text-muted-foreground">Net 7d</p>
                <p className="font-semibold tabular-nums">{fmtMoney(data.combinedForecast.netCashPosition7Cents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net 30d</p>
                <p className="font-semibold tabular-nums">{fmtMoney(data.combinedForecast.netCashPosition30Cents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Net 60d</p>
                <p className="font-semibold tabular-nums">{fmtMoney(data.combinedForecast.netCashPosition60Cents)}</p>
              </div>
            </div>
            {data.combinedForecast.riskNotes.length > 0 ? (
              <ul className="text-[10px] text-[color:var(--status-warning)] space-y-0.5">
                {data.combinedForecast.riskNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] text-muted-foreground">No extra cash-timing flags in this snapshot.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Owner scorecards</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.scorecards.map((s) => (
                <div key={s.id} className="rounded border border-border/70 bg-background/30 px-2 py-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{s.title}</p>
                    <span
                      className={cn(
                        "text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0",
                        statusChipClass(s.status),
                      )}
                    >
                      {scorecardStatusLabel(s.status)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 leading-snug">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded border border-border/70 px-2 py-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Automation (command center)</p>
              <ul className="space-y-1 text-[11px]">
                {data.commandCenterRecommendations.length === 0 ?
                  <li className="text-muted-foreground">No extra automation flags.</li>
                : data.commandCenterRecommendations.map((r) => (
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
            <div className="rounded border border-border/70 px-2 py-2 space-y-1">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Collections & revenue tips</p>
              <ul className="space-y-1 text-[11px]">
                {data.revenueRecommendations.slice(0, 6).map((r) => (
                  <li key={r.id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{r.title}</span> — {r.detail.slice(0, 140)}
                    {r.detail.length > 140 ? "…" : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Drilldowns</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.drilldowns).map(([key, d]) => (
                <Link
                  key={key}
                  href={d.href}
                  className="text-[11px] rounded border border-border px-2 py-1 bg-background/60 hover:bg-muted/50 transition-colors"
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
