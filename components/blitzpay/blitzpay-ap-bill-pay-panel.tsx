"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileSpreadsheet, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

type VendorAgingBuckets = {
  currentDueCents: number
  days30Cents: number
  days60Cents: number
  days90Cents: number
  days120PlusCents: number
  totalOutstandingCents: number
}

type VendorAgingPayload = {
  asOfDate: string
  vendors: Array<{ vendorId: string; vendor_name?: string | null; buckets: VendorAgingBuckets }>
}

type ApHealthPayload = {
  generatedAt: string
  reporting: {
    accountsPayableOutstandingCents: number
    approvedBillsAwaitingPaymentCents: number
    overdueVendorBillsCents: number
    averageVendorPaymentDays: number | null
    vendorConcentrationRisk: number
    treasuryCoverageForPayables: number
    payableAgingHealthScore: number
  }
  treasuryOperatingCents: number
  treasuryCoveragePayablesBps: number
  vendorConcentrationRisk0to100: number
  payableAgingHealthScore0to100: number
  apCashOptimizationScore0to100: number
  upcomingPayables: Array<{
    id: string
    vendor_id: string
    vendor_name?: string | null
    bill_status: string
    due_date: string
    remaining_balance_cents: number
    total_cents: number
  }>
  approvalQueue: Array<{
    id: string
    vendor_id: string
    vendor_name?: string | null
    bill_status: string
    due_date: string
    remaining_balance_cents: number
    total_cents: number
  }>
  recentPayRuns: Array<{
    id: string
    run_reference: string
    run_status: string
    total_amount_cents: number
    scheduled_for: string | null
  }>
  notes: string[]
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

/** Bps from `computeTreasuryCoverageForPayablesBps`; high sentinel when no approved payables. */
function formatTreasuryCoverageVsApprovedBills(bps: number): string {
  if (bps >= 999_000) return "— (nothing approved waiting, or not applicable)"
  const approxPct = Math.min(999, Math.round(bps / 100))
  return `About ${approxPct}% of approved bills vs operating balance signal (estimate; not a bank balance)`
}

function billStatusLabel(status: string): string {
  switch (status) {
    case "pending_approval":
      return "Needs approval"
    case "approved":
      return "Approved"
    case "scheduled":
      return "On a pay run"
    case "partially_paid":
      return "Partially planned"
    case "draft":
      return "Draft"
    default:
      return formatBlitzpayUiLabel(status)
  }
}

function payRunStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft batch"
    case "scheduled":
      return "Scheduled"
    case "processing":
      return "Processing"
    case "completed":
      return "Completed"
    case "canceled":
      return "Canceled"
    default:
      return formatBlitzpayUiLabel(status)
  }
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayApBillPayPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aging, setAging] = useState<VendorAgingPayload | null>(null)
  const [health, setHealth] = useState<ApHealthPayload | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setAging(null)
      setHealth(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/ap`
      const [aRes, hRes] = await Promise.all([
        fetch(`${base}/vendor-aging`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/ap-health`, { cache: "no-store", credentials: "include" }),
      ])
      const [aJson, hJson] = await Promise.all([
        aRes.json().catch(() => null) as Promise<{ vendorAging?: VendorAgingPayload } | null>,
        hRes.json().catch(() => null) as Promise<{ apHealth?: ApHealthPayload } | null>,
      ])
      if (!aRes.ok || !hRes.ok) {
        setAging(null)
        setHealth(null)
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      setAging(aJson?.vendorAging ?? null)
      setHealth(hJson?.apHealth ?? null)
    } catch {
      setAging(null)
      setHealth(null)
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  const agingTotals = useMemo(() => {
    if (!aging?.vendors?.length) {
      return {
        current: 0,
        d30: 0,
        d60: 0,
        d90: 0,
        d120: 0,
        total: 0,
      }
    }
    let current = 0
    let d30 = 0
    let d60 = 0
    let d90 = 0
    let d120 = 0
    let total = 0
    for (const v of aging.vendors) {
      const b = v.buckets
      current += b.currentDueCents
      d30 += b.days30Cents
      d60 += b.days60Cents
      d90 += b.days90Cents
      d120 += b.days120PlusCents
      total += b.totalOutstandingCents
    }
    return { current, d30, d60, d90, d120, total }
  }, [aging])

  const topSpend = useMemo(() => {
    if (!aging?.vendors?.length) return []
    return [...aging.vendors]
      .sort((a, b) => b.buckets.totalOutstandingCents - a.buckets.totalOutstandingCents)
      .slice(0, 6)
  }, [aging])

  if (!organizationId || !orgReady) return null

  const conc = health?.vendorConcentrationRisk0to100 ?? 0
  const concNote =
    conc >= 55 ? "A large share of open vendor bills sits with one supplier — worth a quick review." : null

  return (
    <div
      id="blitzpay-ap-bill-pay-anchor"
      className="rounded-xl border border-border bg-white dark:bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] min-w-0 max-w-full overflow-x-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileSpreadsheet className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Vendor bills & pay planning</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Track what you owe suppliers, who needs to sign off, and how pay runs line up with cash — planning only;
              nothing here sends money by itself.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}
      {loading && !health ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}

      {health ? (
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            Snapshot {new Date(health.generatedAt).toLocaleString()}
            {aging ? ` · Vendor aging as-of ${aging.asOfDate} (UTC date)` : null}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Open vendor bills</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(health.reporting.accountsPayableOutstandingCents)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Approved, not yet paid</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(health.reporting.approvedBillsAwaitingPaymentCents)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Past due (open)</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(health.reporting.overdueVendorBillsCents)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg pay timing (recent)</p>
              <p className="text-sm font-semibold tabular-nums mt-1">
                {health.reporting.averageVendorPaymentDays == null ? "—" : `${health.reporting.averageVendorPaymentDays} days after due`}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Treasury vs payables</p>
              <p className="text-sm font-semibold tabular-nums mt-1 leading-snug">
                {formatTreasuryCoverageVsApprovedBills(health.treasuryCoveragePayablesBps)}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Payable aging comfort</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{health.payableAgingHealthScore0to100}/100</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Cash timing score</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{health.apCashOptimizationScore0to100}/100</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Top vendor share (open)</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{health.vendorConcentrationRisk0to100}/100</p>
            </div>
          </div>

          {concNote ? (
            <p className="text-sm text-[color:var(--status-warning)] leading-relaxed rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
              {concNote}
            </p>
          ) : null}

          {aging && aging.vendors.length > 0 ? (
            <div className="rounded-lg border border-border/70 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor aging (summary)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">Current / not past due</p>
                  <p className="font-semibold tabular-nums">{fmtMoney(agingTotals.current)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">1–30 days</p>
                  <p className="font-semibold tabular-nums">{fmtMoney(agingTotals.d30)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">31–60</p>
                  <p className="font-semibold tabular-nums">{fmtMoney(agingTotals.d60)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">61–90</p>
                  <p className="font-semibold tabular-nums">{fmtMoney(agingTotals.d90)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">90+</p>
                  <p className="font-semibold tabular-nums">{fmtMoney(agingTotals.d120)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Total (capped list)</p>
                  <p className="font-semibold tabular-nums">{fmtMoney(agingTotals.total)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {topSpend.length > 0 ? (
            <details className="rounded-lg border border-border/70 px-4 py-3">
              <summary className="text-sm font-medium cursor-pointer text-foreground">Vendor spend snapshot (open balances)</summary>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {topSpend.map((v) => (
                  <li key={v.vendorId} className="flex justify-between gap-2 min-w-0">
                    <span className="min-w-0 break-words text-foreground">{v.vendor_name ?? "Vendor"}</span>
                    <span className="shrink-0 tabular-nums font-medium">{fmtMoney(v.buckets.totalOutstandingCents)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/70 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs your approval</p>
              {health.approvalQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing waiting in the approval queue right now.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {health.approvalQueue.map((b) => (
                    <li key={b.id} className="flex flex-wrap justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <span className="font-medium text-foreground">{b.vendor_name ?? "Vendor"}</span>
                      <span className="tabular-nums text-muted-foreground">
                        Due {b.due_date.slice(0, 10)} · {fmtMoney(b.remaining_balance_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-border/70 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming payables</p>
              {health.upcomingPayables.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approved or scheduled vendor bills with a balance in this window.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {health.upcomingPayables.map((b) => (
                    <li key={b.id} className="flex flex-wrap justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <span className="font-medium text-foreground">{b.vendor_name ?? "Vendor"}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {billStatusLabel(b.bill_status)} · {fmtMoney(b.remaining_balance_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/70 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent pay runs (orchestration)</p>
            {health.recentPayRuns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pay runs yet — create one when you are ready to batch planned payments.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {health.recentPayRuns.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2">
                    <span className="text-muted-foreground">Planned batch</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {payRunStatusLabel(r.run_status)} · {fmtMoney(r.total_amount_cents)}
                      {r.scheduled_for ? ` · target ${r.scheduled_for.slice(0, 10)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <ul className="text-xs text-muted-foreground space-y-1 leading-relaxed list-disc pl-5">
            {health.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
