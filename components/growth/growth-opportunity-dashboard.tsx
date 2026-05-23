"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthOpportunityTrendWindow } from "@/lib/growth/opportunity-types"
import type { GrowthLead } from "@/lib/growth/types"

type DashboardPayload = {
  averageReadiness: number
  priorityOpportunities: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  salesReady: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  blockedOpportunities: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  executiveCloseCandidates: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  fastestImproving: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  topBlockers: Array<{ key: string; label: string; count: number }>
  trend: Record<GrowthOpportunityTrendWindow, Array<{ label: string; averageReadiness: number }>>
  tierCounts: Record<string, number>
}

function trendTone(trend: string | null | undefined): "healthy" | "warning" | "neutral" {
  if (trend === "improving") return "healthy"
  if (trend === "declining") return "warning"
  return "neutral"
}

function LeadBucket({
  title,
  leads,
  showTrend = false,
  showBuying = false,
}: {
  title: string
  leads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  showTrend?: boolean
  showBuying?: boolean
}) {
  return (
    <GrowthEngineCard title={title}>
      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads in this bucket.</p>
      ) : (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li key={lead.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{lead.companyName}</p>
                {lead.opportunityReadinessSummary ? (
                  <p className="text-muted-foreground">{lead.opportunityReadinessSummary}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="tabular-nums font-semibold">{lead.opportunityReadinessScore ?? "—"}</span>
                {lead.opportunityReadinessTier ? (
                  <GrowthBadge label={lead.opportunityReadinessTier.replace(/_/g, " ")} tone="healthy" />
                ) : null}
                {showTrend && lead.opportunityReadinessTrend ? (
                  <GrowthBadge label={lead.opportunityReadinessTrend} tone={trendTone(lead.opportunityReadinessTrend)} />
                ) : null}
                {showBuying && lead.opportunityBuyingSignalStrength && lead.opportunityBuyingSignalStrength !== "none" ? (
                  <GrowthBadge label={lead.opportunityBuyingSignalStrength} tone="healthy" />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthOpportunityDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [trendWindow, setTrendWindow] = useState<GrowthOpportunityTrendWindow>("7d")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/opportunities/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load opportunity dashboard.")
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
        Loading opportunity dashboard…
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
          <StatTile icon={<Target className="size-3.5" />} label="Average readiness" value={dashboard.averageReadiness} />
          <StatTile label="Priority opportunities" value={dashboard.tierCounts.priority_opportunity ?? 0} />
          <StatTile label="Sales ready" value={dashboard.tierCounts.sales_ready ?? 0} />
          <StatTile label="Blocked" value={dashboard.blockedOpportunities.length} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Readiness trend">
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
            const max = Math.max(...trend.map((entry) => entry.averageReadiness), 1)
            const height = Math.max(8, Math.round((bucket.averageReadiness / max) * 100))
            return (
              <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-violet-500/80"
                  style={{ height: `${height}%` }}
                  title={`Avg ${bucket.averageReadiness}`}
                />
                <span className="truncate text-[10px] text-muted-foreground">{bucket.label.slice(5)}</span>
              </div>
            )
          })}
        </div>
      </GrowthEngineCard>

      <LeadBucket
        title="Executive Close Candidates"
        leads={dashboard.executiveCloseCandidates}
        showTrend
        showBuying
      />

      <GrowthEngineCard title="Top blockers">
        {dashboard.topBlockers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active blockers across leads.</p>
        ) : (
          <ul className="space-y-2">
            {dashboard.topBlockers.map((blocker) => (
              <li key={blocker.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span>{blocker.label}</span>
                <span className="tabular-nums font-semibold">{blocker.count}</span>
              </li>
            ))}
          </ul>
        )}
      </GrowthEngineCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <LeadBucket title="Priority opportunities" leads={dashboard.priorityOpportunities} showTrend />
        <LeadBucket title="Sales ready" leads={dashboard.salesReady} showTrend />
        <LeadBucket title="Blocked opportunities" leads={dashboard.blockedOpportunities} />
        <LeadBucket title="Fastest improving readiness" leads={dashboard.fastestImproving} showTrend />
      </div>
    </div>
  )
}
