"use client"

import { useCallback, useEffect, useState } from "react"
import { BarChart3, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthExecutiveRevenueOpsDashboard,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

export function GrowthExecutiveRevenueOpsSection() {
  const [dashboard, setDashboard] = useState<GrowthExecutiveRevenueOpsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/multichannel-revenue/executive", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthExecutiveRevenueOpsDashboard
        message?: string
      }
      if (!res.ok || !data.ok || !data.dashboard) throw new Error(data.message ?? "Could not load revenue ops dashboard.")
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
        Loading executive revenue ops…
      </div>
    )
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GrowthBadge label={GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER} tone="attention" />
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_PRIVACY_NOTE}</p>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {dashboard ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={<BarChart3 className="size-3.5" />} label="Engagement trend" value={`${dashboard.engagementTrendRate}%`} />
            <StatTile label="Meeting conversion" value={`${dashboard.meetingConversionRate}%`} />
            <StatTile label="Pipeline acceleration" value={dashboard.pipelineAccelerationScore} />
            <StatTile label="Operator activity (7d)" value={dashboard.operatorActivityCount} />
          </div>

          <GrowthEngineCard title="Channel performance">
            {dashboard.channelPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No channel effectiveness data yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {dashboard.channelPerformance.map((row) => (
                  <li key={row.channel} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <span className="font-medium capitalize">{row.channel}</span>
                    <span className="text-muted-foreground">
                      {row.touchCount} touches · effectiveness {row.effectivenessScore}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GrowthEngineCard>

          <GrowthEngineCard title="Momentum trends">
            <ul className="flex flex-wrap gap-2 text-sm">
              {Object.entries(dashboard.momentumTrendSummary).map(([trend, count]) => (
                <li key={trend} className="rounded-md border px-2 py-1 capitalize">
                  {trend}: {count}
                </li>
              ))}
            </ul>
          </GrowthEngineCard>

          {dashboard.revenueRiskIndicators.length > 0 ? (
            <GrowthEngineCard title="Revenue risk indicators">
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                {dashboard.revenueRiskIndicators.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </GrowthEngineCard>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
