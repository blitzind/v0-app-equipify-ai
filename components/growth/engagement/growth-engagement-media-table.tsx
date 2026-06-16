"use client"

import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementDashboardMediaPerformanceRow } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function GrowthEngagementMediaTable({
  items,
  onOpenAsset,
}: {
  items: GrowthEngagementDashboardMediaPerformanceRow[]
  onOpenAsset?: (assetId: string) => void
}) {
  return (
    <GrowthEngineCard title="Media performance">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media playback analytics in this date range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-2 py-2 font-medium">Asset</th>
                <th className="px-2 py-2 font-medium">Views</th>
                <th className="px-2 py-2 font-medium">Unique</th>
                <th className="px-2 py-2 font-medium">Plays</th>
                <th className="px-2 py-2 font-medium">Done</th>
                <th className="px-2 py-2 font-medium">CTA</th>
                <th className="px-2 py-2 font-medium">Avg watch</th>
                <th className="px-2 py-2 font-medium">Completion</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.assetId}
                  className={`border-b border-border/60 ${onOpenAsset ? "cursor-pointer hover:bg-muted/40" : ""}`}
                  onClick={() => onOpenAsset?.(row.assetId)}
                >
                  <td className="px-2 py-2">
                    <p className="font-medium">{row.assetLabel}</p>
                    <p className="text-xs text-muted-foreground">{row.assetId.slice(0, 8)}…</p>
                  </td>
                  <td className="px-2 py-2 tabular-nums">{row.views}</td>
                  <td className="px-2 py-2 tabular-nums">{row.uniqueViews}</td>
                  <td className="px-2 py-2 tabular-nums">{row.playStarts}</td>
                  <td className="px-2 py-2 tabular-nums">{row.completions}</td>
                  <td className="px-2 py-2 tabular-nums">{row.ctaClicks}</td>
                  <td className="px-2 py-2 tabular-nums">{Math.round(row.averageWatchSeconds)}s</td>
                  <td className="px-2 py-2 tabular-nums">{formatRate(row.completionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GrowthEngineCard>
  )
}
