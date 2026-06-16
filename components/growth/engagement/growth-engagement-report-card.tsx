"use client"

import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { GrowthEngagementReportCatalogEntry } from "@/lib/growth/engagement/growth-engagement-report-types"

export function GrowthEngagementReportCard({
  entry,
  selected,
  onSelect,
}: {
  entry: GrowthEngagementReportCatalogEntry
  selected: boolean
  onSelect: (reportType: GrowthEngagementReportCatalogEntry["reportType"]) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.reportType)}
      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{entry.title}</p>
        {selected ? <GrowthBadge label="Selected" tone="healthy" /> : null}
      </div>
      <p className="mt-1 text-muted-foreground">{entry.description}</p>
      <p className="mt-1 text-xs text-muted-foreground">{entry.reportType}</p>
    </button>
  )
}
