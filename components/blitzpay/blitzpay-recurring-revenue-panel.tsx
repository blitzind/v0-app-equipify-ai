"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, Loader2, RefreshCw, Repeat } from "lucide-react"
import type { BlitzpayRecurringRevenuePulsePayload } from "@/lib/blitzpay/blitzpay-recurring-revenue-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayRecurringRevenuePanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<BlitzpayRecurringRevenuePulsePayload | null>(null)
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
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/recurring-revenue?windowDays=30`,
        { cache: "no-store", credentials: "include" },
      )
      const j = (await res.json()) as { recurringRevenue?: BlitzpayRecurringRevenuePulsePayload; message?: string }
      if (!res.ok) {
        setData(null)
        setError(typeof j.message === "string" ? j.message : "Could not load recurring revenue signals.")
        return
      }
      setData(j.recurringRevenue ?? null)
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
      id="blitzpay-recurring-revenue-anchor"
      className={cn(
        "rounded-xl border border-border bg-card px-3 py-4 sm:px-5 sm:py-5 space-y-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-semibold">Recurring revenue & renewals</p>
            <p className="text-[10px] text-muted-foreground">
              Deterministic maintenance, agreements, scheduled renewals, and installments — no AI, bounded reads, staff-only.
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
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm" className="h-7 text-[11px]">
              <Link href="/maintenance-plans">Maintenance plans</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="h-7 text-[11px]">
              <Link href="/customers">Customers</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="h-7 text-[11px]">
              <Link href="/invoices">Invoices</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="h-7 text-[11px]">
              <Link href="/work-orders">Work orders</Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { k: "Planned renewals (30d)", v: fmtMoney(data.recurringPlannedInflow30dCents) },
              { k: "Annualized run-rate proxy", v: fmtMoney(data.annualizedRecurringRunRateProxyCents) },
              { k: "Recurring share of window", v: `${data.recurringMixOfCollectedWindowPct}%` },
              { k: "Autopay adoption (profiles)", v: `${data.autopayAdoptionPct}%` },
              { k: "Renewal success proxy", v: `${data.renewalSuccessProxyPct}%` },
              { k: "Churn-risk score", v: String(data.churnRiskScore0to100) },
              { k: "Cash stability score", v: String(data.recurringStabilityScore0to100) },
              { k: "Projected renewals (90d)", v: fmtMoney(data.projectedRenewalRevenue90dCents) },
            ].map((x) => (
              <div key={x.k} className="rounded-lg border border-border/80 bg-background/50 px-2 py-1.5">
                <p className="text-[9px] text-muted-foreground uppercase leading-tight">{x.k}</p>
                <p className="text-xs font-semibold tabular-nums mt-0.5">{x.v}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border/80 bg-background/40 px-3 py-2 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Agreement & plan coverage</p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
              <li>Active preventive plans: {data.maintenanceActiveCount} (paused {data.maintenancePausedCount})</li>
              <li>Visits due in 30 days: {data.maintenanceDueNext30dCount}</li>
              <li>Active service agreements: {data.contractActiveCount}</li>
              <li>Agreements in renewal window (30d): {data.contractExpiring30dCount}</li>
              <li>Customers on plans without future-pay setup: {data.customersMissingAutopayWithActivePlans}</li>
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 space-y-1">
              <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">At-risk customers (sample)</p>
              {data.atRiskCustomers.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No high-priority cohort in the bounded slice.</p>
              ) : (
                <ul className="text-[11px] space-y-1">
                  {data.atRiskCustomers.map((c) => (
                    <li key={c.customerId} className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">{c.band.replace(/_/g, " ")}</span>
                      <Button asChild variant="link" className="h-auto p-0 text-[11px]">
                        <Link href={`/customers/${encodeURIComponent(c.customerId)}`}>Open customer</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-border/80 bg-background/40 px-3 py-2 space-y-1">
              <p className="text-[11px] font-semibold flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5" /> Upcoming renewals
              </p>
              {data.upcomingRenewals.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No dated renewals in the next 30 days in the sample.</p>
              ) : (
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                  {data.upcomingRenewals.slice(0, 8).map((u) => (
                    <li key={`${u.kind}-${u.refId}`}>
                      {u.kind === "maintenance" ? "Preventive visit" : "Agreement end"} · {u.dueYmd}
                      {u.customerId ? (
                        <>
                          {" "}
                          <Link href={`/customers/${encodeURIComponent(u.customerId)}`} className="text-primary underline-offset-2 hover:underline">
                            Customer
                          </Link>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {data.failedRenewals.length > 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 space-y-1">
              <p className="text-[11px] font-semibold text-destructive">Failed renewal attempts</p>
              <ul className="text-[11px] space-y-1 list-disc pl-4">
                {data.failedRenewals.map((f) => (
                  <li key={f.invoiceId}>
                    {fmtMoney(f.portionCents)} scheduled renewal did not complete
                    {f.errorHint ? ` — ${f.errorHint}` : ""}{" "}
                    <Link href="/invoices" className="text-primary underline-offset-2 hover:underline">
                      Open invoices
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.recurringPaymentRecoveryQueue.length > 0 ? (
            <div className="rounded-lg border border-border/80 px-3 py-2 space-y-1">
              <p className="text-[11px] font-semibold">Scheduled recovery queue</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                {data.recurringPaymentRecoveryQueue.map((r) => (
                  <li key={r.scheduleId}>
                    {fmtMoney(r.portionCents)} pending for{" "}
                    <Link href="/invoices" className="text-primary underline-offset-2 hover:underline">
                      invoice
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 space-y-1">
            <p className="text-[11px] font-semibold text-primary">Retention recommendations</p>
            <ul className="text-[11px] space-y-1 list-disc pl-4">
              {data.retentionRecommendations.map((r) => (
                <li key={r.slice(0, 100)}>{r}</li>
              ))}
            </ul>
          </div>

          {data.workflowFlags.length > 0 ? (
            <div className="rounded-lg border border-border px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Workflow flags</p>
              <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc pl-4">
                {data.workflowFlags.map((w) => (
                  <li key={w.slice(0, 120)}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-[10px] text-muted-foreground">
            Org membership health (aggregate): {data.membershipHealthOrg.band.replace(/_/g, " ")} · score{" "}
            {data.membershipHealthOrg.score0to100}/100
          </p>
        </div>
      ) : null}
    </div>
  )
}
