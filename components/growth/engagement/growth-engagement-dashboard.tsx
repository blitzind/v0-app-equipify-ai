"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  GrowthEngagementDrilldownDrawer,
  type GrowthEngagementDrilldownTarget,
} from "@/components/growth/engagement/growth-engagement-drilldown-drawer"
import { GrowthEngagementHighIntentPanel } from "@/components/growth/engagement/growth-engagement-high-intent-panel"
import { GrowthEngagementMediaTable } from "@/components/growth/engagement/growth-engagement-media-table"
import { GrowthEngagementSummaryCards } from "@/components/growth/engagement/growth-engagement-summary-cards"
import { GrowthEngagementTemplateTable } from "@/components/growth/engagement/growth-engagement-template-table"
import { GrowthEngagementReportsPanel } from "@/components/growth/engagement/growth-engagement-reports-panel"
import { GrowthEngagementAlertsPanel } from "@/components/growth/engagement/growth-engagement-alerts-panel"
import { GrowthEngagementWatchlistsPanel } from "@/components/growth/engagement/growth-engagement-watchlists-panel"
import { GrowthEngagementTimelinePanel } from "@/components/growth/engagement/growth-engagement-timeline-panel"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
  type GrowthEngagementDashboardDateRangePreset,
  type GrowthEngagementDashboardHighIntentResponse,
  type GrowthEngagementDashboardOverviewResponse,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import type { GrowthEngagementTimelineEvent } from "@/lib/growth/engagement/growth-engagement-timeline-types"

type DashboardResponse = {
  ok?: boolean
  dashboard?: GrowthEngagementDashboardOverviewResponse
  message?: string
}

type HighIntentResponse = {
  ok?: boolean
  highIntent?: GrowthEngagementDashboardHighIntentResponse
  message?: string
}

const DATE_RANGE_OPTIONS: Array<{ value: GrowthEngagementDashboardDateRangePreset; label: string }> = [
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "last_90_days", label: "Last 90 days" },
]

function buildQuery(dateRange: GrowthEngagementDashboardDateRangePreset, leadId: string, templateId: string): string {
  const params = new URLSearchParams({ dateRange })
  if (leadId.trim()) params.set("leadId", leadId.trim())
  if (templateId.trim()) params.set("templateId", templateId.trim())
  return params.toString()
}

