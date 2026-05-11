"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, BarChart3, Info, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type IntelligencePayload = {
  reportingWindowDays: number
  reportingSource: "balance_transactions" | "estimate"
  dashboard: {
    grossCollectedWindowCents: number
    netCollectedWindowCents: number
    refundedVolumeWindowCents: number
    pendingPayoutsCents: number
    openDisputesCount: number
    openDisputesAmountCents: number
    walletLiabilityCents: number
    depositsCollectedWindowCents: number
    overdueCollectibleCents: number
    overdueInvoiceCount: number
    scheduledFuturePaymentsCents: number
    activeInstallmentPlansCount: number
    abandonedCheckoutInvoices: number
    paymentLinksCreatedWindowCount: number
    workOrderCollectPaymentLinksWindowCount: number
    openRecoveryCasesCount: number
    treasuryEstimateUpcomingTransferCents?: number
  }
  forecasts: {
    next7DaysExpectedCents: number
    next30DaysExpectedCents: number
    next60DaysExpectedCents: number
    achPendingSettlementCents: number
    overdueRecoveryExpectedCents: number
  }
  collections: {
    reminderEffectivenessRatePct: number
    averagePaymentDelayDays: number | null
    recoveredRevenueCents: number
    abandonedCheckoutInvoices: number
    paymentLinksCreatedWindowCount: number
    workOrderCollectPaymentLinksWindowCount: number
    openRecoveryCasesCount: number
    portalCompletedAttemptsWindow: number
    staffCompletedAttemptsWindow: number
  }
  recommendations: Array<{ id: string; title: string; detail: string; severity: "info" | "warning" }>
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayRevenueIntelligencePanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<IntelligencePayload | null>(null)
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
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/revenue-intelligence?windowDays=30`,
        { cache: "no-store", credentials: "include" },
      )
      const j = (await res.json()) as { intelligence?: IntelligencePayload; message?: string }
      if (!res.ok) {
        setData(null)
        setError(typeof j.message === "string" ? j.message : "Could not load revenue intelligence.")
        return
      }
      setData(j.intelligence ?? null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  return (
    <div id="blitzpay-revenue-intelligence" className="rounded-lg border border-border bg-muted/10 px-3 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <p className="text-xs font-semibold">BlitzPay revenue intelligence</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Refresh
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Rolling {data?.reportingWindowDays ?? 30}-day window where noted. Reporting source:{" "}
        <span className="font-medium text-foreground">{data?.reportingSource === "balance_transactions" ? "Stripe ledger" : "Estimated"}</span>
        .
      </p>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {loading && !data ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading…
        </p>
      ) : null}
      {data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <Metric label="Gross collected (window)" value={fmtMoney(data.dashboard.grossCollectedWindowCents)} />
            <Metric label="Net collected (window)" value={fmtMoney(data.dashboard.netCollectedWindowCents)} />
            <Metric label="Refunds (window)" value={fmtMoney(data.dashboard.refundedVolumeWindowCents)} />
            <Metric label="Pending payouts" value={fmtMoney(data.dashboard.pendingPayoutsCents)} />
            <Metric
              label="Upcoming transfer (est.)"
              value={fmtMoney(data.dashboard.treasuryEstimateUpcomingTransferCents ?? 0)}
            />
            <Metric
              label="Open disputes"
              value={`${data.dashboard.openDisputesCount} · ${fmtMoney(data.dashboard.openDisputesAmountCents)}`}
            />
            <Metric label="Wallet liability" value={fmtMoney(data.dashboard.walletLiabilityCents)} />
            <Metric label="Deposits collected (window)" value={fmtMoney(data.dashboard.depositsCollectedWindowCents)} />
            <Metric
              label="Overdue collectible"
              value={`${data.dashboard.overdueInvoiceCount} inv · ${fmtMoney(data.dashboard.overdueCollectibleCents)}`}
            />
            <Metric label="Scheduled (future)" value={fmtMoney(data.dashboard.scheduledFuturePaymentsCents)} />
            <Metric label="Active installment plans" value={String(data.dashboard.activeInstallmentPlansCount)} />
            <Metric label="Abandoned checkouts" value={String(data.dashboard.abandonedCheckoutInvoices)} />
            <Metric label="Payment links (window)" value={String(data.dashboard.paymentLinksCreatedWindowCount)} />
            <Metric label="Work-order collect links" value={String(data.dashboard.workOrderCollectPaymentLinksWindowCount)} />
            <Metric label="Open recovery cases" value={String(data.dashboard.openRecoveryCasesCount)} />
          </div>

          <div className="rounded-md border border-border/70 bg-background/60 px-2 py-2 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expected collections (forecast)</p>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <Metric label="Next 7 days" value={fmtMoney(data.forecasts.next7DaysExpectedCents)} />
              <Metric label="Next 30 days" value={fmtMoney(data.forecasts.next30DaysExpectedCents)} />
              <Metric label="Next 60 days" value={fmtMoney(data.forecasts.next60DaysExpectedCents)} />
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Includes scheduled payments, installment targets, a conservative overdue recovery estimate, and estimate-deposit pipeline (7d uses a fraction of pipeline). ACH still settling:{" "}
              <span className="font-medium text-foreground">{fmtMoney(data.forecasts.achPendingSettlementCents)}</span>{" "}
              (cash timing, not double-counted in gross).
            </p>
          </div>

          <div className="rounded-md border border-border/70 bg-background/60 px-2 py-2 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Collections performance</p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              <li>Reminder effectiveness: {data.collections.reminderEffectivenessRatePct.toFixed(1)}% sent vs rows</li>
              <li>
                Avg days to payment (invoices with due + paid):{" "}
                {data.collections.averagePaymentDelayDays != null ? `${data.collections.averagePaymentDelayDays} d` : "—"}
              </li>
              <li>Overdue-then-paid revenue (proxy): {fmtMoney(data.collections.recoveredRevenueCents)}</li>
              <li>Abandoned checkout invoices: {data.collections.abandonedCheckoutInvoices}</li>
              <li>
                Completed attempts — portal: {data.collections.portalCompletedAttemptsWindow}, staff:{" "}
                {data.collections.staffCompletedAttemptsWindow}
              </li>
            </ul>
          </div>

          {data.recommendations.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" aria-hidden />
                Insights
              </p>
              <ul className="space-y-1.5">
                {data.recommendations.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      "rounded-md border px-2 py-1.5 text-[11px] leading-snug",
                      r.severity === "warning" ? "border-amber-500/40 bg-amber-500/5" : "border-border/80 bg-muted/20",
                    )}
                  >
                    <span className="font-medium text-foreground flex items-center gap-1">
                      {r.severity === "warning" ? (
                        <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" aria-hidden />
                      ) : (
                        <Info className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden />
                      )}
                      {r.title}
                    </span>
                    <span className="text-muted-foreground"> {r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-background/80 px-2 py-1">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
      <p className="text-[11px] font-medium text-foreground tabular-nums">{value}</p>
    </div>
  )
}
