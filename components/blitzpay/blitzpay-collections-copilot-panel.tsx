"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardList, Loader2, RefreshCw, Target } from "lucide-react"
import type { BlitzpayCollectionsCopilotPayload } from "@/lib/blitzpay/blitzpay-collections-copilot-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayCollectionsCopilotPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<BlitzpayCollectionsCopilotPayload | null>(null)
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
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/collections-copilot?windowDays=30`,
        { cache: "no-store", credentials: "include" },
      )
      const j = (await res.json()) as { collectionsCopilot?: BlitzpayCollectionsCopilotPayload; message?: string }
      if (!res.ok) {
        setData(null)
        setError(typeof j.message === "string" ? j.message : "Could not load collections copilot.")
        return
      }
      setData(j.collectionsCopilot ?? null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  const topRisk = data?.priorityQueue.slice(0, 5) ?? []

  return (
    <div
      id="blitzpay-collections-copilot-anchor"
      className={cn(
        "rounded-xl border border-border bg-card px-3 py-4 sm:px-5 sm:py-5 space-y-4",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-semibold">Collections copilot</p>
            <p className="text-[10px] text-muted-foreground">
              Deterministic cash acceleration — no AI, bounded reads, staff-only. No raw payment processor identifiers.
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
              <Link href="/invoices?status=Overdue">Open overdue invoices</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="h-7 text-[11px]">
              <Link href="/work-orders">Work orders</Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="h-7 text-[11px]">
              <Link href="/communications">Communications</Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold">Highest-risk overdue invoices</p>
              <ul className="text-[11px] text-muted-foreground space-y-1.5">
                {topRisk.length === 0 ? <li>No overdue balances in the bounded priority sample.</li> : null}
                {topRisk.map((r) => (
                  <li key={r.invoiceId} className="leading-snug">
                    <span className="text-foreground font-medium">Urgency {r.urgencyScore}</span> · {fmtMoney(r.balanceDueCents)}{" "}
                    · {r.daysPastDue}d past due · {r.collectionLikelihood} likelihood
                    <span className="block text-[10px] mt-0.5">{r.recommendedAction}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold">Technician collection opportunities</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>Field recovery rate (share of overdue): {data.technicianCollections.fieldCollectionRecoveryRatePct}%</li>
                <li>Upcoming visit opportunities: {data.technicianCollections.workOrdersWithCollectibleBalancesCount} work order(s)</li>
                {data.technicianCollections.leaderboard.map((row) => (
                  <li key={row.rank}>
                    #{row.rank} {row.displayName}: {fmtMoney(row.windowCollectedCents)} collected (sample {row.attributedInvoiceSample} invoices)
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
            <p className="text-[11px] font-semibold">Customer cohort signals</p>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              {data.customerBehaviorSegments.map((s) => (
                <li key={s.segment}>
                  <span className="text-foreground capitalize">{s.segment.replace(/_/g, " ")}</span> (~{s.countApprox}) — {s.note}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground border-t border-border pt-2 mt-2">
              Behavior profile: avg days to pay {data.customerPaymentBehaviorProfile.averageDaysToPayWhenPaid ?? "—"}, late rate{" "}
              {data.customerPaymentBehaviorProfile.latePaymentRatePct}%, responsiveness score{" "}
              {data.customerPaymentBehaviorProfile.responsivenessScore}/100, ACH mix hint:{" "}
              {data.customerPaymentBehaviorProfile.achVsCardHint}.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold">ACH &amp; installments</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>ACH acceleration opportunity (heuristic): {fmtMoney(data.acceleration.achAccelerationOpportunityCents)}</li>
                <li>Installment conversion opportunity (heuristic): {fmtMoney(data.acceleration.installmentConversionOpportunityCents)}</li>
              </ul>
            </div>
            <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold">Recovery forecast</p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>Estimated recoverable overdue: {fmtMoney(data.recoveryForecasts.estimatedRecoverableOverdueCents)}</li>
                <li>Likely field-collectible (14d window): {fmtMoney(data.recoveryForecasts.likelyFieldCollectibleCents)}</li>
                <li>Next-14d scheduled field opportunity: {fmtMoney(data.recoveryForecasts.next14dScheduledFieldOpportunityCents)}</li>
              </ul>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
            <p className="text-[11px] font-semibold flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Suggested next actions
            </p>
            <ul className="text-[11px] space-y-1 list-disc pl-4 text-foreground/90">
              {data.recommendations.map((r) => (
                <li key={r.id} className={r.severity === "warning" ? "text-[color:var(--status-warning)]" : ""}>
                  {r.message}
                </li>
              ))}
              {data.automationInsights.map((r) => (
                <li key={r.id} className={r.severity === "warning" ? "text-[color:var(--status-warning)]" : ""}>
                  {r.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
