"use client"

import Link from "next/link"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type {
  GrowthEngagementCommandCenterSidebar,
  GrowthEngagementCommandCenterSourceAvailability,
} from "@/lib/growth/engagement/growth-engagement-command-center-types"
import type { GrowthEngagementAlertSeverity } from "@/lib/growth/engagement/growth-engagement-alert-types"

export function GrowthEngagementCommandCenterSidebar({
  sidebar,
  sourceAvailability,
  selectedWatchlistId,
  selectedSeverity,
  onSelectWatchlist,
  onSelectSeverity,
}: {
  sidebar: GrowthEngagementCommandCenterSidebar | null
  sourceAvailability: GrowthEngagementCommandCenterSourceAvailability | null
  selectedWatchlistId: string | null
  selectedSeverity: GrowthEngagementAlertSeverity | null
  onSelectWatchlist: (watchlistId: string | null) => void
  onSelectSeverity: (severity: GrowthEngagementAlertSeverity | null) => void
}) {
  if (!sidebar) {
    return (
      <GrowthEngineCard title="Workspace sidebar">
        <p className="text-sm text-muted-foreground">Loading sidebar…</p>
      </GrowthEngineCard>
    )
  }

  return (
    <div className="space-y-4">
      <GrowthEngineCard title="Watchlists">
        <div className="space-y-2">
          <button
            type="button"
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedWatchlistId == null ? "border-primary bg-primary/5" : "border-border"}`}
            onClick={() => onSelectWatchlist(null)}
          >
            All watchlists
          </button>
          {sidebar.watchlists.map((watchlist) => (
            <button
              key={watchlist.watchlistId}
              type="button"
              className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedWatchlistId === watchlist.watchlistId ? "border-primary bg-primary/5" : "border-border"}`}
              onClick={() =>
                onSelectWatchlist(selectedWatchlistId === watchlist.watchlistId ? null : watchlist.watchlistId)
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{watchlist.name}</span>
                <GrowthBadge label={`${watchlist.alertCount}`} tone="neutral" />
              </div>
            </button>
          ))}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Alerts by severity">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="text-sm underline" onClick={() => onSelectSeverity(null)}>
            All
          </button>
          {(Object.entries(sidebar.alertsBySeverity) as Array<[GrowthEngagementAlertSeverity, number]>).map(
            ([severity, count]) => (
              <button
                key={severity}
                type="button"
                className={`rounded-md border px-2 py-1 text-xs ${selectedSeverity === severity ? "border-primary bg-primary/5" : "border-border"}`}
                onClick={() => onSelectSeverity(selectedSeverity === severity ? null : severity)}
              >
                {severity} ({count})
              </button>
            ),
          )}
        </div>
      </GrowthEngineCard>

      <GrowthEngineCard title="Report shortcuts">
        <ul className="space-y-2 text-sm">
          {sidebar.reportShortcuts.map((shortcut) => (
            <li key={shortcut.reportType} className="flex items-center justify-between gap-2">
              <Link
                href={`/admin/growth/engagement?report=${encodeURIComponent(shortcut.reportType)}`}
                className="underline"
              >
                {shortcut.title}
              </Link>
              <span className="text-muted-foreground">{shortcut.rowCount} rows</span>
            </li>
          ))}
        </ul>
      </GrowthEngineCard>

      {sourceAvailability ? (
        <GrowthEngineCard title="Source availability">
          <ul className="space-y-1 text-xs">
            {Object.entries(sourceAvailability).map(([key, value]) => (
              <li key={key} className="flex items-center justify-between gap-2">
                <span>{key.replaceAll("_", " ")}</span>
                <GrowthBadge label={value.source_available ? "OK" : "Limited"} tone={value.source_available ? "healthy" : "attention"} />
              </li>
            ))}
          </ul>
        </GrowthEngineCard>
      ) : null}
    </div>
  )
}
