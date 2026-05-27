"use client"

import type { GrowthProspectSearchLiveEstimate } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import { cn } from "@/lib/utils"

export function ProspectSearchFilterHealthWarnings({
  estimate,
  className,
}: {
  estimate: GrowthProspectSearchLiveEstimate | null
  className?: string
}) {
  const warnings = estimate?.filter_health_warnings ?? []
  if (!warnings.length) return null

  return (
    <ul className={cn("space-y-1 text-xs text-amber-900", className)}>
      {warnings.map((warning) => (
        <li key={warning} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1">
          {warning}
        </li>
      ))}
    </ul>
  )
}
