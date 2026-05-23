"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementTrendWindow } from "@/lib/growth/engagement-types"
import type { GrowthLead } from "@/lib/growth/types"

type DashboardPayload = {
  averageEngagement: number
  hotLeads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  engagedLeads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  recentlyActive: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  needsAttention: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  noActivity30d: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  trend: Record<GrowthEngagementTrendWindow, Array<{ label: string; activeLeads: number }>>
}

function LeadBucket({
  title,
  leads,
}: {
  title: string
  leads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
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
                {lead.engagementSummary ? <p className="text-muted-foreground">{lead.engagementSummary}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums font-semibold">{lead.engagementScore ?? "—"}</span>
                {lead.engagementTier ? <GrowthBadge label={lead.engagementTier} tone="healthy" /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthEngagementDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [trendWindow, setTrendWindow] = useState<GrowthEngagementTrendWindow>("7d")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/engagement/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; dashboard?: DashboardPayload; message?: string }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load engagement dashboard.")
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
        Loading engagement dashboard…
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
          <StatTile icon={<Activity className="size-3.5" />} label="Average engagement" value={dashboard.averageEngagement} />
          <StatTile label="Hot leads" value={dashboard.hotLeads.length} />
          <StatTile label="Engaged leads" value={dashboard.engagedLeads.length} />
          <StatTile label="No activity >30d" value={dashboard.noActivity30d.length} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Activity trend">
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
            const max = Math.max(...trend.map((entry) => entry.activeLeads), 1)
            const height = Math.max(8, Math.round((bucket.activeLeads / max) * 100))
            return (
              <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${height}%` }} title={`${bucket.activeLeads} leads`} />
                <span className="truncate text-[10px] text-muted-foreground">{bucket.label.slice(5)}</span>
              </div>
            )
          })}
        </div>
      </GrowthEngineCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <LeadBucket title="Hot leads" leads={dashboard.hotLeads} />
        <LeadBucket title="Engaged leads" leads={dashboard.engagedLeads} />
        <LeadBucket title="Recently active" leads={dashboard.recentlyActive} />
        <LeadBucket title="Needs attention" leads={dashboard.needsAttention} />
        <LeadBucket title="No activity >30d" leads={dashboard.noActivity30d} />
      </div>
    </div>
  )
}
