"use client"

import { useCallback, useEffect, useState } from "react"
import { Crown, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type { GrowthExecutiveOperatingTrendWindow } from "@/lib/growth/executive-operating-types"
import type { GrowthLead } from "@/lib/growth/types"

type DashboardPayload = {
  averagePriority: number
  executiveNow: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  revenueRisk: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  strategicRelationshipsCooling: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  executiveCloseCandidates: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  forecastRegressionWatch: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  criticalBlockers: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  highAttentionAccounts: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  leadershipBottlenecks: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  trend: Record<GrowthExecutiveOperatingTrendWindow, Array<{ label: string; averagePriority: number }>>
  tierCounts: Record<string, number>
}

function tierTone(tier: string | null | undefined): "healthy" | "warning" | "neutral" {
  if (tier === "executive_now" || tier === "priority") return "warning"
  if (tier === "important") return "healthy"
  return "neutral"
}

function LeadBucket({
  title,
  leads,
  showTier = false,
  showConflicts = false,
  warning = false,
}: {
  title: string
  leads: Array<Partial<GrowthLead> & { id: string; companyName: string }>
  showTier?: boolean
  showConflicts?: boolean
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
                {lead.executivePrioritySummary ? (
                  <p className="text-muted-foreground">{lead.executivePrioritySummary}</p>
                ) : null}
                {lead.executiveRecommendation ? (
                  <p className="mt-1 text-xs text-foreground/80">{lead.executiveRecommendation}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="tabular-nums font-semibold">{lead.executivePriorityScore ?? "—"}</span>
                {showTier && lead.executivePriorityTier ? (
                  <GrowthBadge label={lead.executivePriorityTier.replace(/_/g, " ")} tone={tierTone(lead.executivePriorityTier)} />
                ) : null}
                {showConflicts && (lead.intelligenceConflictSeverityScore ?? 0) > 0 ? (
                  <GrowthBadge label={`conflict ${lead.intelligenceConflictSeverityScore}`} tone="warning" />
                ) : null}
                {lead.executiveOwner ? (
                  <GrowthBadge label={`owner ${lead.executiveOwner}`} tone="neutral" />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthExecutiveOperatingDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [trendWindow, setTrendWindow] = useState<GrowthExecutiveOperatingTrendWindow>("7d")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/executive/dashboard", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: DashboardPayload
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) {
        throw new Error(data.message ?? "Could not load executive dashboard.")
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
        Loading executive dashboard…
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
          <StatTile icon={<Crown className="size-3.5" />} label="Average priority" value={dashboard.averagePriority} />
          <StatTile label="Executive now" value={dashboard.tierCounts.executive_now ?? 0} />
          <StatTile label="Priority" value={dashboard.tierCounts.priority ?? 0} />
          <StatTile label="Leadership bottlenecks" value={dashboard.leadershipBottlenecks.length} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <GrowthEngineCard title="Executive priority trend">
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
            const max = Math.max(...trend.map((entry) => entry.averagePriority), 1)
            const height = Math.max(8, Math.round((bucket.averagePriority / max) * 100))
            return (
              <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-violet-600/80"
                  style={{ height: `${height}%` }}
                  title={`Avg ${bucket.averagePriority}`}
                />
                <span className="truncate text-[10px] text-muted-foreground">{bucket.label.slice(5)}</span>
              </div>
            )
          })}
        </div>
      </GrowthEngineCard>

      <LeadBucket title="Executive Now" leads={dashboard.executiveNow} showTier />

      <LeadBucket
        title="Leadership Bottlenecks"
        leads={dashboard.leadershipBottlenecks}
        showTier
        showConflicts
        warning
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <LeadBucket title="Revenue Risk" leads={dashboard.revenueRisk} showConflicts />
        <LeadBucket title="Strategic Relationships Cooling" leads={dashboard.strategicRelationshipsCooling} />
        <LeadBucket title="Executive Close Candidates" leads={dashboard.executiveCloseCandidates} showTier />
        <LeadBucket title="Forecast Regression Watch" leads={dashboard.forecastRegressionWatch} warning />
        <LeadBucket title="Critical Blockers" leads={dashboard.criticalBlockers} showConflicts />
        <LeadBucket title="High Attention Accounts" leads={dashboard.highAttentionAccounts} showTier />
      </div>
    </div>
  )
}
