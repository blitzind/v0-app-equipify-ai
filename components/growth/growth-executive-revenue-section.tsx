"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthExecutiveRevenueDashboard,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

export function GrowthExecutiveRevenueSection() {
  const [dashboard, setDashboard] = useState<GrowthExecutiveRevenueDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/revenue-intelligence/executive", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; dashboard?: GrowthExecutiveRevenueDashboard; message?: string }
      if (!res.ok || !data.ok || !data.dashboard) throw new Error(data.message ?? "Could not load executive dashboard.")
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

  return (
    <div className="space-y-4" data-qa-marker={GROWTH_REVENUE_INTELLIGENCE_QA_MARKER}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Executive Revenue Intelligence</h3>
          <GrowthBadge label={GROWTH_REVENUE_INTELLIGENCE_QA_MARKER} tone="attention" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/growth/opportunities/workspace">Opportunity workspace</Link>
          </Button>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {dashboard ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Open pipeline" value={dashboard.opportunityPipelineCount} />
            <StatTile label="Meeting conversion" value={`${dashboard.meetingConversionRate}%`} />
            <StatTile label="Campaign effectiveness" value={`${dashboard.campaignEffectivenessScore}%`} />
            <StatTile label="Sender effectiveness" value={`${dashboard.senderEffectivenessScore}%`} />
            <StatTile label="Accelerating momentum" value={dashboard.momentumTrendSummary.accelerating} />
            <StatTile label="Stalled momentum" value={dashboard.momentumTrendSummary.stalled} />
            <StatTile label="Opportunities attributed" value={dashboard.campaignAttribution.opportunitiesGenerated} />
            <StatTile label="Demo requests attributed" value={dashboard.campaignAttribution.demoRequests} />
          </div>

          {dashboard.operationalRiskToRevenue.length > 0 ? (
            <GrowthEngineCard title="Operational risk to revenue">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {dashboard.operationalRiskToRevenue.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </GrowthEngineCard>
          ) : null}

          <GrowthEngineCard title="Hottest accounts">
            {dashboard.hottestAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No high-momentum accounts in the last 30 days.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {dashboard.hottestAccounts.slice(0, 5).map((item) => (
                  <li key={item.leadId} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="font-medium">{item.companyLabel}</span>
                    <GrowthBadge label={`Momentum ${item.momentumScore}`} tone="healthy" />
                  </li>
                ))}
              </ul>
            )}
          </GrowthEngineCard>
        </>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading executive revenue intelligence…
        </div>
      ) : null}
    </div>
  )
}
