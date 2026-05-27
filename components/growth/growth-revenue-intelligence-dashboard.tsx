"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { BarChart3, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER,
  performanceTrendLabel,
  type GrowthPerformanceTrend,
  type GrowthRevenueIntelligenceDashboard,
  type GrowthTrendPoint,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"

const TREND_TONE: Record<GrowthPerformanceTrend, "healthy" | "attention" | "critical" | "neutral" | "medium"> = {
  improving: "healthy",
  stable: "neutral",
  declining: "attention",
  critical: "critical",
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function TrendChart({ title, series }: { title: string; series: GrowthTrendPoint[] }) {
  const max = Math.max(...series.map((point) => point.value), 1)
  return (
    <GrowthEngineCard title={title}>
      {series.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trend data yet.</p>
      ) : (
        <div className="space-y-2">
          {series.map((point) => (
            <div key={point.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{point.label}</span>
                <span className="tabular-nums">{point.value.toFixed(1)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${Math.max(4, (point.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </GrowthEngineCard>
  )
}

type DashboardPayload = {
  ok?: boolean
  dashboard?: GrowthRevenueIntelligenceDashboard
  message?: string
}

export function GrowthRevenueIntelligenceDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthRevenueIntelligenceDashboard | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/intelligence/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as DashboardPayload
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load revenue intelligence dashboard.")
      }
      setDashboard(payload.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load revenue intelligence dashboard.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading revenue intelligence…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <GrowthBadge label={GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_QA_MARKER} tone="neutral" />
          <p className="text-xs text-muted-foreground">{GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_PRIVACY_NOTE}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/experiments">Experiments</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/admin/growth/sequences/execution">Sequence Execution</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <GrowthEngineCard title="Performance Intelligence" icon={<BarChart3 className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Revenue Influenced" value={formatCurrency(dashboard?.revenueInfluenced ?? 0)} />
          <StatTile label="Meetings Generated" value={String(dashboard?.meetingsGenerated ?? 0)} />
          <StatTile label="Pipeline Created" value={formatCurrency(dashboard?.pipelineCreated ?? 0)} />
          <StatTile
            label="Reply Trend"
            value={performanceTrendLabel(dashboard?.replyTrend ?? "stable")}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile label="Sender Health" value={String(dashboard?.senderHealthScore ?? 0)} />
          <StatTile label="Provider Health" value={String(dashboard?.providerHealthScore ?? 0)} />
          <StatTile label="Risk Alerts" value={String(dashboard?.riskAlerts.length ?? 0)} />
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Risk Alerts">
          {(dashboard?.riskAlerts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No active risk alerts.</p>
          ) : (
            <div className="space-y-2">
              {(dashboard?.riskAlerts ?? []).map((alert, index) => (
                <div key={`${alert.riskType}-${index}`} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-muted-foreground">{alert.description}</p>
                    </div>
                    <GrowthBadge label={alert.severity} tone={alert.severity === "critical" ? "critical" : "attention"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Top Sequences">
          {(dashboard?.topSequences ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No sequence performance snapshots yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Sequence</th>
                    <th className="px-2 py-2 font-medium">Sent</th>
                    <th className="px-2 py-2 font-medium">Reply %</th>
                    <th className="px-2 py-2 font-medium">Meeting %</th>
                    <th className="px-2 py-2 font-medium">Revenue</th>
                    <th className="px-2 py-2 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard?.topSequences ?? []).map((row) => (
                    <tr key={`${row.sequenceId ?? "none"}-${row.sequenceLabel}`} className="border-b border-border/70">
                      <td className="px-2 py-3 font-medium">{row.sequenceLabel}</td>
                      <td className="px-2 py-3 tabular-nums">{row.sent}</td>
                      <td className="px-2 py-3 tabular-nums">{formatPct(row.replyPct)}</td>
                      <td className="px-2 py-3 tabular-nums">{formatPct(row.meetingPct)}</td>
                      <td className="px-2 py-3 tabular-nums">{formatCurrency(row.revenue)}</td>
                      <td className="px-2 py-3">
                        <GrowthBadge label={performanceTrendLabel(row.trend)} tone={TREND_TONE[row.trend]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Variant Lift Visibility">
        {(dashboard?.variantLift ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No experiment lift data yet.</p>
        ) : (
          <div className="space-y-2">
            {(dashboard?.variantLift ?? []).map((row) => (
              <div key={row.experimentId} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{row.experimentName}</p>
                  <p className="text-muted-foreground">{row.variantLabel}</p>
                </div>
                <div className="text-right">
                  <GrowthBadge
                    label={row.liftPct != null ? `${formatPct(row.liftPct)} lift` : "—"}
                    tone={row.liftPct != null && row.liftPct > 0 ? "healthy" : "neutral"}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Reply {formatPct(row.replyPct)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <TrendChart title="Reply Trend" series={dashboard?.replyTrendSeries ?? []} />
        <TrendChart title="Meeting Trend" series={dashboard?.meetingTrendSeries ?? []} />
        <TrendChart title="Revenue Attribution" series={dashboard?.revenueAttributionSeries ?? []} />
        <TrendChart title="Provider Performance" series={dashboard?.providerPerformanceSeries ?? []} />
        <TrendChart title="Sender Performance" series={dashboard?.senderPerformanceSeries ?? []} />
      </div>

      <GrowthEngineCard title="Sequence Funnel">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(dashboard?.sequenceFunnel ?? []).map((step) => (
            <div key={step.label} className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="font-medium">{step.label}</p>
              <p className="text-2xl font-semibold tabular-nums">{step.count}</p>
              <p className="text-xs text-muted-foreground">{step.ratePct != null ? formatPct(step.ratePct) : "—"}</p>
            </div>
          ))}
        </div>
      </GrowthEngineCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <GrowthEngineCard title="Recent Revenue Attribution">
          {(dashboard?.recentAttributionEvents ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No attribution events yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(dashboard?.recentAttributionEvents ?? []).map((event) => (
                <li key={event.id} className="rounded-lg border border-border px-3 py-2">
                  <p className="font-medium">{event.eventType.replace(/_/g, " ")}</p>
                  <p className="text-muted-foreground">
                    {event.attributionType} · {formatCurrency(event.weightedAmount + event.revenueAmount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Intelligence Events">
          {(dashboard?.recentIntelligenceEvents ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No intelligence events yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(dashboard?.recentIntelligenceEvents ?? []).map((event) => (
                <li key={event.id} className="rounded-lg border border-border px-3 py-2">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-muted-foreground">{event.description}</p>
                </li>
              ))}
            </ul>
          )}
        </GrowthEngineCard>
      </div>
    </div>
  )
}
