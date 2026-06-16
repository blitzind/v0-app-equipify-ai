"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  GrowthEngagementDrilldownDrawer,
  type GrowthEngagementDrilldownTarget,
} from "@/components/growth/engagement/growth-engagement-drilldown-drawer"
import { GrowthEngagementCommandCenterFeed } from "@/components/growth/engagement/growth-engagement-command-center-feed"
import { GrowthEngagementCommandCenterHeader } from "@/components/growth/engagement/growth-engagement-command-center-header"
import { GrowthEngagementCommandCenterHighIntentPanel } from "@/components/growth/engagement/growth-engagement-command-center-high-intent-panel"
import { GrowthEngagementCommandCenterSidebar } from "@/components/growth/engagement/growth-engagement-command-center-sidebar"
import { GrowthEngagementCommandCenterSummary } from "@/components/growth/engagement/growth-engagement-command-center-summary"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  type GrowthEngagementDashboardDateRangePreset,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import type {
  GrowthEngagementCommandCenterResponse,
  GrowthEngagementCommandCenterWorkspace,
} from "@/lib/growth/engagement/growth-engagement-command-center-types"
import type { GrowthEngagementAlertSeverity } from "@/lib/growth/engagement/growth-engagement-alert-types"

type CommandCenterApiResponse = GrowthEngagementCommandCenterResponse & {
  ok?: boolean
  message?: string
}

function buildQuery(input: {
  dateRange: GrowthEngagementDashboardDateRangePreset
  search: string
  watchlistId: string | null
  severity: GrowthEngagementAlertSeverity | null
  cursor?: string | null
}): string {
  const params = new URLSearchParams({ dateRange: input.dateRange, limit: "100" })
  if (input.search.trim()) params.set("search", input.search.trim())
  if (input.watchlistId) params.set("watchlistId", input.watchlistId)
  if (input.severity) params.set("severity", input.severity)
  if (input.cursor) params.set("cursor", input.cursor)
  return params.toString()
}

export function GrowthEngagementCommandCenter() {
  const [dateRange, setDateRange] = useState<GrowthEngagementDashboardDateRangePreset>(
    GROWTH_ENGAGEMENT_DASHBOARD_DEFAULT_DATE_RANGE,
  )
  const [search, setSearch] = useState("")
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null)
  const [selectedSeverity, setSelectedSeverity] = useState<GrowthEngagementAlertSeverity | null>(null)
  const [workspace, setWorkspace] = useState<GrowthEngagementCommandCenterWorkspace | null>(null)
  const [drilldownTarget, setDrilldownTarget] = useState<GrowthEngagementDrilldownTarget | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseQuery = useMemo(
    () =>
      buildQuery({
        dateRange,
        search,
        watchlistId: selectedWatchlistId,
        severity: selectedSeverity,
      }),
    [dateRange, search, selectedWatchlistId, selectedSeverity],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/engagement-dashboard/command-center?${baseQuery}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as CommandCenterApiResponse
      if (!res.ok || !data.ok || !data.workspace) {
        throw new Error(data.message ?? "Could not load engagement command center.")
      }
      setWorkspace(data.workspace)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load engagement command center.")
    } finally {
      setLoading(false)
    }
  }, [baseQuery])

  const loadMore = useCallback(async () => {
    if (!workspace?.feed.nextCursor) return
    setLoadingMore(true)
    try {
      const query = buildQuery({
        dateRange,
        search,
        watchlistId: selectedWatchlistId,
        severity: selectedSeverity,
        cursor: workspace.feed.nextCursor,
      })
      const res = await fetch(`/api/platform/growth/engagement-dashboard/command-center?${query}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as CommandCenterApiResponse
      if (!res.ok || !data.ok || !data.workspace) {
        throw new Error(data.message ?? "Could not load more feed items.")
      }
      setWorkspace((current) =>
        current
          ? {
              ...data.workspace!,
              feed: {
                ...data.workspace!.feed,
                items: [...current.feed.items, ...data.workspace!.feed.items],
              },
            }
          : data.workspace!,
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more feed items.")
    } finally {
      setLoadingMore(false)
    }
  }, [workspace?.feed.nextCursor, dateRange, search, selectedWatchlistId, selectedSeverity])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <GrowthEngagementCommandCenterHeader
        dateRange={dateRange}
        search={search}
        loading={loading}
        sourceAvailability={workspace?.sourceAvailability ?? null}
        onDateRangeChange={setDateRange}
        onSearchChange={setSearch}
        onRefresh={() => void load()}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <GrowthEngagementCommandCenterSidebar
          sidebar={workspace?.sidebar ?? null}
          sourceAvailability={workspace?.sourceAvailability ?? null}
          selectedWatchlistId={selectedWatchlistId}
          selectedSeverity={selectedSeverity}
          onSelectWatchlist={setSelectedWatchlistId}
          onSelectSeverity={setSelectedSeverity}
        />

        <div className="space-y-4">
          <GrowthEngagementCommandCenterSummary
            overview={workspace?.overview ?? null}
            onOpenDrilldown={setDrilldownTarget}
          />
          <GrowthEngagementCommandCenterHighIntentPanel
            cards={workspace?.highIntent.cards ?? []}
            onOpenDrilldown={setDrilldownTarget}
          />
          <GrowthEngagementCommandCenterFeed
            feed={workspace?.feed ?? null}
            loading={loading}
            loadingMore={loadingMore}
            onLoadMore={workspace?.feed.nextCursor ? () => void loadMore() : undefined}
            onOpenDrilldown={setDrilldownTarget}
          />
        </div>
      </div>

      <GrowthEngagementDrilldownDrawer
        open={drilldownTarget != null}
        target={drilldownTarget}
        dateRange={dateRange}
        onClose={() => setDrilldownTarget(null)}
      />
    </div>
  )
}
