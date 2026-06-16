"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementWatchlist } from "@/lib/growth/engagement/growth-engagement-watchlist-types"

export function GrowthEngagementWatchlistCard({
  watchlist,
  selected,
  alertCount,
  onSelect,
}: {
  watchlist: GrowthEngagementWatchlist
  selected: boolean
  alertCount?: number | null
  onSelect: (watchlistId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(watchlist.watchlistId)}
      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{watchlist.name}</p>
        <div className="flex items-center gap-2">
          {alertCount != null ? <GrowthBadge label={`${alertCount} alerts`} tone="neutral" /> : null}
          {selected ? <GrowthBadge label="Active" tone="healthy" /> : null}
        </div>
      </div>
      <p className="mt-1 text-muted-foreground">{watchlist.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">{watchlist.rules.alertTypes.join(", ")}</p>
    </button>
  )
}
