"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import type {
  GrowthRevenueForecastPeriod,
  GrowthRevenueForecastSettings,
  GrowthRevenueOperatingDashboard,
} from "@/lib/growth/revenue-operating/revenue-operating-types"

const PERIOD_LABELS: Record<GrowthRevenueForecastPeriod, string> = {
  this_month: "This month",
  next_month: "Next month",
  this_quarter: "This quarter",
  next_quarter: "Next quarter",
  custom: "Custom",
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function AttentionList({
  title,
  deals,
}: {
  title: string
  deals: GrowthRevenueOperatingDashboard["atRiskDeals"]
}) {
  return (
    <GrowthEngineCard title={title}>
      {deals.length === 0 ? (
        <p className="text-sm text-muted-foreground">None in this bucket.</p>
      ) : (
        <ul className="space-y-2">
          {deals.map((deal) => (
            <li key={deal.opportunityId} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{deal.companyName}</p>
                  <p className="text-muted-foreground">{deal.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatCurrency(deal.amount)}</p>
                  <Link
                    href={`/admin/growth/opportunities/pipeline?opportunityId=${deal.opportunityId}`}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Open deal
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}

export function GrowthRevenueOperatingDashboardView() {
  const [dashboard, setDashboard] = useState<GrowthRevenueOperatingDashboard | null>(null)
  const [settings, setSettings] = useState<GrowthRevenueForecastSettings | null>(null)
  const [period, setPeriod] = useState<GrowthRevenueForecastPeriod>("this_quarter")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (activePeriod: GrowthRevenueForecastPeriod, refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ period: activePeriod })
      if (refresh) params.set("refresh", "true")
      const [dashRes, settingsRes] = await Promise.all([
        fetch(`/api/platform/growth/revenue-operating/dashboard?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/platform/growth/revenue-operating/settings", { cache: "no-store" }),
      ])
      const dashData = (await dashRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthRevenueOperatingDashboard
        message?: string
      }
      const settingsData = (await settingsRes.json().catch(() => ({}))) as {
        ok?: boolean
        settings?: GrowthRevenueForecastSettings
      }
      if (!dashRes.ok || !dashData.ok) throw new Error(dashData.message ?? "Could not load revenue operating dashboard.")
      setDashboard(dashData.dashboard ?? null)
      setSettings(settingsData.settings ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load revenue operating dashboard.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load(period)
  }, [load, period])

  if (loading && !dashboard) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading revenue operating dashboard…
      </div>
    )
  }

  const totals = dashboard?.totals
  const goal = dashboard?.goalPacing

  return (
    <div className="space-y-6">
      <GrowthEngineCard title="Executive Revenue Forecast">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Deterministic forecast rollups from opportunity pipeline — no AI forecast decisions.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void load(period, true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Refresh forecast
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(PERIOD_LABELS) as GrowthRevenueForecastPeriod[])
            .filter((p) => p !== "custom")
            .map((key) => (
              <Button key={key} size="sm" variant={period === key ? "default" : "outline"} onClick={() => setPeriod(key)}>
                {PERIOD_LABELS[key]}
              </Button>
            ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <StatTile label="Weighted pipeline" value={formatCurrency(totals?.weightedPipelineAmount ?? 0)} />
          <StatTile label="Commit" value={formatCurrency(totals?.commitForecast ?? 0)} />
          <StatTile label="Best case" value={formatCurrency(totals?.bestCaseForecast ?? 0)} />
          <StatTile label="Pipeline" value={formatCurrency(totals?.pipelineForecast ?? 0)} />
          <StatTile label="Coverage ratio" value={`${goal?.coverageRatio ?? 0}x`} />
          <StatTile label="Forecast confidence" value={`${goal?.forecastConfidence ?? 0}%`} />
          {dashboard?.dealIntelligenceForecast ? (
            <StatTile
              label="AI-informed confidence"
              value={`${dashboard.dealIntelligenceForecast.aiInformedForecastConfidence}%`}
            />
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Open pipeline" value={formatCurrency(totals?.openPipelineAmount ?? 0)} />
          <StatTile label="Closed won" value={formatCurrency(totals?.closedWonAmount ?? 0)} />
          <StatTile label="At-risk pipeline" value={formatCurrency(totals?.atRiskPipelineAmount ?? 0)} />
          <StatTile label="Stale pipeline" value={formatCurrency(totals?.stalePipelineAmount ?? 0)} />
        </div>

        {dashboard?.dealIntelligenceForecast ? (
          <div className="mt-4 rounded-lg border border-indigo-200/70 bg-indigo-50/40 p-3 text-sm dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <div className="flex flex-wrap items-center gap-2">
              <GrowthBadge label="AI-informed forecast" tone="healthy" />
              <span className="text-muted-foreground">
                {dashboard.dealIntelligenceForecast.scoredOpportunities} scored opportunities
              </span>
            </div>
            <p className="mt-2 text-foreground">{dashboard.dealIntelligenceForecast.riskAdjustedForecastNote}</p>
          </div>
        ) : null}
      </GrowthEngineCard>

      <GrowthEngineCard title="Goal pacing">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={goal?.goalLabel ?? "Goal"} value={formatCurrency(goal?.activeGoal ?? 0)} />
          <StatTile label="Gap to goal" value={formatCurrency(goal?.gapToGoal ?? 0)} />
          <StatTile label="Required pipeline" value={formatCurrency(goal?.requiredPipeline ?? 0)} />
          <StatTile label="Forecast movement" value={formatCurrency(totals?.forecastMovement ?? 0)} />
        </div>
        {settings ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Monthly goal: {formatCurrency(settings.monthlyGoal)} · Quarterly goal: {formatCurrency(settings.quarterlyGoal)} ·
            High-value threshold: {formatCurrency(settings.highValueDealThreshold)}
          </p>
        ) : null}
      </GrowthEngineCard>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthEngineCard title="Owner scorecards">
          {dashboard?.ownerScorecards.length ? (
            <ul className="space-y-2">
              {dashboard.ownerScorecards.slice(0, 10).map((owner) => (
                <li key={owner.ownerUserId ?? "unassigned"} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">{owner.ownerUserId ? `Owner ${owner.ownerUserId.slice(0, 8)}…` : "Unassigned"}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{formatCurrency(owner.weightedPipeline)} weighted</span>
                    <span>{owner.opportunitiesOwned} deals</span>
                    <span>{owner.staleOpportunities} stale</span>
                    <span>{owner.followupsDue} follow-ups due</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No owner scorecards yet.</p>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Forecast movement">
          {dashboard?.movements.length ? (
            <ul className="space-y-2">
              {dashboard.movements.slice(0, 12).map((movement) => (
                <li key={movement.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                  <p className="font-medium">{movement.title}</p>
                  <p className="text-muted-foreground">{movement.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Refresh forecast to detect pipeline movement.</p>
          )}
        </GrowthEngineCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AttentionList title="At-risk revenue" deals={dashboard?.atRiskDeals ?? []} />
        <AttentionList title="Stale high-value deals" deals={dashboard?.staleHighValueDeals ?? []} />
        <AttentionList title="Deals needing action" deals={dashboard?.dealsNeedingAction ?? []} />
      </div>
    </div>
  )
}