export function GrowthEngagementDashboardPanel() {
  const [dateRange, setDateRange] = useState<GrowthEngagementDashboardDateRangePreset>(
    GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  )
  const [leadId, setLeadId] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [dashboard, setDashboard] = useState<GrowthEngagementDashboardOverviewResponse | null>(null)
  const [highIntent, setHighIntent] = useState<GrowthEngagementDashboardHighIntentResponse | null>(null)
  const [drilldownTarget, setDrilldownTarget] = useState<GrowthEngagementDrilldownTarget | null>(null)
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const query = useMemo(() => buildQuery(dateRange, leadId, templateId), [dateRange, leadId, templateId])

  const openDrilldown = useCallback((target: GrowthEngagementDrilldownTarget) => {
    setDrilldownTarget(target)
  }, [])

  const openTimelineEvent = useCallback((event: GrowthEngagementTimelineEvent) => {
    if (event.leadId) {
      openDrilldown({ kind: "lead", id: event.leadId })
      return
    }
    if (event.templateId) {
      openDrilldown({ kind: "template", id: event.templateId })
      return
    }
    if (event.mediaAssetId) {
      openDrilldown({ kind: "media", id: event.mediaAssetId })
      return
    }
    if (event.sharePageId) {
      openDrilldown({ kind: "share_page", id: event.sharePageId })
    }
  }, [openDrilldown])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboardRes, highIntentRes] = await Promise.all([
        fetch(`/api/platform/growth/engagement-dashboard?${query}`, { cache: "no-store" }),
        fetch(`/api/platform/growth/engagement-dashboard/high-intent?${query}`, { cache: "no-store" }),
      ])

      const dashboardData = (await dashboardRes.json().catch(() => ({}))) as DashboardResponse
      const highIntentData = (await highIntentRes.json().catch(() => ({}))) as HighIntentResponse

      if (!dashboardRes.ok || !dashboardData.ok || !dashboardData.dashboard) {
        throw new Error(dashboardData.message ?? "Could not load engagement dashboard.")
      }

      setDashboard(dashboardData.dashboard)
      setHighIntent(highIntentData.highIntent ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load engagement dashboard.")
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  const unavailableSources = dashboard
    ? Object.entries(dashboard.sourceAvailability).filter(([, value]) => !value.source_available)
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {DATE_RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={dateRange === option.value ? "default" : "outline"}
              onClick={() => setDateRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Lead ID filter</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={leadId}
            onChange={(event) => setLeadId(event.target.value)}
            placeholder="Optional lead UUID"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Template ID filter</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            placeholder="Optional template UUID"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <GrowthBadge label="Read-only" tone="neutral" />
        <span className="text-xs text-muted-foreground">{GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER}</span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {unavailableSources.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" />
            Some data sources are unavailable
          </div>
          <ul className="list-disc pl-5">
            {unavailableSources.map(([key, value]) => (
              <li key={key}>
                {key}: {value.message ?? "Not queryable"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading && !dashboard ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading engagement dashboard…
        </div>
      ) : null}

      {dashboard ? (
        <>
          <GrowthEngagementSummaryCards overview={dashboard.overview} />

          <div className="grid gap-3 md:grid-cols-3">
            <StatTile label="Share page CTAs" value={dashboard.ctaPerformance.sharePageCtaClicks} />
            <StatTile label="Media CTAs" value={dashboard.ctaPerformance.mediaCtaClicks} />
            <StatTile label="Total CTAs" value={dashboard.ctaPerformance.totalCtaClicks} />
          </div>

          <GrowthEngineCard title="Booking handoff readiness">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatTile
                label="Templates w/ handoff"
                value={dashboard.bookingHandoffReadiness.templatesWithHandoffEnabled}
              />
              <StatTile
                label="Share page booking starts"
                value={dashboard.bookingHandoffReadiness.sharePageBookingStarts}
              />
              <StatTile
                label="Share page booking done"
                value={dashboard.bookingHandoffReadiness.sharePageBookingCompletions}
              />
              <StatTile
                label="Foundation handoffs"
                value={dashboard.bookingHandoffReadiness.foundationHandoffRecords}
              />
              <StatTile label="Ready tier" value={dashboard.bookingHandoffReadiness.readyTierCount} />
              <StatTile label="High-intent tier" value={dashboard.bookingHandoffReadiness.highIntentTierCount} />
            </div>
            {!dashboard.bookingHandoffReadiness.sourceAvailable ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Booking handoff foundation metadata is limited to in-memory preview records.
              </p>
            ) : null}
          </GrowthEngineCard>

          <GrowthEngagementReportsPanel
            dateRange={dateRange}
            leadId={leadId}
            templateId={templateId}
            query={query}
          />

          <GrowthEngagementWatchlistsPanel
            dateRange={dateRange}
            query={query}
            selectedWatchlistId={selectedWatchlistId}
            onSelectWatchlist={setSelectedWatchlistId}
          />

          <GrowthEngagementAlertsPanel
            dateRange={dateRange}
            query={query}
            selectedWatchlistId={selectedWatchlistId}
            onOpenDrilldown={openDrilldown}
          />

          <GrowthEngagementTimelinePanel
            dateRange={dateRange}
            leadId={leadId}
            templateId={templateId}
            onOpenEvent={openTimelineEvent}
          />

          <GrowthEngagementTemplateTable
            items={dashboard.topTemplates}
            onOpenTemplate={(id) => openDrilldown({ kind: "template", id })}
          />
          <GrowthEngagementMediaTable
            items={dashboard.topAssets}
            onOpenAsset={(id) => openDrilldown({ kind: "media", id })}
          />
          <GrowthEngagementHighIntentPanel
            items={highIntent?.items ?? []}
            onOpenLead={(id) => openDrilldown({ kind: "lead", id })}
            onOpenSharePage={(id) => openDrilldown({ kind: "share_page", id })}
          />
        </>
      ) : null}

      <GrowthEngagementDrilldownDrawer
        open={drilldownTarget != null}
        target={drilldownTarget}
        dateRange={dateRange}
        onClose={() => setDrilldownTarget(null)}
      />
    </div>
  )
}
