"use client"

import { Filter } from "lucide-react"
import { GuidedIcpBuilder } from "@/components/growth/prospect-search/guided-icp-builder"
import { SavedSearchWorkflowSidebar } from "@/components/growth/prospect-search/saved-search-workflow-sidebar"
import type { GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchSavedSearchWithWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"
import { GROWTH_PROSPECT_SEARCH_LAYOUT_V2_QA_MARKER } from "@/components/growth/prospect-search/prospect-search-ux-constants"

export function ProspectSearchFilterRail({
  filters,
  onChange,
  onApply,
  onClear,
  savedSearches,
  lists,
  onLoadSavedSearch,
  activeSavedSearchId,
  refreshingSavedCounts,
  onRefreshSavedCounts,
  onDeleteSavedSearch,
}: {
  filters: GrowthProspectSearchFilters
  onChange: (filters: GrowthProspectSearchFilters) => void
  onApply: () => void
  onClear: () => void
  savedSearches: GrowthProspectSearchSavedSearchWithWorkflow[]
  lists: Array<{ id: string; name: string; member_count: number }>
  onLoadSavedSearch: (id: string) => void
  activeSavedSearchId?: string | null
  refreshingSavedCounts?: boolean
  onRefreshSavedCounts?: (id?: string) => void
  onDeleteSavedSearch?: (id: string) => void
}) {
  return (
    <aside
      className="flex w-full shrink-0 flex-col rounded-2xl border border-border bg-card shadow-sm lg:sticky lg:top-4 lg:w-[340px] lg:max-h-[calc(100vh-8rem)] lg:overflow-hidden"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_LAYOUT_V2_QA_MARKER}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Filter className="size-4 text-violet-600" />
        <div>
          <h2 className="text-sm font-semibold">Filters</h2>
          <p className="text-xs text-muted-foreground">Refine ICP before searching</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <GuidedIcpBuilder
          filters={filters}
          onChange={onChange}
          onApply={onApply}
          onClear={onClear}
          variant="rail"
        />

        {savedSearches.length > 0 ? (
          <div className="mt-4 border-t border-border pt-4">
            <SavedSearchWorkflowSidebar
              savedSearches={savedSearches}
              activeSavedSearchId={activeSavedSearchId ?? null}
              refreshing={refreshingSavedCounts}
              onRestore={onLoadSavedSearch}
              onRefreshCounts={(id) => onRefreshSavedCounts?.(id)}
              onDelete={(id) => onDeleteSavedSearch?.(id)}
            />
          </div>
        ) : null}

        {lists.length > 0 ? (
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lists</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {lists.map((l) => (
                <li key={l.id} className="px-2">
                  {l.name} <span className="text-xs">({l.member_count})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
