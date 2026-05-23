"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthRevenueForecastTrendWindow } from "@/lib/growth/revenue-forecast-types"
import type { GrowthLead } from "@/lib/growth/types"

type DashboardPayload = {
  averageProbability: number
  commitCandidates: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  forecasted: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  revenueRegressionWatch: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  highAttention: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  fastestImproving: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  trend: Record<GrowthRevenueForecastTrendWindow, Array<{ label: string; averageProbability: number }>>
  tierCounts: Record<string, number>
  trajectoryCounts: Record<string, number>
}

function trajectoryTone(
  trajectory: string | null | undefined,
): "healthy" | "warning" | "neutral" {
  if (trajectory === "accelerating") return "healthy"
  if (trajectory === "slowing" || trajectory === "at_risk") return "warning"
  return "neutral"
}

function LeadBucket({
  title,
  leads,
  showTrajectory = false,
  showVolatility = false,
  warning = false,
}: {
  title: string
  leads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  showTrajectory?: boolean
  showVolatility?: boolean
  warning?: boolean
}) {
  return (
    <GrowthEngineCard title={title}>
      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads in this bucket.</p>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li
              key={lead.id}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                warning ? "border-amber-200 bg-amber-50/40" : "border-border"
              }`}
            >
              <div>
                <p className="font-medium">{lead.companyName}</p>
                {lead.revenueProbabilitySummary ? (
                  <p className="text-muted-foreground">{lead.revenueProbabilitySummary}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="tabular-nums font-semibold">{lead.revenueProbabilityScore ?? "—"}</span>
                {lead.revenueProbabilityTier ? (
                  <GrowthBadge label={lead.revenueProbabilityTier.replace(/_/g, " ")} tone="healthy" />
                ) : null}
                {showTrajectory && lead.revenueTrajectory ? (
                  <GrowthBadge label={lead.revenueTrajectory.replace(/_/g, " ")} tone={trajectoryTone(lead.revenueTrajectory)} />
                ) : null}
                {showVolatility && lead.revenueProbabilityVolatility != null ? (
                  <GrowthBadge label={`vol ${lead.revenueProbabilityVolatility}`} tone={trajectoryTone(lead.revenueTrajectory)} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthRevenueForecastDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [trendWindow, setTrendWindow] = useState<GrowthRevenueForecastTrendWindow>("7d")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/revenue/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load revenue forecast dashboard.")
      }
      setDashboard(data.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
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
        Loading revenue forecast dashboard…
      </div>
    )
  }

  if (error && !dashboard) {
    return <p className="text-sm text-rose-600">{error}</p>
  }

  if (!dashboard) return null

  const trend = dashboard.trend[trendWindow] ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={<TrendingUp className="size-3.5" />} label="Average probability" value={dashboard.averageProbability} />
          <StatTile label="Commit candidates" value={dashboard.tierCounts.commit_candidate ?? 0} />
          <StatTile label="Forecasted" value={dashboard.tierCounts.forecasted ?? 0} />
          <StatTile label="At risk trajectory" value={dashboard.trajectoryCounts.at_risk ?? 0} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Probability trend">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["7d", "30d", "90d"] as const).map((window) => (
            <Button
              key={window}
              type="button"
              size="sm"
              variant={trendWindow === window ? "default" : "outline"}
              onClick={() => setTrendWindow(window)}
            >
              {window}
            </Button>
          ))}
        </div>
        <div className="flex h-32 items-end gap-1">
          {trend.map((bucket) => {
            const max = Math.max(...trend.map((entry) => entry.averageProbability), 1)
            const height = Math.max(8, Math.round((bucket.averageProbability / max) * 100))
            return (
              <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-emerald-500/80"
                  style={{ height: `${height}%` }}
                  title={`Avg ${bucket.averageProbability}`}
                />
                <span className="truncate text-[10px] text-muted-foreground">{bucket.label.slice(5)}</span>
              </div>
            )
          })}
        </div>
      </GrowthEngineCard>

      <LeadBucket
        title="Revenue Regression Watch"
        leads={dashboard.revenueRegressionWatch}
        showTrajectory
        showVolatility
        warning
      />

      <LeadBucket title="High forecast attention" leads={dashboard.highAttention} showTrajectory />

      <div className="grid gap-4 xl:grid-cols-2">
        <LeadBucket title="Commit candidates" leads={dashboard.commitCandidates} showTrajectory />
        <LeadBucket title="Forecasted" leads={dashboard.forecasted} showTrajectory />
        <LeadBucket title="Fastest improving probability" leads={dashboard.fastestImproving} showTrajectory />
        <GrowthEngineCard title="Trajectory mix">
          <ul className="space-y-2 text-sm">
            {Object.entries(dashboard.trajectoryCounts).map(([key, count]) => (
              <li key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="capitalize">{key.replace(/_/g, " ")}</span>
                <span className="tabular-nums font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      </div>
    </div>
  )
}
