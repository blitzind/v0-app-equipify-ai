"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthEngagementWatchlistCard } from "@/components/growth/engagement/growth-engagement-watchlist-card"
import type { GrowthEngagementDashboardDateRangePreset } from "@/lib/growth/engagement/growth-engagement-dashboard-types"
import {
  GROWTH_ENGAGEMENT_ALERT_SEVERITIES,
  GROWTH_ENGAGEMENT_ALERT_TYPES,
  type GrowthEngagementAlertSeverity,
  type GrowthEngagementAlertType,
} from "@/lib/growth/engagement/growth-engagement-alert-types"
import {
  GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
  type GrowthEngagementWatchlist,
} from "@/lib/growth/engagement/growth-engagement-watchlist-types"

type WatchlistsResponse = {
  ok?: boolean
  watchlists?: GrowthEngagementWatchlist[]
  message?: string
}

const ALL_WATCHLISTS = "all"

export function GrowthEngagementWatchlistsPanel({
  dateRange,
  query,
  selectedWatchlistId,
  onSelectWatchlist,
}: {
  dateRange: GrowthEngagementDashboardDateRangePreset
  query: string
  selectedWatchlistId: string | null
  onSelectWatchlist: (watchlistId: string | null) => void
}) {
  const [watchlists, setWatchlists] = useState<GrowthEngagementWatchlist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/engagement-dashboard/watchlists", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as WatchlistsResponse
      if (!res.ok || !data.ok || !data.watchlists) {
        throw new Error(data.message ?? "Could not load engagement watchlists.")
      }
      setWatchlists(data.watchlists)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load engagement watchlists.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <GrowthEngineCard title="Engagement watchlists">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label="Predefined only" tone="neutral" />
          <span className="text-xs text-muted-foreground">{GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER}</span>
        </div>
        <p className="text-sm text-muted-foreground">Date range: {dateRange}</p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading watchlists…
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            <Button
              size="sm"
              variant={selectedWatchlistId == null ? "default" : "outline"}
              onClick={() => onSelectWatchlist(null)}
            >
              All alerts
            </Button>
            {watchlists.map((watchlist) => (
              <GrowthEngagementWatchlistCard
                key={watchlist.watchlistId}
                watchlist={watchlist}
                selected={selectedWatchlistId === watchlist.watchlistId}
                onSelect={(watchlistId) => onSelectWatchlist(watchlistId === selectedWatchlistId ? null : watchlistId)}
              />
            ))}
          </div>
        )}
      </div>
    </GrowthEngineCard>
  )
}

export function useEngagementAlertFilterChips() {
  const [severity, setSeverity] = useState<GrowthEngagementAlertSeverity | null>(null)
  const [alertType, setAlertType] = useState<GrowthEngagementAlertType | null>(null)

  const chipQuery = useMemo(() => {
    const params = new URLSearchParams()
    if (severity) params.set("severity", severity)
    if (alertType) params.set("alertType", alertType)
    return params.toString()
  }, [severity, alertType])

  return {
    severity,
    alertType,
    setSeverity,
    setAlertType,
    chipQuery,
    severityOptions: GROWTH_ENGAGEMENT_ALERT_SEVERITIES,
    alertTypeOptions: GROWTH_ENGAGEMENT_ALERT_TYPES,
  }
}

export { ALL_WATCHLISTS }
