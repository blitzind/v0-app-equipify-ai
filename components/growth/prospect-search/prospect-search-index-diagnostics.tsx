"use client"

import type { GrowthProspectSearchIndexDiagnostics } from "@/lib/growth/prospect-search/prospect-search-types"

export function ProspectSearchIndexDiagnostics({
  diagnostics,
}: {
  diagnostics?: GrowthProspectSearchIndexDiagnostics | null
}) {
  if (!diagnostics) return null

  const modeLabel = diagnostics.index_mode === "materialized" ? "Live index" : "Fallback rebuild"
  const indexedAt = diagnostics.last_indexed_at
    ? new Date(diagnostics.last_indexed_at).toLocaleString()
    : null

  return (
    <div
      className="mt-1 space-y-0.5 text-[11px] text-muted-foreground"
      data-qa-marker="growth-prospect-search-index-diagnostics-v1"
    >
      <p>
        Index: {modeLabel}
        {diagnostics.index_row_count != null ? ` · ${diagnostics.index_row_count.toLocaleString()} rows` : ""}
        {indexedAt ? ` · Last indexed ${indexedAt}` : ""}
      </p>
      {diagnostics.territory_radius_note ? <p>{diagnostics.territory_radius_note}</p> : null}
    </div>
  )
}
