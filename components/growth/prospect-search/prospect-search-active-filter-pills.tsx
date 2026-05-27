"use client"

import { X } from "lucide-react"
import {
  applyProspectSearchRelaxSuggestion,
  buildProspectSearchActiveFilterChips,
} from "@/lib/growth/prospect-search/prospect-search-filter-health"
import type { GrowthProspectSearchLiveEstimate } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

export function ProspectSearchActiveFilterPills({
  filters,
  onChange,
  className,
}: {
  filters: GrowthProspectSearchFilters
  onChange: (next: GrowthProspectSearchFilters) => void
  className?: string
}) {
  const chips = buildProspectSearchActiveFilterChips(filters)
  if (!chips.length) return null

  const grouped = chips.reduce<Record<string, typeof chips>>((acc, chip) => {
    acc[chip.category] = acc[chip.category] ?? []
    acc[chip.category]!.push(chip)
    return acc
  }, {})

  return (
    <div className={cn("flex flex-col gap-2", className)} data-active-filter-pills="v1">
      {Object.entries(grouped).map(([category, rows]) => (
        <div key={category} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {category}
          </span>
          {rows.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] text-violet-900 hover:bg-violet-100"
              onClick={() => onChange({ ...filters, ...chip.clear })}
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ProspectSearchRelaxFilters({
  estimate,
  filters,
  onChange,
  className,
}: {
  estimate: GrowthProspectSearchLiveEstimate | null
  filters: GrowthProspectSearchFilters
  onChange: (next: GrowthProspectSearchFilters) => void
  className?: string
}) {
  const suggestions = estimate?.relax_suggestions ?? []
  if (!suggestions.length) return null

  return (
    <div className={cn("rounded-lg border border-dashed border-violet-300 bg-violet-50/60 px-3 py-2", className)}>
      <p className="text-xs font-medium text-violet-950">Relax filters</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-md border border-violet-200 bg-white px-2 py-1 text-[11px] text-violet-900 hover:bg-violet-100"
            onClick={() => onChange(applyProspectSearchRelaxSuggestion(filters, suggestion))}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
