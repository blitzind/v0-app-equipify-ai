"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import { GrowthRevenueAttributionRecommendationsSection } from "@/components/growth/growth-revenue-attribution-recommendations"
import {
  attributionModelLabel,
  GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER,
  type GrowthAttributionDimensionRow,
  type GrowthAttributionModel,
  type GrowthRevenueAttributionDashboard,
} from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value,
  )
}

function formatPct(value: number | null): string {
  if (value == null) return "—"
  return `${value.toFixed(1)}%`
}

function DimensionTable({ title, rows }: { title: string; rows: GrowthAttributionDimensionRow[] }) {
  return (
    <GrowthEngineCard title={title}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Touches</th>
              <th className="py-2 pr-3">Leads</th>
              <th className="py-2 pr-3">Wins</th>
              <th className="py-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-muted-foreground">
                  No data in range.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium">{row.label}</td>
                  <td className="py-2 pr-3">{row.touchCount}</td>
                  <td className="py-2 pr-3">{row.leadCount}</td>
                  <td className="py-2 pr-3">{row.wins}</td>
                  <td className="py-2">{formatCurrency(row.attributedRevenue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </GrowthEngineCard>
  )
}

export function GrowthRevenueAttributionDashboardView() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthRevenueAttributionDashboard | null>(null)
  const [attributionModel, setAttributionModel] = useState<GrowthAttributionModel>("first_touch")
  const [channel, setChannel] = useState("")
  const [repUserId, setRepUserId] = useState("")
  const [sequenceId, setSequenceId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ attribution_model: attributionModel })
      if (channel.trim()) params.set("channel", channel.trim())
      if (repUserId.trim()) params.set("rep_user_id", repUserId.trim())
      if (sequenceId.trim()) params.set("sequence_id", sequenceId.trim())

      const response = await fetch(`/api/platform/growth/revenue-attribution/dashboard?${params}`, {
        cache: "no-store",
      })
      const payload = (await response.json()) as {
        ok?: boolean
        dashboard?: GrowthRevenueAttributionDashboard
        message?: string
      }
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load revenue attribution dashboard.")
      }
      setDashboard(payload.dashboard)
      setAttributionModel(payload.dashboard.attributionModel)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load dashboard.")
    } finally {
      setLoading(false)
    }
  }, [attributionModel, channel, repUserId, sequenceId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading revenue attribution…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER}</p>
          <p className="text-sm text-muted-foreground mt-1">
            Unified reporting from attribution_touches and attribution_paths (6.32B-1 ledger).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <GrowthEngineCard title="Filters & attribution model">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Model</label>
            <div className="flex gap-2">
              {(["first_touch", "last_touch", "linear", "time_decay"] as const).map((model) => (
                <Button
                  key={model}
                  size="sm"
                  variant={attributionModel === model ? "default" : "outline"}
                  onClick={() => setAttributionModel(model)}
                >
                  {attributionModelLabel(model)}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Channel</label>
            <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="email" className="w-28" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Rep user ID</label>
            <Input
              value={repUserId}
              onChange={(e) => setRepUserId(e.target.value)}
              placeholder="UUID"
              className="w-48"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Sequence ID</label>
            <Input
              value={sequenceId}
              onChange={(e) => setSequenceId(e.target.value)}
              placeholder="UUID"
              className="w-48"
            />
          </div>
          <Button size="sm" onClick={() => void load()}>
            Apply
          </Button>
        </div>
        {dashboard ? (
          <p className="text-xs text-muted-foreground mt-3">
            {dashboard.touchesAnalyzed} touches · {dashboard.pathsIndexed} paths ·{" "}
            {attributionModelLabel(dashboard.attributionModel)} ·{" "}
            {new Date(dashboard.filters.dateFrom).toLocaleDateString()} –{" "}
            {new Date(dashboard.filters.dateTo).toLocaleDateString()}
          </p>
        ) : null}
      </GrowthEngineCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Pipeline revenue" value={formatCurrency(dashboard?.revenue.pipelineRevenue ?? 0)} />
        <StatTile label="Closed won" value={formatCurrency(dashboard?.revenue.closedWonRevenue ?? 0)} />
        <StatTile label="Attributed revenue" value={formatCurrency(dashboard?.revenue.attributedRevenue ?? 0)} />
        <StatTile label="Avg deal size" value={formatCurrency(dashboard?.revenue.averageDealSize ?? 0)} />
        <StatTile label="Win rate" value={formatPct(dashboard?.revenue.winRatePct ?? 0)} />
        <StatTile label="Wins / Opps" value={`${dashboard?.revenue.winCount ?? 0} / ${dashboard?.revenue.opportunityCount ?? 0}`} />
      </div>

      <GrowthEngineCard title="Conversion funnel">
        <div className="grid gap-3 sm:grid-cols-5">
          {(dashboard?.funnel ?? []).map((step) => (
            <div key={step.stage} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs text-muted-foreground">{step.label}</p>
              <p className="text-2xl font-semibold mt-1">{step.count}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {step.conversionRatePct != null ? `${step.conversionRatePct}% conv.` : "—"}
              </p>
              {step.revenue > 0 ? (
                <p className="text-xs font-medium mt-1">{formatCurrency(step.revenue)}</p>
              ) : null}
            </div>
          ))}
        </div>
      </GrowthEngineCard>

      <GrowthRevenueAttributionRecommendationsSection
        attributionModel={attributionModel}
        channel={channel}
        repUserId={repUserId}
        sequenceId={sequenceId}
      />

      <GrowthEngineCard title="Top performers">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Campaigns</p>
            <ul className="text-sm space-y-1">
              {(dashboard?.topPerformers.campaigns ?? []).map((r) => (
                <li key={r.key} className="flex justify-between gap-2">
                  <span>{r.label}</span>
                  <span className="tabular-nums">{formatCurrency(r.attributedRevenue)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Sequences</p>
            <ul className="text-sm space-y-1">
              {(dashboard?.topPerformers.sequences ?? []).map((r) => (
                <li key={r.key} className="flex justify-between gap-2">
                  <span>{r.label}</span>
                  <span className="tabular-nums">{formatCurrency(r.attributedRevenue)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Reps</p>
            <ul className="text-sm space-y-1">
              {(dashboard?.topPerformers.reps ?? []).map((r) => (
                <li key={r.key} className="flex justify-between gap-2">
                  <span className="font-mono text-xs">{r.label}</span>
                  <span className="tabular-nums">{formatCurrency(r.attributedRevenue)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Sender mailboxes</p>
            <ul className="text-sm space-y-1">
              {(dashboard?.topPerformers.senderMailboxes ?? []).map((r) => (
                <li key={r.key} className="flex justify-between gap-2">
                  <span>{r.label}</span>
                  <span className="tabular-nums">{formatCurrency(r.attributedRevenue)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GrowthEngineCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DimensionTable title="Revenue by channel" rows={dashboard?.byChannel ?? []} />
        <DimensionTable title="Revenue by lead source" rows={dashboard?.byLeadSource ?? []} />
        <DimensionTable title="Revenue by sequence" rows={dashboard?.bySequence ?? []} />
        <DimensionTable title="Revenue by sequence step" rows={dashboard?.bySequenceStep ?? []} />
        <DimensionTable title="Revenue by campaign" rows={dashboard?.byCampaign ?? []} />
        <DimensionTable title="Revenue by industry" rows={dashboard?.byIndustry ?? []} />
        <DimensionTable title="Revenue by rep" rows={dashboard?.byRep ?? []} />
        <DimensionTable title="Revenue by sender mailbox" rows={dashboard?.bySenderMailbox ?? []} />
      </div>

      {dashboard?.touchVolumeByType.length ? (
        <GrowthEngineCard title="Touch volume by type">
          <div className="flex flex-wrap gap-2">
            {dashboard.touchVolumeByType.map((item) => (
              <GrowthBadge key={item.touchType} label={`${item.touchType}: ${item.count}`} tone="neutral" />
            ))}
          </div>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
