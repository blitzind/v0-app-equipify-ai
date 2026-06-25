"use client"

import { Sparkles } from "lucide-react"
import {
  GROWTH_SEARCH_CLEAN_START_QA_MARKER,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"
import type { GrowthProspectSearchSavedSearchWithWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"

export function ProspectSearchCleanStartPanel({
  savedSearches,
  onRestoreSavedSearch,
}: {
  savedSearches: GrowthProspectSearchSavedSearchWithWorkflow[]
  onRunQuery: (query: string) => void
  onRestoreSavedSearch: (id: string) => void
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-border bg-muted/15 px-6 py-10 text-center"
      data-qa-marker={GROWTH_SEARCH_CLEAN_START_QA_MARKER}
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700">
        <Sparkles className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">Ready when you are</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        Choose a recommended search above, describe your market in the search bar, or open advanced filters
        for manual precision. Results stay staged for review before you add accounts to your pipeline.
      </p>

      {savedSearches.length > 0 ? (
        <div className="mx-auto mt-8 max-w-md text-left">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saved searches
          </h4>
          <ul className="mt-2 space-y-1.5">
            {savedSearches.slice(0, 5).map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="text-sm font-medium text-violet-700 hover:underline"
                  onClick={() => onRestoreSavedSearch(row.id)}
                >
                  {row.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
