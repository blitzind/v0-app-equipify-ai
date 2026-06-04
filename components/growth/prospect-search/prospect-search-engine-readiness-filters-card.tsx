"use client"

import type { Dispatch, SetStateAction } from "react"
import { cn } from "@/lib/utils"
import {
  GROWTH_PROSPECT_SEARCH_PRIORITIZATION_TIERS,
  GROWTH_PROSPECT_SEARCH_RESEARCH_COMPLETENESS,
  type GrowthProspectSearchPrioritizationTier,
  type GrowthProspectSearchResearchCompleteness,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  formatProspectSearchPrioritizationTier,
  formatProspectSearchResearchCompleteness,
  GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER,
  PROSPECT_SEARCH_READINESS_FILTER_NOTE,
  PROSPECT_SEARCH_READINESS_FILTER_SECTION_HELPER,
  PROSPECT_SEARCH_READINESS_FILTER_SECTION_LABEL,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness-ux"

function toggleTier(
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>,
  tier: GrowthProspectSearchPrioritizationTier,
) {
  onChange((prev) => {
    const current = prev.prioritization_tiers ?? []
    const next = current.includes(tier) ? current.filter((t) => t !== tier) : [...current, tier]
    return { ...prev, prioritization_tiers: next.length ? next : undefined }
  })
}

function toggleCompleteness(
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>,
  value: GrowthProspectSearchResearchCompleteness,
) {
  onChange((prev) => {
    const current = prev.research_completeness ?? []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    return { ...prev, research_completeness: next.length ? next : undefined }
  })
}

export function ProspectSearchEngineReadinessFiltersCard({
  filters,
  onChange,
}: {
  filters: GrowthProspectSearchFilters
  onChange: Dispatch<SetStateAction<GrowthProspectSearchFilters>>
}) {
  return (
    <div
      className="space-y-3"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER}
      data-engine-readiness-filters="v1"
    >
      <div>
        <p className="text-xs font-semibold text-violet-950">{PROSPECT_SEARCH_READINESS_FILTER_SECTION_LABEL}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{PROSPECT_SEARCH_READINESS_FILTER_SECTION_HELPER}</p>
        <p className="mt-1 text-[11px] text-violet-800">{PROSPECT_SEARCH_READINESS_FILTER_NOTE}</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Prioritization tier</p>
        <div className="flex flex-wrap gap-1.5">
          {GROWTH_PROSPECT_SEARCH_PRIORITIZATION_TIERS.map((tier) => {
            const active = filters.prioritization_tiers?.includes(tier) ?? false
            return (
              <button
                key={tier}
                type="button"
                onClick={() => toggleTier(onChange, tier)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  active
                    ? "border-violet-500 bg-violet-50 text-violet-950"
                    : "border-border hover:bg-muted",
                )}
              >
                {formatProspectSearchPrioritizationTier(tier)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Research completeness</p>
        <div className="flex flex-wrap gap-1.5">
          {GROWTH_PROSPECT_SEARCH_RESEARCH_COMPLETENESS.map((value) => {
            const active = filters.research_completeness?.includes(value) ?? false
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleCompleteness(onChange, value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium",
                  active
                    ? "border-violet-400 bg-violet-50/80 text-violet-950"
                    : "border-border hover:bg-muted",
                )}
              >
                {formatProspectSearchResearchCompleteness(value)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
