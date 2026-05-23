"use client"

import { useCallback, useEffect, useState } from "react"
import { Handshake, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthRelationshipTrendWindow } from "@/lib/growth/relationship-types"
import type { GrowthLead } from "@/lib/growth/types"

type DashboardPayload = {
  averageRelationshipStrength: number
  trustedRelationships: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  strategicRelationships: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  relationshipCooling: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  executiveAttentionRequired: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  fastestGrowing: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  topTouchedLeads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  recentlyImproving: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  trend: Record<GrowthRelationshipTrendWindow, Array<{ label: string; meaningfulTouches: number }>>
  tierCounts: Record<string, number>
  trendCounts: Record<string, number>
  touchedLast7d: number
}

function trendTone(trend: string | null | undefined): "healthy" | "warning" | "neutral" {
  if (trend === "improving") return "healthy"
  if (trend === "cooling") return "warning"
  return "neutral"
}

function attentionTone(level: string | null | undefined): "healthy" | "warning" | "neutral" {
  if (level === "critical") return "warning"
  if (level === "important") return "healthy"
  return "neutral"
}

function LeadBucket({
  title,
  leads,
  showTrend = false,
  showAttention = false,
}: {
  title: string
  leads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  showTrend?: boolean
  showAttention?: boolean
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
                {lead.relationshipSummary ? <p className="text-muted-foreground">{lead.relationshipSummary}</p> : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="tabular-nums font-semibold">{lead.relationshipStrengthScore ?? "—"}</span>
                {lead.relationshipStrengthTier ? (
                  <GrowthBadge label={lead.relationshipStrengthTier} tone="healthy" />
                ) : null}
                {showTrend && lead.relationshipTrend ? (
                  <GrowthBadge label={lead.relationshipTrend} tone={trendTone(lead.relationshipTrend)} />
                ) : null}
                {showAttention && lead.relationshipOwnerAttentionLevel && lead.relationshipOwnerAttentionLevel !== "none" ? (
                  <GrowthBadge label={lead.relationshipOwnerAttentionLevel} tone={attentionTone(lead.relationshipOwnerAttentionLevel)} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthRelationshipDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [trendWindow, setTrendWindow] = useState<GrowthRelationshipTrendWindow>("7d")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/relationships/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load relationship dashboard.")
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
        Loading relationship dashboard…
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
          <StatTile icon={<Handshake className="size-3.5" />} label="Average relationship strength" value={dashboard.averageRelationshipStrength} />
          <StatTile label="Trusted relationships" value={dashboard.tierCounts.trusted ?? 0} />
          <StatTile label="Strategic relationships" value={dashboard.tierCounts.strategic ?? 0} />
          <StatTile label="Meaningful touches (7d)" value={dashboard.touchedLast7d} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Relationship trend">
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
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Improving: {dashboard.trendCounts.improving ?? 0}</span>
          <span>Stable: {dashboard.trendCounts.stable ?? 0}</span>
          <span>Cooling: {dashboard.trendCounts.cooling ?? 0}</span>
        </div>
        <div className="flex h-32 items-end gap-1">
          {trend.map((bucket) => {
            const max = Math.max(...trend.map((entry) => entry.meaningfulTouches), 1)
            const height = Math.max(8, Math.round((bucket.meaningfulTouches / max) * 100))
            return (
              <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-sky-500/80"
                  style={{ height: `${height}%` }}
                  title={`${bucket.meaningfulTouches} leads`}
                />
                <span className="truncate text-[10px] text-muted-foreground">{bucket.label.slice(5)}</span>
              </div>
            )
          })}
        </div>
      </GrowthEngineCard>

      <LeadBucket
        title="Executive Attention Required"
        leads={dashboard.executiveAttentionRequired}
        showAttention
        showTrend
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <LeadBucket title="Trusted relationships" leads={dashboard.trustedRelationships} />
        <LeadBucket title="Strategic relationships" leads={dashboard.strategicRelationships} />
        <LeadBucket title="Relationship cooling" leads={dashboard.relationshipCooling} showTrend />
        <LeadBucket title="Fastest growing relationships" leads={dashboard.fastestGrowing} showTrend />
        <LeadBucket title="Top touched leads (30d)" leads={dashboard.topTouchedLeads} />
        <LeadBucket title="Recently improving" leads={dashboard.recentlyImproving} showTrend />
      </div>
    </div>
  )
}
