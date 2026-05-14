"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"
import { MembershipsLucideIcon } from "@/lib/navigation/module-icons"

type Dashboard = {
  activeCount: number
  pausedCount: number
  delinquentCount: number
  mrrCents: number
  arrCents: number
  renewalPipelineCents: number
  delinquentExposureCents: number
  autopayAdoptionPct: number
  churnRiskScore0to100: number
  openFailureCount: number
  recoveredFailureWindowCount: number
  deferredRevenueProxyCents: number
  insightLines: string[]
}

type MembershipRow = {
  id: string
  membership_number: string
  status: string
  billing_frequency: string
  recurring_amount_cents: number
  next_invoice_at: string | null
  auto_bill_enabled: boolean
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayMembershipsDashboard({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [dash, setDash] = useState<Dashboard | null>(null)
  const [rows, setRows] = useState<MembershipRow[]>([])
  const [snapshots, setSnapshots] = useState<Array<{ snapshot_date: string; active_memberships: number; mrr_cents: number }>>(
    [],
  )
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setDash(null)
      setRows([])
      setSnapshots([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [dRes, mRes, sRes] = await Promise.all([
        fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/membership-insights`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/memberships`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/retention-report`, {
          credentials: "include",
          cache: "no-store",
        }),
      ])
      const dj = (await dRes.json()) as { dashboard?: Dashboard; message?: string }
      const mj = (await mRes.json()) as { memberships?: MembershipRow[]; message?: string }
      const sj = (await sRes.json()) as {
        snapshots?: Array<{ snapshot_date: string; active_memberships: number; mrr_cents: number }>
        message?: string
      }
      if (!dRes.ok) {
        setDash(null)
        setError(typeof dj.message === "string" ? dj.message : "Could not load membership insights.")
      } else {
        setDash(dj.dashboard ?? null)
      }
      if (!mRes.ok) setRows([])
      else setRows(mj.memberships ?? [])
      if (!sRes.ok) setSnapshots([])
      else setSnapshots(sj.snapshots ?? [])
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
        "rounded-xl border border-border bg-white dark:bg-card px-3 py-4 sm:px-5 sm:py-5 space-y-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
        "min-w-0 max-w-full overflow-x-hidden",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MembershipsLucideIcon className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-semibold">Memberships & recurring agreements</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Native recurring revenue (no Stripe subscription ids). Reads are bounded; renewals run on the membership cron.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

      {dash ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 min-w-0">
            {[
              { k: "Active", v: String(dash.activeCount) },
              { k: "Paused", v: String(dash.pausedCount) },
              { k: "Delinquent", v: String(dash.delinquentCount) },
              { k: "MRR (proxy)", v: fmtMoney(dash.mrrCents) },
              { k: "ARR (proxy)", v: fmtMoney(dash.arrCents) },
              { k: "Renewal pipeline (90d)", v: fmtMoney(dash.renewalPipelineCents) },
              { k: "Delinquent exposure", v: fmtMoney(dash.delinquentExposureCents) },
              { k: "Autopay adoption", v: `${dash.autopayAdoptionPct}%` },
              { k: "Churn risk score", v: `${dash.churnRiskScore0to100}/100` },
              { k: "Open failures", v: String(dash.openFailureCount) },
              { k: "Deferred revenue (proxy)", v: fmtMoney(dash.deferredRevenueProxyCents) },
              { k: "Recoveries (30d est.)", v: String(dash.recoveredFailureWindowCount) },
            ].map((x) => (
              <div key={x.k} className="rounded border border-border/70 bg-background/40 px-2 py-1.5 min-w-0">
                <p className="text-xs text-muted-foreground uppercase leading-tight break-words">{x.k}</p>
                <p className="text-xs font-semibold tabular-nums mt-0.5">{x.v}</p>
              </div>
            ))}
          </div>
          {dash.insightLines.length ? (
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
              {dash.insightLines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : loading ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </p>
      ) : null}

      {snapshots.length > 0 ? (
        <div className="rounded-lg border border-border/80 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Recent retention snapshots</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs min-w-0">
            {snapshots.slice(0, 6).map((s) => (
              <div key={s.snapshot_date} className="rounded border border-border/60 px-2 py-1">
                <p className="text-muted-foreground">{s.snapshot_date}</p>
                <p className="font-semibold tabular-nums">{s.active_memberships} active</p>
                <p className="text-muted-foreground tabular-nums">{fmtMoney(s.mrr_cents)} MRR</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/80 px-3 py-2 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Membership register</p>
          <Link href="/settings/payments" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
            Payments settings
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No memberships yet — cron + staff-created plans will appear here.</p>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/70">
                  <th className="py-1 pr-2">Number</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1 pr-2">Cadence</th>
                  <th className="py-1 pr-2">Amount</th>
                  <th className="py-1 pr-2">Next invoice</th>
                  <th className="py-1">Autopay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-1 pr-2 font-medium">{r.membership_number}</td>
                    <td className="py-1 pr-2">{formatBlitzpayUiLabel(r.status)}</td>
                    <td className="py-1 pr-2">{formatBlitzpayUiLabel(r.billing_frequency)}</td>
                    <td className="py-1 pr-2 tabular-nums">{fmtMoney(r.recurring_amount_cents)}</td>
                    <td className="py-1 pr-2">{r.next_invoice_at ? new Date(r.next_invoice_at).toLocaleDateString() : "—"}</td>
                    <td className="py-1">{r.auto_bill_enabled ? "On" : "Off"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
