"use client"

import { useCallback, useEffect, useState } from "react"
import { Landmark, Loader2, RefreshCw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

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
      const j = (await res.json()) as { treasury?: TreasuryPayload; message?: string }
      if (!res.ok) {
        setTreasury(null)
        setError(typeof j.message === "string" ? j.message : "Could not load treasury snapshot.")
        return
      }
      setTreasury(j.treasury ?? null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  return (
    <div className="rounded-lg border border-border bg-muted/10 px-3 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <p className="text-xs font-semibold">BlitzPay contractor balance &amp; payouts</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
        Derived from Stripe Connect payout and balance-transaction mirrors. No bank account numbers are stored or shown.
        Reserve targets are configuration-only; funds remain at Stripe.
      </p>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {loading && !treasury ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading…
        </p>
      ) : null}
      {treasury ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Available (ledger)</p>
              <p className="font-medium tabular-nums">{fmtMoney(treasury.availableBalanceCents)}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Pending settlement</p>
              <p className="font-medium tabular-nums">{fmtMoney(treasury.pendingBalanceCents)}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Held reserve (target)</p>
              <p className="font-medium tabular-nums">
                {fmtMoney(treasury.heldReserveCents)}
                <span className="text-muted-foreground font-normal"> / {fmtMoney(treasury.reserveTargetCents)}</span>
              </p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Operating (after reserve)</p>
              <p className="font-medium tabular-nums">{fmtMoney(treasury.operatingBalanceCents)}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Payout in transit</p>
              <p className="font-medium tabular-nums">{fmtMoney(treasury.payoutInTransitCents)}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Est. upcoming transfer</p>
              <p className="font-medium tabular-nums">{fmtMoney(treasury.estimateUpcomingTransferCents)}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Failed payouts (30d)</p>
              <p className="font-medium tabular-nums">{treasury.failedPayoutCount30d}</p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Avg paid delay (days)</p>
              <p className="font-medium tabular-nums">
                {treasury.avgPayoutDelayDays != null ? treasury.avgPayoutDelayDays.toFixed(1) : "—"}
              </p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
              <p className="text-muted-foreground">Payout velocity (7d / 30d)</p>
              <p className="font-medium tabular-nums text-[10px] leading-snug">
                {fmtMoney(treasury.payoutVelocityPaidCents7d)} · {fmtMoney(treasury.payoutVelocityPaidCents30d)}
              </p>
            </div>
            <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5 sm:col-span-2">
              <p className="text-muted-foreground">Instant / speed lane</p>
              <p className="font-medium">
                {treasury.instantTransferEligible ? "Eligible (heuristic)" : "Not flagged"}{" "}
                <span className="text-muted-foreground font-normal">· {treasury.payoutSpeedLane}</span>
              </p>
            </div>
          </div>
          {treasury.insights.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Insights</p>
              <ul className="space-y-1 text-[11px]">
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
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent payouts</p>
            {treasury.recentPayouts.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No payout rows yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-[11px]">
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
                        <td className="p-2">{p.status}</td>
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
              <p className="text-[10px] text-muted-foreground">
                Failure summaries are truncated Stripe messages for staff triage only.
              </p>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Last computed {fmtWhen(treasury.orgBalanceRowComputedAt)} · Instant execution is not enabled in-app.
          </p>
        </>
      ) : null}
    </div>
  )
}
