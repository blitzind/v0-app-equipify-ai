"use client"

import { Badge } from "@/components/ui/badge"
import { buildProspectSearchEngineDiscoveryRollup } from "@/lib/growth/prospect-search/prospect-search-actionable-research"
import { GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-actionable-research-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

function toneClass(tone: string): string {
  switch (tone) {
    case "verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-900"
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "blocked":
      return "border-red-200 bg-red-50 text-red-900"
    default:
      return "border-sky-200 bg-sky-50/80 text-sky-900"
  }
}

export function ProspectSearchEngineDiscoveryRollup({
  row,
  className,
}: {
  row: GrowthProspectSearchCompanyResult
  className?: string
}) {
  const rollup = buildProspectSearchEngineDiscoveryRollup(row)
  if (!rollup) return null

  return (
    <div
      className={cn("space-y-1.5", className)}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER}
      data-engine-discovery-rollup="v1"
    >
      {rollup.summary ? (
        <p className="text-[11px] text-sky-800">{rollup.summary}</p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {rollup.lanes.map((lane) => (
          <Badge
            key={lane.key}
            variant="outline"
            className={cn("text-[10px] font-normal", toneClass(lane.status_tone))}
            title={lane.hint ?? undefined}
          >
            {lane.label}: {lane.status}
          </Badge>
        ))}
      </div>
    </div>
  )
}
