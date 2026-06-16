"use client"

import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementDashboardHighIntentSignal } from "@/lib/growth/engagement/growth-engagement-dashboard-types"

export function GrowthEngagementHighIntentPanel({
  items,
  onOpenLead,
  onOpenSharePage,
}: {
  items: GrowthEngagementDashboardHighIntentSignal[]
  onOpenLead?: (leadId: string) => void
  onOpenSharePage?: (sharePageId: string) => void
}) {
  return (
    <GrowthEngineCard title="High-intent signals">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No high-intent engagement signals in this date range.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{item.companyName}</p>
                  <p className="text-muted-foreground">{item.excerpt ?? item.signalType}</p>
                </div>
                <div className="flex items-center gap-2">
                  <GrowthBadge label={item.source.replaceAll("_", " ")} tone="healthy" />
                  {item.score != null ? (
                    <span className="tabular-nums font-semibold">{item.score}</span>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{new Date(item.occurredAt).toLocaleString()}</span>
                {item.leadId ? (
                  <button type="button" className="underline" onClick={() => onOpenLead?.(item.leadId!)}>
                    lead {item.leadId.slice(0, 8)}…
                  </button>
                ) : null}
                {item.sharePageId ? (
                  <button type="button" className="underline" onClick={() => onOpenSharePage?.(item.sharePageId!)}>
                    page {item.sharePageId.slice(0, 8)}…
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GrowthEngineCard>
  )
}
