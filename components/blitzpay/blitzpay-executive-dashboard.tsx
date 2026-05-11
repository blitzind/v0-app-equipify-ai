"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, Gauge, Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react"
import type { BlitzpayBusinessHealthPayload } from "@/lib/blitzpay/blitzpay-business-health-types"
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
    <div className="rounded-lg border border-border bg-card/60 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", tone)}>{v}</p>
      <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
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
      const j = (await res.json()) as { businessHealth?: BlitzpayBusinessHealthPayload; message?: string }
      if (!res.ok) {
        setData(null)
        setError(typeof j.message === "string" ? j.message : "Could not load business health.")
        return
      }
      setData(j.businessHealth ?? null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  return (
    <div className="rounded-lg border border-border bg-muted/10 px-3 py-3 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-semibold">Executive business health</p>
            <p className="text-[10px] text-muted-foreground">
              Deterministic BlitzPay + Equipify signals — no AI, no customer portal data, no payment identifiers.
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ScoreRing label="Overall" value={data.scores.overall} />
            <ScoreRing label="Financial" value={data.scores.financial} />
            <ScoreRing label="Collections" value={data.scores.collections} />
            <ScoreRing label="Operations" value={data.scores.operationalEfficiency} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <ScoreRing label="Cash pressure" value={data.scores.cashFlowPressure} />
            <ScoreRing label="Concentration risk" value={data.scores.customerConcentrationRisk} />
            <ScoreRing label="Profit confidence" value={data.scores.serviceProfitabilityConfidence} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Financial pressure & velocity
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>30-day net cash outlook: {fmtMoney(data.facts.netCashPosition30Cents)}</li>
                <li>Overdue AR (collectible): {fmtMoney(data.facts.overdueCollectibleCents)} across {data.facts.overdueInvoiceCount} invoice(s)</li>
                <li>Gross collected ({data.reportingWindowDays}d): {fmtMoney(data.facts.grossCollectedWindowCents)}</li>
                <li>
                  Payout timing (avg delay):{" "}
                  {data.facts.treasuryAveragePayoutDelayDays == null ? "—" : `${data.facts.treasuryAveragePayoutDelayDays}d`}
                </li>
              </ul>
            </div>
            <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Collections & disputes
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>Reminder dispatch success: {data.facts.reminderEffectivenessRatePct}%</li>
                <li>Open disputes: {data.facts.openDisputesCount} ({fmtMoney(data.facts.openDisputesAmountCents)})</li>
                <li>Refunds (window): {fmtMoney(data.facts.refundedVolumeWindowCents)}</li>
                <li>Recovery volume tagged late-paid: {fmtMoney(data.facts.recoveredRevenueCents)}</li>
              </ul>
            </div>
          </div>

          <div className="rounded-md border border-border bg-background/60 p-3 space-y-2">
            <p className="text-[11px] font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Customer payment signals (aggregated)
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
              <li>Deposit policy signal: {data.customerSignals.likelyDepositBenefit}</li>
              <li>Financing fit signal: {data.customerSignals.likelyFinancingBenefit}</li>
              <li>On-time pattern: {data.customerSignals.trustSignal}</li>
              <li>Risk posture: {data.customerSignals.riskSignal}</li>
              {data.customerSignals.summaryLines.map((s) => (
                <li key={s.slice(0, 80)}>{s}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 space-y-2">
              <p className="text-[11px] font-semibold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                <AlertTriangle className="w-3.5 h-3.5" /> Operational bottlenecks
              </p>
              <ul className="text-[11px] space-y-1 list-disc pl-4 text-foreground/90">
                {data.pipeline.operationalLeakageNotes.length === 0 ? <li>No major leakage flags in the bounded sample.</li> : null}
                {data.pipeline.operationalLeakageNotes.map((s) => (
                  <li key={s.slice(0, 100)}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-sky-500/25 bg-sky-500/5 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-sky-950 dark:text-sky-50">Cash acceleration ideas</p>
              <ul className="text-[11px] space-y-1 list-disc pl-4 text-foreground/90">
                {[...data.pipeline.cashAccelerationOpportunities, ...data.growthOpportunities].slice(0, 12).map((s) => (
                  <li key={s.slice(0, 100)}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-destructive">Top risks</p>
              <ul className="text-[11px] list-disc pl-4 space-y-1">
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
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-primary">Top opportunities</p>
              <ul className="text-[11px] list-disc pl-4 space-y-1 text-foreground/90">
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

          <p className="text-[10px] text-muted-foreground">
            Sample windows: technician revenue attribution {data.facts.technicianInvoiceAttributionSample} paid invoice(s); completed job
            mix sample {data.facts.completedJobsAttributionSample} work order(s); completed-without-invoice sample {data.facts.completedWoScanned}{" "}
            work order(s).
          </p>
        </div>
      ) : null}
    </div>
  )
}
