"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthOperationalCapacityTrendWindow } from "@/lib/growth/operational-capacity-types"
import type { GrowthLead } from "@/lib/growth/types"

type DashboardPayload = {
  averageCapacityScore: number
  averagePressureLevel: number
  protectedPipelineCoverage: number
  platformSnapshot: {
    executiveNowCount: number
    callQueueLoadCount: number
    openFollowUpCount: number
    interventionBacklogCount: number
    interventionAgingCount: number
    interventionStalledCount: number
    leadershipBottleneckCount: number
    decisionMakerBacklogCount: number
    manualTouchBacklogCount: number
  }
  tierCounts: Record<string, number>
  recoveryDirectionCounts: Record<string, number>
  constraintDistribution: Record<string, number>
  leadershipLoad: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  interventionLoad: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  operationalRisk: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  executionProtection: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  capacityAtRisk: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  trend: Record<GrowthOperationalCapacityTrendWindow, Array<{ label: string; averagePressure: number }>>
}

function tierTone(tier: string | null | undefined): "healthy" | "warning" | "neutral" {
  if (tier === "healthy") return "healthy"
  if (tier === "strained") return "neutral"
  return "warning"
}

function LeadBucket({
  title,
  leads,
  showTier = false,
  showPressure = false,
  warning = false,
}: {
  title: string
  leads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  showTier?: boolean
  showPressure?: boolean
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
                {lead.operationalCapacitySummary ? (
                  <p className="text-muted-foreground">{lead.operationalCapacitySummary}</p>
                ) : null}
                {lead.capacityProtectionRecommendation ? (
                  <p className="mt-1 text-xs text-foreground/80">{lead.capacityProtectionRecommendation}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="tabular-nums font-semibold">{lead.operationalCapacityScore ?? "—"}</span>
                {showTier && lead.operationalCapacityTier ? (
                  <GrowthBadge
                    label={lead.operationalCapacityTier.replace(/_/g, " ")}
                    tone={tierTone(lead.operationalCapacityTier)}
                  />
                ) : null}
                {showPressure ? (
                  <GrowthBadge label={`pressure ${lead.capacityPressureLevel ?? 0}`} tone="warning" />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthOperationalCapacityDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [trendWindow, setTrendWindow] = useState<GrowthOperationalCapacityTrendWindow>("7d")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/capacity/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load capacity dashboard.")
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
        Loading capacity dashboard…
      </div>
    )
  }

  if (error && !dashboard) {
    return <p className="text-sm text-rose-600">{error}</p>
  }

  if (!dashboard) return null

  const trend = dashboard.trend[trendWindow] ?? []
  const constraintEntries = Object.entries(dashboard.constraintDistribution).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={<Shield className="size-3.5" />}
            label="Average capacity"
            value={dashboard.averageCapacityScore}
          />
          <StatTile label="Platform pressure" value={dashboard.averagePressureLevel} />
          <StatTile label="Protected coverage" value={`${dashboard.protectedPipelineCoverage}%`} />
          <StatTile label="At risk" value={dashboard.tierCounts.constrained + dashboard.tierCounts.critical} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Capacity health">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Healthy" value={dashboard.tierCounts.healthy ?? 0} />
          <StatTile label="Strained" value={dashboard.tierCounts.strained ?? 0} />
          <StatTile label="Constrained" value={dashboard.tierCounts.constrained ?? 0} />
          <StatTile label="Critical" value={dashboard.tierCounts.critical ?? 0} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(dashboard.recoveryDirectionCounts).map(([direction, count]) => (
            <GrowthBadge key={direction} label={`${direction} ${count}`} tone="neutral" />
          ))}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Constraint distribution">
        {constraintEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active platform constraints.</p>
        ) : (
          <ul className="space-y-2">
            {constraintEntries.map(([key, count]) => (
              <li key={key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="capitalize">{key.replace(/_/g, " ")}</span>
                <span className="tabular-nums font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GrowthEngineCard title="Leadership load">
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <StatTile label="Executive now" value={dashboard.platformSnapshot.executiveNowCount} />
            <StatTile label="Leadership bottlenecks" value={dashboard.platformSnapshot.leadershipBottleneckCount} />
          </div>
          <LeadBucket title="Executive priority accounts" leads={dashboard.leadershipLoad} showTier />
        </GrowthEngineCard>

        <GrowthEngineCard title="Open intervention load">
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <StatTile label="Backlog" value={dashboard.platformSnapshot.interventionBacklogCount} />
            <StatTile label="Aging" value={dashboard.platformSnapshot.interventionAgingCount} />
            <StatTile label="Stalled" value={dashboard.platformSnapshot.interventionStalledCount} />
          </div>
          <LeadBucket title="Aging interventions" leads={dashboard.interventionLoad} showPressure />
        </GrowthEngineCard>
      </div>

      <GrowthEngineCard title="Backlog pressure">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Call queue" value={dashboard.platformSnapshot.callQueueLoadCount} />
          <StatTile label="Follow-ups" value={dashboard.platformSnapshot.openFollowUpCount} />
          <StatTile label="DM backlog" value={dashboard.platformSnapshot.decisionMakerBacklogCount} />
          <StatTile label="Manual touch backlog" value={dashboard.platformSnapshot.manualTouchBacklogCount} />
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Pressure trend">
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
            const max = Math.max(...trend.map((entry) => entry.averagePressure), 1)
            const height = Math.max(8, Math.round((bucket.averagePressure / max) * 100))
            return (
              <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-amber-600/80"
                  style={{ height: `${height}%` }}
                  title={`Avg pressure ${bucket.averagePressure}`}
                />
                <span className="truncate text-[10px] text-muted-foreground">{bucket.label.slice(5)}</span>
              </div>
            )
          })}
        </div>
      </GrowthEngineCard>

      <LeadBucket title="Operational risk" leads={dashboard.operationalRisk} showTier showPressure warning />

      <LeadBucket
        title="Execution Protection"
        leads={dashboard.executionProtection}
        showTier
        showPressure
        warning
      />

      <LeadBucket title="Capacity at risk" leads={dashboard.capacityAtRisk} showTier showPressure warning />
    </div>
  )
}
